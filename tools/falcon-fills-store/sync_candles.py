#!/usr/bin/env python3
# Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
"""Store explorer tip times and publish estimated observer-arrival candles.

Wallet #187 honestSealTimes (not the older "canonical sealed_at" reading):
  - observed_at is explorer arrival (Date.now at tip-remember). Not trade time.
  - first_seen_at is collector arrival. Also not trade time.
  - sealed_at ISO is set only for utc_committed signed UTC. Otherwise null.
  - sealed_at_ms / tip_sealed_at_ms / last_pack_at_ms are chain physics.
    Never convert them to a UTC date.

Chart mode is estimated_observer: fills are placed on a candle axis using
block observed_unix when present, otherwise first_seen_at. Labels stay
observer / not verified UTC. Physics ms is never a candle clock.
block_times is still keyed by height; that join is not hash-bound identity
and does not admit verified UTC. Network 2300 UTC activation is disabled.

This process can POST ingest when FALCON_BRAIN_INGEST_TOKEN is set.
"""
from __future__ import annotations

import json
import os
import sqlite3
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from candle_lib import (
    CHART_MODE,
    TIME_QUALITY_CHAIN_PHYSICS,
    TIME_QUALITY_OBSERVER,
    TIME_QUALITY_UTC_COMMITTED,
    TIME_SOURCE_OBSERVER,
    TIME_SOURCE_VERIFIED_UTC,
    SealClassification,
    TimedFill,
    build_candles,
    classify_seal_time,
    coverage_gaps,
    normalize_time_quality,
    normalize_time_source,
    parse_iso_to_unix,
    summarize_classifications,
)

DEFAULT_DB = "/var/lib/falcon-fills-store/fills.sqlite"
EXPLORER_BLOCKS = os.environ.get(
    "FALCON_EXPLORER_BLOCKS_URL",
    "https://falcon-fpl.com/api/v1/explorer/blocks?limit=50",
)
INGEST_URL = os.environ.get(
    "FALCON_BRAIN_INGEST_URL",
    "https://www.beartec.uk/api/crypto/falcon/ingest",
)
# USDC-FPL is the default market. BTC4 is selectable. Never copy one into the other.
MARKETS = {
    "USDC": {"pair": "USDC-FPL", "base_decimals": 6, "price_scale": 1_000_000},
    "BTC4": {"pair": "BTC4-FPL", "base_decimals": 8, "price_scale": 100_000_000},
}
TIMEFRAMES = ("1m", "5m", "15m", "1h")
INGEST_CANDLE_LIMIT = 5000
RING_LIMIT_NOTE = (
    "RPC fpl_fills returns at most RECENT_FILLS=200; not full history. "
    "Estimated candles use observer arrival (block observed_at or collector "
    "first_seen_at), not trade time and not verified UTC."
)
EMPTY_REASON = "no_observer_arrival_times"

BLOCK_TIME_COLUMNS = (
    ("sealed_at_ms", "INTEGER"),
    ("sealed_at_quality", "TEXT"),
    ("sealed_utc", "TEXT"),
    ("sealed_utc_ms", "INTEGER"),
    ("sealed_utc_quality", "TEXT"),
    ("sealed_utc_source", "TEXT"),
    ("time_quality", "TEXT"),
    ("verified_utc", "INTEGER NOT NULL DEFAULT 0"),
    ("pre_activation", "INTEGER NOT NULL DEFAULT 1"),
    ("classify_reason", "TEXT"),
    ("observed_unix", "INTEGER"),
)


def connect(db: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db), timeout=60)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _table_cols(conn: sqlite3.Connection, table: str) -> set[str]:
    return {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def migrate(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS block_times (
          height INTEGER PRIMARY KEY,
          hash TEXT,
          sealed_at TEXT,
          observed_at TEXT,
          block_unix INTEGER,
          time_source TEXT NOT NULL,
          recorded_at TEXT NOT NULL
        );
        """
    )
    cols = _table_cols(conn, "block_times")
    for name, decl in BLOCK_TIME_COLUMNS:
        if name not in cols:
            conn.execute(f"ALTER TABLE block_times ADD COLUMN {name} {decl}")
    fill_cols = _table_cols(conn, "fills")
    if "dup_seq" not in fill_cols:
        conn.execute("ALTER TABLE fills ADD COLUMN dup_seq INTEGER NOT NULL DEFAULT 0")
    if "collect_pos" not in fill_cols:
        conn.execute("ALTER TABLE fills ADD COLUMN collect_pos INTEGER NOT NULL DEFAULT 0")
    if "block_time_source" not in fill_cols:
        conn.execute("ALTER TABLE fills ADD COLUMN block_time_source TEXT")
    if "time_status" not in fill_cols:
        conn.execute("ALTER TABLE fills ADD COLUMN time_status TEXT NOT NULL DEFAULT 'untimed'")
    conn.execute("DROP INDEX IF EXISTS fills_natural_uid")
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS fills_natural_uid ON fills (
          height, asset, side, price, base, quote, taker, maker,
          ifnull(taker_order, -1),
          ifnull(maker_order, -1),
          dup_seq
        )
        """
    )
    _reclassify_block_times(conn)
    _untimed_non_verified_fills(conn)
    conn.commit()


def _untimed_non_verified_fills(conn: sqlite3.Connection) -> None:
    # Anything not admitted as verified_utc loses its candle clock, including
    # rows previously timed from explorer.sealed_at.
    conn.execute(
        """
        UPDATE fills
        SET block_time_unix=NULL,
            block_time_source=NULL,
            time_status='untimed'
        WHERE time_status='timed'
          AND ifnull(block_time_source, '') NOT IN (?, ?)
        """,
        (TIME_SOURCE_OBSERVER, TIME_SOURCE_VERIFIED_UTC),
    )


def _row_to_raw(row: sqlite3.Row) -> dict[str, Any]:
    keys = set(row.keys())

    def pick(name: str) -> Any:
        return row[name] if name in keys else None

    return {
        "sealed_at": pick("sealed_at"),
        "sealed_at_ms": pick("sealed_at_ms"),
        "sealed_at_quality": pick("sealed_at_quality"),
        "sealed_utc": pick("sealed_utc"),
        "sealed_utc_ms": pick("sealed_utc_ms"),
        "sealed_utc_quality": pick("sealed_utc_quality"),
        "sealed_utc_source": pick("sealed_utc_source"),
        "observed_at": pick("observed_at"),
        "network_id": 2300,
    }


def _apply_classification(conn: sqlite3.Connection, height: int, classified: SealClassification) -> None:
    conn.execute(
        """
        UPDATE block_times
        SET block_unix=NULL,
            verified_utc=0,
            time_quality=?,
            time_source=?,
            pre_activation=?,
            classify_reason=?,
            observed_unix=?
        WHERE height=?
        """,
        (
            classified.time_quality,
            classified.time_source,
            1 if classified.pre_activation else 0,
            classified.reason,
            classified.observer_unix,
            height,
        ),
    )


def _reclassify_block_times(conn: sqlite3.Connection) -> None:
    rows = conn.execute("SELECT * FROM block_times").fetchall()
    for row in rows:
        _apply_classification(conn, int(row["height"]), classify_seal_time(_row_to_raw(row)))


def fetch_explorer_blocks() -> list[dict]:
    req = urllib.request.Request(EXPLORER_BLOCKS, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode())
    items = data.get("items") if isinstance(data, dict) else data
    return list(items or [])


def _stored_ms(block: dict, keys: tuple[str, ...]) -> int | None:
    """Persist a positive integer ms field. Never invent one from an ISO string."""
    for key in keys:
        value = block.get(key)
        if isinstance(value, bool) or value is None:
            continue
        if isinstance(value, int) and value > 0:
            return value
        if isinstance(value, float) and value > 0 and value.is_integer():
            return int(value)
        return None
    return None


def upsert_block_times(conn: sqlite3.Connection, items: list[dict]) -> dict[str, Any]:
    """Persist honest labels. block_unix stays NULL (verified UTC is not admitted)."""
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    stored = 0
    counts = {TIME_QUALITY_CHAIN_PHYSICS: 0, TIME_QUALITY_OBSERVER: 0, TIME_QUALITY_UTC_COMMITTED: 0, "unavailable": 0}
    for block in items:
        height = int(block["height"])
        classified = classify_seal_time(block)
        counts[classified.time_quality] = counts.get(classified.time_quality, 0) + 1
        sealed = block.get("sealed_at") if isinstance(block.get("sealed_at"), str) else None
        observed = block.get("observed_at") if isinstance(block.get("observed_at"), str) else None
        # sealed_at ISO takes the incoming value, including NULL (honest null
        # over a leftover physics ISO). Diagnostic ms/utc fields COALESCE so an
        # observer-only refresh cannot wipe stored physics or utc candidates.
        # Labels are then reclassified from the merged stored row.
        conn.execute(
            """
            INSERT INTO block_times(
              height, hash, sealed_at, observed_at, block_unix, time_source, recorded_at,
              sealed_at_ms, sealed_at_quality, sealed_utc, sealed_utc_ms, sealed_utc_quality,
              sealed_utc_source, time_quality, verified_utc, pre_activation, classify_reason,
              observed_unix
            )
            VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
            ON CONFLICT(height) DO UPDATE SET
              hash=COALESCE(excluded.hash, block_times.hash),
              sealed_at=excluded.sealed_at,
              observed_at=COALESCE(excluded.observed_at, block_times.observed_at),
              block_unix=NULL,
              time_source=excluded.time_source,
              recorded_at=excluded.recorded_at,
              sealed_at_ms=COALESCE(excluded.sealed_at_ms, block_times.sealed_at_ms),
              sealed_at_quality=COALESCE(excluded.sealed_at_quality, block_times.sealed_at_quality),
              sealed_utc=COALESCE(excluded.sealed_utc, block_times.sealed_utc),
              sealed_utc_ms=COALESCE(excluded.sealed_utc_ms, block_times.sealed_utc_ms),
              sealed_utc_quality=COALESCE(excluded.sealed_utc_quality, block_times.sealed_utc_quality),
              sealed_utc_source=COALESCE(excluded.sealed_utc_source, block_times.sealed_utc_source),
              time_quality=excluded.time_quality,
              verified_utc=0,
              pre_activation=excluded.pre_activation,
              classify_reason=excluded.classify_reason,
              observed_unix=COALESCE(excluded.observed_unix, block_times.observed_unix)
            """,
            (
                height,
                block.get("hash"),
                sealed,
                observed,
                classified.time_source,
                now,
                _stored_ms(block, ("sealed_at_ms", "tip_sealed_at_ms", "last_pack_at_ms")),
                block.get("sealed_at_quality") if isinstance(block.get("sealed_at_quality"), str) else None,
                block.get("sealed_utc") if isinstance(block.get("sealed_utc"), str) else None,
                _stored_ms(block, ("sealed_utc_ms", "tip_sealed_utc_ms")),
                block.get("sealed_utc_quality") if isinstance(block.get("sealed_utc_quality"), str) else None,
                block.get("sealed_utc_source") if isinstance(block.get("sealed_utc_source"), str) else None,
                classified.time_quality,
                1 if classified.pre_activation else 0,
                classified.reason,
                classified.observer_unix,
            ),
        )
        stored_row = conn.execute(
            "SELECT * FROM block_times WHERE height=?", (height,)
        ).fetchone()
        if stored_row:
            _apply_classification(conn, height, classify_seal_time(_row_to_raw(stored_row)))
        stored += 1
    _untimed_non_verified_fills(conn)
    conn.commit()
    return {
        "stored": stored,
        "verifiedUtc": 0,
        "byQuality": counts,
        # Retired counter. Always zero so it cannot be read as verified tips.
        "canonical_sealed": 0,
        "observation_only": counts.get(TIME_QUALITY_OBSERVER, 0),
    }


def _observer_unix_for_fill(row: sqlite3.Row) -> int | None:
    keys = set(row.keys())
    raw = row["observed_unix"] if "observed_unix" in keys else None
    if raw is not None and not isinstance(raw, bool):
        try:
            unix = int(raw)
        except (TypeError, ValueError):
            unix = 0
        if unix > 0:
            return unix
    seen = row["first_seen_at"] if "first_seen_at" in keys else None
    return parse_iso_to_unix(seen if isinstance(seen, str) else None)


def enrich_fills(conn: sqlite3.Connection) -> dict[str, int]:
    """Stamp observer arrival onto fills for the estimated chart.

    Prefer block observed_unix so fills in the same height share a time.
    Fall back to collector first_seen_at. Never copy physics ms or unverified
    sealed_at ISO onto the candle axis. block_unix stays NULL.
    """
    rows = conn.execute(
        """
        SELECT f.id, f.first_seen_at, f.block_time_unix, f.block_time_source,
               f.time_status, bt.observed_unix
        FROM fills f
        LEFT JOIN block_times bt ON bt.height = f.height
        """
    ).fetchall()
    enriched = 0
    for row in rows:
        unix = _observer_unix_for_fill(row)
        if unix is None:
            continue
        if (
            row["time_status"] == "timed"
            and row["block_time_source"] == TIME_SOURCE_OBSERVER
            and row["block_time_unix"] == unix
        ):
            continue
        conn.execute(
            """
            UPDATE fills
            SET block_time_unix=?, block_time_source=?, time_status='timed'
            WHERE id=?
            """,
            (unix, TIME_SOURCE_OBSERVER, row["id"]),
        )
        enriched += 1
    conn.commit()
    return {"enriched": enriched}


def _classifications_for_asset(conn: sqlite3.Connection, asset: str) -> list[SealClassification]:
    rows = conn.execute(
        """
        SELECT DISTINCT bt.*
        FROM fills f
        JOIN block_times bt ON bt.height = f.height
        WHERE f.asset=?
        """,
        (asset,),
    ).fetchall()
    out: list[SealClassification] = []
    for row in rows:
        classified = classify_seal_time(_row_to_raw(row))
        # Prefer the stored public label when it is still an honest token.
        stored_q = normalize_time_quality(row["time_quality"])
        stored_s = normalize_time_source(row["time_source"])
        if row["time_quality"]:
            out.append(
                SealClassification(
                    time_quality=stored_q,
                    time_source=stored_s,
                    verified_utc=False,
                    bucket_unix=None,
                    pre_activation=bool(row["pre_activation"]) if "pre_activation" in row.keys() else classified.pre_activation,
                    reason=row["classify_reason"] or classified.reason,
                    reported_utc_quality=classified.reported_utc_quality,
                    physics_ms=classified.physics_ms,
                    observer_unix=classified.observer_unix,
                    utc_candidate_unix=None,
                    identity_bound=False,
                    emitted_iso=None,
                )
            )
        else:
            out.append(classified)
    return out


def load_timed_fills(conn: sqlite3.Connection, asset: str) -> list[TimedFill]:
    """Fills stamped with observer arrival for the estimated chart."""
    meta = MARKETS[asset]
    scale = meta["price_scale"]
    base_decimals = meta["base_decimals"]
    rows = conn.execute(
        """
        SELECT height, price, base, side, block_time_unix, block_time_source,
               taker, maker, taker_order, maker_order, ifnull(dup_seq, 0) AS dup_seq,
               ifnull(collect_pos, 0) AS collect_pos
        FROM fills
        WHERE asset=? AND time_status='timed' AND block_time_unix IS NOT NULL
          AND block_time_source=?
        ORDER BY block_time_unix ASC, height ASC, collect_pos ASC, dup_seq ASC
        """,
        (asset, TIME_SOURCE_OBSERVER),
    ).fetchall()
    out: list[TimedFill] = []
    for row in rows:
        price = int(row["price"]) / scale
        base_units = int(row["base"]) / (10**base_decimals)
        natural = (
            row["height"],
            asset,
            row["side"],
            row["price"],
            row["base"],
            row["taker"],
            row["maker"],
            row["taker_order"],
            row["maker_order"],
        )
        out.append(
            TimedFill(
                height=int(row["height"]),
                price=price,
                base_units=base_units,
                side=str(row["side"]),
                unix=int(row["block_time_unix"]),
                time_source=TIME_SOURCE_OBSERVER,
                natural_key=natural,
                dup_seq=int(row["dup_seq"] or 0),
                collect_pos=int(row["collect_pos"] or 0),
            )
        )
    return out


def exports_for_asset(conn: sqlite3.Connection, asset: str) -> list[dict[str, Any]]:
    """Per-timeframe payloads. Estimated observer candles when fills have arrival times.

    An empty USDC book is returned as USDC-FPL with its own untimed count.
    BTC4 rows are never substituted.
    """
    meta = MARKETS[asset]
    timed = load_timed_fills(conn, asset)
    untimed = conn.execute(
        "SELECT COUNT(*) c FROM fills WHERE asset=? AND time_status!='timed'",
        (asset,),
    ).fetchone()["c"]
    summary = summarize_classifications(_classifications_for_asset(conn, asset))
    evidence = summary["evidenceCounts"]
    payloads: list[dict[str, Any]] = []
    for timeframe in TIMEFRAMES:
        candles = build_candles(timed, timeframe)
        gaps = coverage_gaps(candles, timeframe) if candles else []
        coverage = {
            "pair": meta["pair"],
            "timeframe": timeframe,
            "timedFills": len(timed),
            "untimedFills": int(untimed),
            "firstTimedHeight": timed[0].height if timed else None,
            "lastTimedHeight": timed[-1].height if timed else None,
            "firstTime": candles[0]["time"] if candles else None,
            "lastTime": candles[-1]["time"] if candles else None,
            "gaps": gaps,
            "ringLimitNote": RING_LIMIT_NOTE,
            "timeQuality": TIME_QUALITY_OBSERVER if candles else summary["timeQuality"],
            "timeSource": TIME_SOURCE_OBSERVER if candles else summary["timeSource"],
            "verifiedUtc": False,
            "chartMode": CHART_MODE,
            "quote": "FPL",
            "evidenceCounts": evidence,
            "emptyReasonHint": None if candles else EMPTY_REASON,
            "canonicalTipsStored": 0,
            "observationOnlyTipsStored": int(evidence.get(TIME_QUALITY_OBSERVER, 0)),
            "physicsTipsStored": int(evidence.get(TIME_QUALITY_CHAIN_PHYSICS, 0)),
            "utcCommittedCandidates": int(evidence.get(TIME_QUALITY_UTC_COMMITTED, 0)),
        }
        payloads.append({"pair": meta["pair"], "timeframe": timeframe, "candles": candles, "coverage": coverage})
    return payloads


def split_ingest_candle_batches(
    candles: list[dict],
    limit: int = INGEST_CANDLE_LIMIT,
) -> list[list[dict]]:
    """Split candle exports into ingest-sized batches. Empty stays coverage-only."""
    if limit <= 0:
        raise ValueError("limit must be positive")
    rows = list(candles or [])
    if not rows:
        return [[]]
    return [rows[i : i + limit] for i in range(0, len(rows), limit)]


def push_candles(pair: str, timeframe: str, candles: list[dict], coverage: dict, token: str) -> dict:
    last: dict = {"ok": True, "status": None, "batches": 0}
    stamped = dict(coverage)
    stamped["timeframe"] = timeframe
    for batch in split_ingest_candle_batches(list(candles or [])):
        body = json.dumps(
            {"pair": pair, "timeframe": timeframe, "candles": batch, "coverage": stamped}
        ).encode()
        req = urllib.request.Request(
            INGEST_URL,
            data=body,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                last = {
                    "ok": True,
                    "status": resp.status,
                    "body": json.loads(resp.read().decode()),
                    "batches": int(last.get("batches") or 0) + 1,
                }
        except urllib.error.HTTPError as err:
            raw = err.read().decode()[:200]
            return {"ok": False, "status": err.code, "error": raw, "batches": int(last.get("batches") or 0)}
        except Exception as err:
            return {"ok": False, "status": None, "error": f"{type(err).__name__}:{err}", "batches": int(last.get("batches") or 0)}
    return last


def _store_export_meta(conn: sqlite3.Connection, coverage: dict, candle_count: int) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS candle_export_meta (
          pair TEXT NOT NULL,
          timeframe TEXT NOT NULL,
          meta_json TEXT NOT NULL,
          candle_count INTEGER NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY(pair, timeframe)
        )
        """
    )
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    conn.execute(
        """
        INSERT INTO candle_export_meta(pair, timeframe, meta_json, candle_count, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(pair, timeframe) DO UPDATE SET
          meta_json=excluded.meta_json,
          candle_count=excluded.candle_count,
          updated_at=excluded.updated_at
        """,
        (coverage["pair"], coverage.get("timeframe") or "", json.dumps(coverage), candle_count, now),
    )


def main() -> int:
    db = Path(os.environ.get("FALCON_FILLS_DB", DEFAULT_DB))
    token = os.environ.get("FALCON_BRAIN_INGEST_TOKEN", "").strip()
    conn = connect(db)
    migrate(conn)
    summary: dict[str, Any] = {"blocks": {}, "enriched": 0, "pushes": []}
    try:
        items = fetch_explorer_blocks()
        summary["blocks"] = upsert_block_times(conn, items)
        summary["enriched"] = enrich_fills(conn)["enriched"]
        for asset, meta in MARKETS.items():
            for payload in exports_for_asset(conn, asset):
                coverage = dict(payload["coverage"])
                coverage["timeframe"] = payload["timeframe"]
                _store_export_meta(conn, coverage, len(payload["candles"]))
                conn.commit()
                if not token:
                    summary["pushes"].append(
                        {
                            "pair": meta["pair"],
                            "tf": payload["timeframe"],
                            "skipped": "no_token",
                            "candles": len(payload["candles"]),
                            "timeQuality": coverage["timeQuality"],
                            "verifiedUtc": False,
                        }
                    )
                    continue
                result = push_candles(
                    meta["pair"], payload["timeframe"], payload["candles"], coverage, token
                )
                summary["pushes"].append(
                    {
                        "pair": meta["pair"],
                        "tf": payload["timeframe"],
                        "candles": len(payload["candles"]),
                        "timeQuality": coverage["timeQuality"],
                        "verifiedUtc": False,
                        **result,
                    }
                )
    finally:
        conn.close()
    print(json.dumps(summary, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
