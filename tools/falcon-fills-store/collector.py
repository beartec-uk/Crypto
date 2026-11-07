#!/usr/bin/env python3
# Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
"""Falcon Cloud fills collector → local SQLite (WAL).

Server-only. Reads FALCON_CLOUD_API_KEY from the environment (systemd EnvironmentFile).
Never logs the key value.

Dedup: natural key from fd-pl Fill fields
  (height, asset, side, price, base, quote, taker, maker, ifnull(taker_order,-1), ifnull(maker_order,-1))
Notes:
  - height+taker_order alone is NOT unique (one taker order can match multiple makers).
  - maker_order is optional (absent/None for AMM prints); expression unique index uses -1 sentinel.
  - If two legitimate fills ever share every field including both order ids, they would collapse;
    raw poll snapshots are retained (bounded) so that case can be audited. No synthetic IDs.

Block timestamps: fpl_fills has no time field. block_time_unix stays NULL.
Physics ms (tip_sealed_at_ms|last_pack_at_ms|sealed_at_ms) is not wall-clock UTC.
first_seen_at and explorer observed_at are observation only — never candle time.
Live RPC windows are newest-first. collect_pos is first-seen collector order
after reversing that window — not protocol in-block chronology. dup_seq is
multiplicity of identical natural keys, not trade order.
See sync_candles.py. Verified UTC candles are not enabled.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from candle_lib import assign_window_positions

RPC_URL = os.environ.get("FALCON_CLOUD_RPC_URL", "https://rpc.falcon-fpl.com/v1/rpc")
DEFAULT_PAIRS = ("BTC4", "USDC")  # allowlisted known markets only
MAX_LIMIT = 200
DEFAULT_DB = "/var/lib/falcon-fills-store/fills.sqlite"
SCHEMA_VERSION = 1

# Free tier budget awareness (units). Documented estimates use these.
# 2 pairs * 1 fills call per cycle + 1 status every STATUS_EVERY cycles.
STATUS_EVERY = 10


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def require_key() -> str:
    key = os.environ.get("FALCON_CLOUD_API_KEY", "").strip()
    if not key:
        raise SystemExit("FALCON_CLOUD_API_KEY missing")
    return key


def rpc(method: str, params: dict[str, Any], key: str, timeout: float = 20.0, tries: int = 3) -> Any:
    if not isinstance(params, dict):
        raise ValueError("params must be object")
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    last_err: Exception | None = None
    for attempt in range(tries):
        req = urllib.request.Request(
            RPC_URL,
            data=body,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            raw = e.read().decode() if e.fp else ""
            if e.code == 429 and attempt + 1 < tries:
                wait = 1
                try:
                    wait = max(1, int(e.headers.get("Retry-After", "1")))
                except Exception:
                    pass
                time.sleep(min(wait, 5))
                last_err = e
                continue
            raise RuntimeError(f"HTTP {e.code}: {raw[:180]}") from e
        except Exception as e:
            last_err = e
            if attempt + 1 < tries:
                time.sleep(1 + attempt)
                continue
            raise
        if "error" in payload and payload["error"]:
            err = payload["error"]
            raise RuntimeError(f"RPC {err.get('code')}: {err.get('message')}")
        return payload.get("result")
    raise RuntimeError(f"RPC failed after retries: {last_err}")


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), timeout=60)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def migrate(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS fills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          height INTEGER NOT NULL,
          asset TEXT NOT NULL,
          side TEXT NOT NULL,
          price TEXT NOT NULL,
          base TEXT NOT NULL,
          quote TEXT NOT NULL,
          taker TEXT NOT NULL,
          maker TEXT NOT NULL,
          taker_order INTEGER,
          maker_order INTEGER,
          raw_json TEXT NOT NULL,
          first_seen_at TEXT NOT NULL,
          block_time_unix INTEGER
        );

        -- Natural-key uniqueness. NULL order ids mapped to -1 in the index.
        CREATE UNIQUE INDEX IF NOT EXISTS fills_natural_uid ON fills (
          height, asset, side, price, base, quote, taker, maker,
          ifnull(taker_order, -1),
          ifnull(maker_order, -1)
        );
        CREATE INDEX IF NOT EXISTS fills_asset_height ON fills (asset, height DESC);

        CREATE TABLE IF NOT EXISTS poll_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          pair TEXT NOT NULL,
          ok INTEGER NOT NULL,
          fill_count INTEGER,
          inserted INTEGER,
          skipped_existing INTEGER,
          min_height INTEGER,
          max_height INTEGER,
          tip_height INTEGER,
          gap_marked INTEGER NOT NULL DEFAULT 0,
          error TEXT,
          units_spent INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS coverage (
          asset TEXT PRIMARY KEY,
          first_height INTEGER,
          last_height INTEGER,
          fill_rows INTEGER NOT NULL DEFAULT 0,
          last_poll_at TEXT,
          last_gap_at TEXT,
          last_gap_note TEXT,
          store_started_at TEXT,
          notes TEXT
        );

        CREATE TABLE IF NOT EXISTS raw_poll_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          polled_at TEXT NOT NULL,
          pair TEXT NOT NULL,
          tip_height INTEGER,
          fill_count INTEGER NOT NULL,
          payload_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS raw_poll_snapshots_polled ON raw_poll_snapshots (polled_at DESC);
        """
    )
    # Additive columns for timestamp/candle phase
    cols = {r[1] for r in conn.execute("PRAGMA table_info(fills)").fetchall()}
    if "dup_seq" not in cols:
        conn.execute("ALTER TABLE fills ADD COLUMN dup_seq INTEGER NOT NULL DEFAULT 0")
    if "collect_pos" not in cols:
        conn.execute("ALTER TABLE fills ADD COLUMN collect_pos INTEGER NOT NULL DEFAULT 0")
    if "block_time_source" not in cols:
        conn.execute("ALTER TABLE fills ADD COLUMN block_time_source TEXT")
    if "time_status" not in cols:
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
    cur = conn.execute("SELECT value FROM meta WHERE key='schema_version'")
    row = cur.fetchone()
    if not row:
        conn.execute(
            "INSERT INTO meta(key, value) VALUES ('schema_version', ?), ('store_started_at', ?)",
            (str(SCHEMA_VERSION), utc_now_iso()),
        )
    conn.commit()


def int_str(v: Any) -> str:
    """Persist integer amounts as decimal strings (no float)."""
    if isinstance(v, bool):
        raise ValueError("bool not allowed")
    if isinstance(v, int):
        return str(v)
    if isinstance(v, str) and v.strip().lstrip("-").isdigit():
        return str(int(v.strip()))
    # Reject floats / scientific notation to avoid precision loss
    raise ValueError(f"non-integer amount: {type(v).__name__}")


def opt_int(v: Any) -> int | None:
    if v is None:
        return None
    if isinstance(v, bool):
        raise ValueError("bool not allowed")
    if isinstance(v, int):
        return v
    if isinstance(v, str) and v.strip().lstrip("-").isdigit():
        return int(v.strip())
    raise ValueError(f"non-integer optional: {type(v).__name__}")


def normalize_fill(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "height": opt_int(raw["height"]),
        "asset": str(raw["asset"]),
        "side": str(raw["side"]),
        "price": int_str(raw["price"]),
        "base": int_str(raw["base"]),
        "quote": int_str(raw["quote"]),
        "taker": str(raw["taker"]),
        "maker": str(raw["maker"]),
        "taker_order": opt_int(raw.get("taker_order")),
        "maker_order": opt_int(raw.get("maker_order")),
        "raw_json": json.dumps(raw, separators=(",", ":"), sort_keys=True),
    }


def prune_snapshots(conn: sqlite3.Connection, keep: int = 120) -> None:
    conn.execute(
        """
        DELETE FROM raw_poll_snapshots
        WHERE id NOT IN (
          SELECT id FROM raw_poll_snapshots ORDER BY id DESC LIMIT ?
        )
        """,
        (keep,),
    )


def detect_gap(
    conn: sqlite3.Connection,
    asset: str,
    min_h: int | None,
    max_h: int | None,
    tip: int | None,
) -> str | None:
    """Heuristic coverage gap: previous last_height is below current window min and tip advanced past it.

    With only a 200-fill recent ring, missed polls can drop fills permanently. We mark a gap when
    the new window does not overlap the previously stored last_height (last_height < min_h).
    """
    if min_h is None or max_h is None:
        return None
    row = conn.execute(
        "SELECT last_height, fill_rows FROM coverage WHERE asset=?", (asset,)
    ).fetchone()
    if not row or row["last_height"] is None or row["fill_rows"] == 0:
        return None
    prev_last = int(row["last_height"])
    if prev_last < min_h:
        return (
            f"coverage_gap: prev_last_height={prev_last} < window_min={min_h} "
            f"(tip={tip}); fills may have scrolled out of the RECENT_FILLS=200 ring"
        )
    return None


def upsert_coverage(
    conn: sqlite3.Connection,
    asset: str,
    min_h: int | None,
    max_h: int | None,
    inserted: int,
    gap_note: str | None,
) -> None:
    now = utc_now_iso()
    row = conn.execute("SELECT * FROM coverage WHERE asset=?", (asset,)).fetchone()
    if not row:
        started = conn.execute(
            "SELECT value FROM meta WHERE key='store_started_at'"
        ).fetchone()
        conn.execute(
            """
            INSERT INTO coverage(asset, first_height, last_height, fill_rows, last_poll_at,
                                 last_gap_at, last_gap_note, store_started_at, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                asset,
                min_h,
                max_h,
                inserted,
                now,
                now if gap_note else None,
                gap_note,
                started["value"] if started else now,
                "block_time_unix unset; candle step follow-up required",
            ),
        )
        return
    first = row["first_height"]
    if min_h is not None:
        first = min_h if first is None else min(int(first), min_h)
    last = row["last_height"]
    if max_h is not None:
        last = max_h if last is None else max(int(last), max_h)
    conn.execute(
        """
        UPDATE coverage SET
          first_height=?, last_height=?, fill_rows=fill_rows+?, last_poll_at=?,
          last_gap_at=CASE WHEN ? IS NOT NULL THEN ? ELSE last_gap_at END,
          last_gap_note=CASE WHEN ? IS NOT NULL THEN ? ELSE last_gap_note END
        WHERE asset=?
        """,
        (
            first,
            last,
            inserted,
            now,
            gap_note,
            now,
            gap_note,
            gap_note,
            asset,
        ),
    )


def poll_pair(
    conn: sqlite3.Connection,
    key: str,
    pair: str,
    tip_height: int | None,
    keep_snapshots: int,
) -> dict[str, Any]:
    started = utc_now_iso()
    run: dict[str, Any] = {
        "pair": pair,
        "started_at": started,
        "ok": 0,
        "fill_count": 0,
        "inserted": 0,
        "skipped_existing": 0,
        "min_height": None,
        "max_height": None,
        "tip_height": tip_height,
        "gap_marked": 0,
        "error": None,
        "units_spent": 1,
    }
    try:
        result = rpc("fpl_fills", {"pair": pair, "limit": MAX_LIMIT}, key)
        fills = result.get("fills") if isinstance(result, dict) else None
        if not isinstance(fills, list):
            raise RuntimeError("fills missing/invalid")
        run["fill_count"] = len(fills)
        # Bounded raw snapshot for audit / impossible-exact-dedup review
        conn.execute(
            """
            INSERT INTO raw_poll_snapshots(polled_at, pair, tip_height, fill_count, payload_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                started,
                pair,
                tip_height,
                len(fills),
                json.dumps({"fills": fills}, separators=(",", ":")),
            ),
        )
        prune_snapshots(conn, keep_snapshots)

        heights: list[int] = []
        inserted = 0
        skipped = 0
        def nat_key(raw: dict) -> tuple:
            return (
                raw.get("height"), raw.get("asset"), raw.get("side"),
                raw.get("price"), raw.get("base"), raw.get("quote"),
                raw.get("taker"), raw.get("maker"),
                raw.get("taker_order"), raw.get("maker_order"),
            )
        window = [r for r in fills if isinstance(r, dict)]
        sequenced = assign_window_positions(window, nat_key)
        next_pos_row = conn.execute(
            "SELECT ifnull(MAX(collect_pos), -1) AS m FROM fills"
        ).fetchone()
        next_pos = int(next_pos_row["m"]) + 1
        for raw, dup_seq, window_pos in sequenced:
            f = normalize_fill(raw)
            heights.append(int(f["height"]))
            collect_pos = next_pos + window_pos
            cur = conn.execute(
                """
                INSERT OR IGNORE INTO fills(
                  height, asset, side, price, base, quote, taker, maker,
                  taker_order, maker_order, raw_json, first_seen_at, block_time_unix,
                  dup_seq, collect_pos
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
                """,
                (
                    f["height"],
                    f["asset"],
                    f["side"],
                    f["price"],
                    f["base"],
                    f["quote"],
                    f["taker"],
                    f["maker"],
                    f["taker_order"],
                    f["maker_order"],
                    f["raw_json"],
                    started,
                    dup_seq,
                    collect_pos,
                ),
            )
            if cur.rowcount == 1:
                inserted += 1
            else:
                skipped += 1
        min_h = min(heights) if heights else None
        max_h = max(heights) if heights else None
        run["min_height"] = min_h
        run["max_height"] = max_h
        run["inserted"] = inserted
        run["skipped_existing"] = skipped
        # Coverage asset key = pair base (BTC4 / USDC)
        asset = pair.split("-")[0]
        gap_note = detect_gap(conn, asset, min_h, max_h, tip_height)
        if gap_note:
            run["gap_marked"] = 1
        upsert_coverage(conn, asset, min_h, max_h, inserted, gap_note)
        run["ok"] = 1
    except Exception as e:
        run["error"] = str(e)[:500]
        run["ok"] = 0
    finished = utc_now_iso()
    conn.execute(
        """
        INSERT INTO poll_runs(
          started_at, finished_at, pair, ok, fill_count, inserted, skipped_existing,
          min_height, max_height, tip_height, gap_marked, error, units_spent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            run["started_at"],
            finished,
            run["pair"],
            run["ok"],
            run["fill_count"],
            run["inserted"],
            run["skipped_existing"],
            run["min_height"],
            run["max_height"],
            run["tip_height"],
            run["gap_marked"],
            run["error"],
            run["units_spent"],
        ),
    )
    conn.commit()
    return run


def maybe_tip(conn: sqlite3.Connection, key: str, force: bool = False) -> tuple[int | None, int]:
    """Return (tip_height, units_spent). Fetches status every STATUS_EVERY successful cycles."""
    row = conn.execute("SELECT value FROM meta WHERE key='poll_cycle'").fetchone()
    cycle = int(row["value"]) if row else 0
    cycle += 1
    conn.execute(
        "INSERT INTO meta(key,value) VALUES('poll_cycle',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (str(cycle),),
    )
    conn.commit()
    if not force and cycle % STATUS_EVERY != 1:
        # reuse last tip
        last = conn.execute(
            "SELECT tip_height FROM poll_runs WHERE tip_height IS NOT NULL ORDER BY id DESC LIMIT 1"
        ).fetchone()
        return (int(last["tip_height"]) if last else None), 0
    try:
        st = rpc("fpl_status", {}, key)
        tip = st.get("tip_height") if isinstance(st, dict) else None
        if tip is None and isinstance(st, dict):
            tip = st.get("best_peer_tip")
        return (int(tip) if tip is not None else None), 1
    except Exception:
        return None, 1


def run_once(db_path: Path, pairs: tuple[str, ...], keep_snapshots: int) -> int:
    key = require_key()
    conn = connect(db_path)
    try:
        migrate(conn)
        tip, tip_units = maybe_tip(conn, key)
        summaries = []
        units = tip_units
        worst = 0
        for pair in pairs:
            summary = poll_pair(conn, key, pair, tip, keep_snapshots)
            summaries.append(summary)
            units += int(summary.get("units_spent") or 0)
            if not summary.get("ok"):
                worst = 1
        # Safe summary log — no secrets
        print(
            json.dumps(
                {
                    "at": utc_now_iso(),
                    "tip_height": tip,
                    "units_spent": units,
                    "pairs": [
                        {
                            "pair": s["pair"],
                            "ok": bool(s["ok"]),
                            "fill_count": s["fill_count"],
                            "inserted": s["inserted"],
                            "skipped_existing": s["skipped_existing"],
                            "min_height": s["min_height"],
                            "max_height": s["max_height"],
                            "gap_marked": bool(s["gap_marked"]),
                            "error": s["error"],
                        }
                        for s in summaries
                    ],
                },
                separators=(",", ":"),
            ),
            flush=True,
        )
        return worst
    finally:
        conn.close()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Falcon fills → SQLite collector")
    p.add_argument("--db", default=os.environ.get("FALCON_FILLS_DB", DEFAULT_DB))
    p.add_argument(
        "--pairs",
        default=os.environ.get("FALCON_FILLS_PAIRS", ",".join(DEFAULT_PAIRS)),
        help="Comma-separated allowlisted pairs (default BTC4,USDC)",
    )
    p.add_argument("--keep-snapshots", type=int, default=int(os.environ.get("FALCON_FILLS_SNAPSHOTS", "120")))
    p.add_argument("--loop-seconds", type=float, default=float(os.environ.get("FALCON_FILLS_INTERVAL_SEC", "0")))
    args = p.parse_args(argv)
    pairs = tuple(x.strip().upper() for x in args.pairs.split(",") if x.strip())
    for pair in pairs:
        if pair not in DEFAULT_PAIRS and not pair.endswith("-FPL"):
            # Still allow *-FPL forms of allowlisted bases only
            base = pair.split("-")[0]
            if base not in DEFAULT_PAIRS:
                print(f"refusing non-allowlisted pair: {pair}", file=sys.stderr)
                return 2
    db_path = Path(args.db)
    if args.loop_seconds and args.loop_seconds > 0:
        while True:
            code = run_once(db_path, pairs, args.keep_snapshots)
            time.sleep(args.loop_seconds)
            # continue even on transient failure
            _ = code
    return run_once(db_path, pairs, args.keep_snapshots)


if __name__ == "__main__":
    raise SystemExit(main())
