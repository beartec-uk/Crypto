#!/usr/bin/env python3
# Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
"""Read-only market data HTTP API for the Falcon Cloud gateway.

Listens on a Tailscale (or loopback) bind address only. Requires
Authorization: Bearer $FPL_MARKET_TOKEN. Never logs the token.
Reads the fills SQLite already written by collector.py / sync_candles.py.
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

DEFAULT_DB = "/var/lib/falcon-fills-store/fills.sqlite"
DEFAULT_BIND = "127.0.0.1:8787"
MAX_LIMIT = 500
DEFAULT_LIMIT = 50
INTERVALS = ("1m", "5m", "15m", "1h", "4h", "1d")
MARKETS = {
    "USDC": {"pair": "USDC-FPL", "asset": "USDC", "base_decimals": 6},
    "BTC4": {"pair": "BTC4-FPL", "asset": "BTC4", "base_decimals": 8},
    "ETH": {"pair": "ETH-FPL", "asset": "ETH", "base_decimals": 18},
}
PAIR_TO_ASSET = {v["pair"]: v["asset"] for v in MARKETS.values()}


def connect(path: str) -> sqlite3.Connection:
    uri = f"file:{path}?mode=ro"
    try:
        conn = sqlite3.connect(uri, uri=True, timeout=10)
    except sqlite3.OperationalError:
        conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def pair_or_400(raw: str | None) -> str:
    if not raw:
        raise ValueError("pair")
    p = raw.strip().upper()
    if p in PAIR_TO_ASSET:
        return p
    if p in MARKETS:
        return MARKETS[p]["pair"]
    raise ValueError("pair")


def asset_for(pair: str) -> str:
    return PAIR_TO_ASSET[pair]


def clamp_limit(raw: str | None) -> int:
    try:
        n = int(raw) if raw is not None else DEFAULT_LIMIT
    except ValueError as e:
        raise ValueError("limit") from e
    if n < 1:
        raise ValueError("limit")
    return min(n, MAX_LIMIT)


def parse_int(name: str, raw: str | None) -> int | None:
    if raw is None or raw == "":
        return None
    try:
        return int(raw)
    except ValueError as e:
        raise ValueError(name) from e


def table_exists(conn: sqlite3.Connection, name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone()
    return row is not None


def handle_health(conn: sqlite3.Connection) -> dict[str, Any]:
    fills = conn.execute("SELECT COUNT(*) c FROM fills").fetchone()["c"] if table_exists(conn, "fills") else 0
    candles = conn.execute("SELECT COUNT(*) c FROM candles").fetchone()["c"] if table_exists(conn, "candles") else 0
    return {"ok": True, "service": "falcon-fills-market", "fills": fills, "candles": candles}


def handle_pairs(conn: sqlite3.Connection) -> dict[str, Any]:
    pairs = []
    for asset, meta in MARKETS.items():
        cov = None
        if table_exists(conn, "coverage"):
            cov = conn.execute("SELECT * FROM coverage WHERE asset=?", (asset,)).fetchone()
        last_candle = None
        if table_exists(conn, "candles"):
            last_candle = conn.execute(
                "SELECT time, close, time_quality FROM candles WHERE pair=? AND timeframe='1h' ORDER BY time DESC LIMIT 1",
                (meta["pair"],),
            ).fetchone()
        item: dict[str, Any] = {
            "pair": meta["pair"],
            "base": asset,
            "quote": "FPL",
            "active": True,
        }
        if cov:
            item["first_height"] = cov["first_height"]
            item["last_height"] = cov["last_height"]
            item["fill_rows"] = cov["fill_rows"]
            item["last_poll_at"] = cov["last_poll_at"]
        if last_candle:
            item["last"] = last_candle["close"]
            item["last_time"] = last_candle["time"]
            item["time_quality"] = last_candle["time_quality"]
        pairs.append(item)
    return {"pairs": pairs, "timeframes": list(INTERVALS), "time_quality": "observer"}


def handle_candles(conn: sqlite3.Connection, q: dict[str, list[str]]) -> dict[str, Any]:
    pair = pair_or_400(_one(q, "pair"))
    interval = (_one(q, "interval") or _one(q, "timeframe") or "").strip()
    if interval not in INTERVALS:
        raise ValueError("interval")
    start = parse_int("from", _one(q, "from"))
    end = parse_int("to", _one(q, "to"))
    limit = clamp_limit(_one(q, "limit") or str(MAX_LIMIT))
    if not table_exists(conn, "candles"):
        return {"pair": pair, "interval": interval, "time_quality": "observer", "candles": [], "count": 0}
    where = ["pair=?", "timeframe=?"]
    args: list[Any] = [pair, interval]
    if start is not None:
        where.append("time>=?")
        args.append(start)
    if end is not None:
        where.append("time<=?")
        args.append(end)
    sql = f"SELECT time, open, high, low, close, volume, fill_count, time_quality, time_source FROM candles WHERE {' AND '.join(where)} ORDER BY time DESC LIMIT ?"
    args.append(limit)
    rows = conn.execute(sql, args).fetchall()
    candles = [
        {
            "time": r["time"],
            "open": r["open"],
            "high": r["high"],
            "low": r["low"],
            "close": r["close"],
            "volume": r["volume"],
            "fillCount": r["fill_count"],
            "timeQuality": r["time_quality"],
            "timeSource": r["time_source"],
        }
        for r in reversed(rows)
    ]
    quality = candles[-1]["timeQuality"] if candles else "observer"
    return {
        "pair": pair,
        "interval": interval,
        "time_quality": quality,
        "verified_utc": False,
        "candles": candles,
        "count": len(candles),
    }


def handle_trades(conn: sqlite3.Connection, q: dict[str, list[str]]) -> dict[str, Any]:
    pair_raw = _one(q, "pair")
    pair = pair_or_400(pair_raw) if pair_raw else None
    account = (_one(q, "account") or "").strip() or None
    start = parse_int("from", _one(q, "from"))
    end = parse_int("to", _one(q, "to"))
    cursor = parse_int("cursor", _one(q, "cursor"))
    limit = clamp_limit(_one(q, "limit"))
    if not table_exists(conn, "fills"):
        return {"fills": [], "count": 0, "next_cursor": None}
    where = ["1=1"]
    args: list[Any] = []
    if pair:
        where.append("asset=?")
        args.append(asset_for(pair))
    if account:
        where.append("(taker=? OR maker=?)")
        args.extend([account, account])
    if start is not None:
        where.append("ifnull(block_time_unix, 0)>=?")
        args.append(start)
    if end is not None:
        where.append("ifnull(block_time_unix, 0)<=?")
        args.append(end)
    if cursor is not None:
        where.append("id<?")
        args.append(cursor)
    sql = f"""SELECT id, height, asset, side, price, base, quote, taker, maker,
                     taker_order, maker_order, first_seen_at, block_time_unix,
                     time_status
              FROM fills WHERE {' AND '.join(where)}
              ORDER BY id DESC LIMIT ?"""
    args.append(limit)
    rows = conn.execute(sql, args).fetchall()
    fills = []
    for r in rows:
        item = {
            "id": r["id"],
            "height": r["height"],
            "asset": r["asset"],
            "pair": MARKETS.get(r["asset"], {}).get("pair") or f"{r['asset']}-FPL",
            "side": r["side"],
            "price": int(r["price"]) if str(r["price"]).lstrip("-").isdigit() else r["price"],
            "base": int(r["base"]) if str(r["base"]).lstrip("-").isdigit() else r["base"],
            "quote": int(r["quote"]) if str(r["quote"]).lstrip("-").isdigit() else r["quote"],
            "taker": r["taker"],
            "maker": r["maker"],
            "taker_order": r["taker_order"],
            "maker_order": r["maker_order"],
            "time": r["block_time_unix"],
            "time_status": r["time_status"],
            "time_quality": "observer" if r["block_time_unix"] else "unavailable",
        }
        fills.append(item)
    next_cursor = fills[-1]["id"] if len(fills) == limit else None
    out: dict[str, Any] = {"fills": fills, "count": len(fills), "next_cursor": next_cursor, "time_quality": "observer"}
    if pair:
        out["pair"] = pair
    return out


def handle_ticker(conn: sqlite3.Connection, q: dict[str, list[str]]) -> dict[str, Any]:
    raw = _one(q, "pair")
    if raw:
        return {"tickers": [_ticker_one(conn, pair_or_400(raw))]}
    return {"tickers": [_ticker_one(conn, meta["pair"]) for meta in MARKETS.values()]}


def _ticker_one(conn: sqlite3.Connection, pair: str) -> dict[str, Any]:
    now = int(time.time())
    start = now - 24 * 3600
    out: dict[str, Any] = {
        "pair": pair,
        "last": None,
        "open_24h": None,
        "high_24h": None,
        "low_24h": None,
        "change_24h": None,
        "change_24h_pct": None,
        "volume_24h": 0.0,
        "quote_volume_24h": 0.0,
        "trades_24h": 0,
        "time": None,
        "window_start": start,
        "window_end": now,
        "time_quality": "observer",
        "verified_utc": False,
    }
    if not table_exists(conn, "candles"):
        return out
    rows = conn.execute(
        """SELECT time, open, high, low, close, volume, fill_count, time_quality
           FROM candles WHERE pair=? AND timeframe='1m' AND time>=? ORDER BY time ASC""",
        (pair, start),
    ).fetchall()
    if not rows:
        last = conn.execute(
            """SELECT time, close, time_quality FROM candles
               WHERE pair=? AND timeframe='1m' ORDER BY time DESC LIMIT 1""",
            (pair,),
        ).fetchone()
        if last:
            out["last"] = last["close"]
            out["time"] = last["time"]
            out["time_quality"] = last["time_quality"] or "observer"
        return out
    first, last = rows[0], rows[-1]
    out["open_24h"] = first["open"]
    out["last"] = last["close"]
    out["high_24h"] = max(r["high"] for r in rows)
    out["low_24h"] = min(r["low"] for r in rows)
    out["volume_24h"] = float(sum(r["volume"] or 0 for r in rows))
    out["trades_24h"] = int(sum(r["fill_count"] or 0 for r in rows))
    out["quote_volume_24h"] = float(sum((r["close"] or 0) * (r["volume"] or 0) for r in rows))
    if out["open_24h"]:
        out["change_24h"] = out["last"] - out["open_24h"]
        out["change_24h_pct"] = (out["change_24h"] / out["open_24h"]) * 100.0
    else:
        out["change_24h"] = 0.0
        out["change_24h_pct"] = 0.0
    out["time"] = last["time"]
    out["time_quality"] = last["time_quality"] or "observer"
    return out


def _one(q: dict[str, list[str]], key: str) -> str | None:
    vs = q.get(key)
    return vs[0] if vs else None


class Handler(BaseHTTPRequestHandler):
    db_path: str = DEFAULT_DB
    token: str = ""

    def log_message(self, fmt: str, *args: Any) -> None:
        # Do not log query strings (they are unused today; keep the path only).
        path = self.path.split("?", 1)[0]
        sys.stderr.write("%s - %s %s\n" % (self.address_string(), self.command, path))

    def _unauthorized(self) -> None:
        self._send(401, {"error": "unauthorized"})

    def _send(self, code: int, body: dict[str, Any]) -> None:
        raw = json.dumps(body, separators=(",", ":")).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _authorized(self) -> bool:
        got = self.headers.get("Authorization") or self.headers.get("X-API-Key") or ""
        if got.lower().startswith("bearer "):
            got = got[7:]
        token = self.token
        if not token or len(got) != len(token):
            return False
        acc = 0
        for a, b in zip(got.encode(), token.encode()):
            acc |= a ^ b
        return acc == 0

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        if path == "/health":
            try:
                with connect(self.db_path) as conn:
                    self._send(200, handle_health(conn))
            except Exception:
                self._send(503, {"error": "unavailable"})
            return
        if not self._authorized():
            self._unauthorized()
            return
        q = parse_qs(parsed.query or "")
        try:
            with connect(self.db_path) as conn:
                if path == "/v1/pairs":
                    body = handle_pairs(conn)
                elif path == "/v1/candles":
                    body = handle_candles(conn, q)
                elif path in ("/v1/trades", "/v1/fills"):
                    body = handle_trades(conn, q)
                elif path == "/v1/ticker":
                    body = handle_ticker(conn, q)
                else:
                    self._send(404, {"error": "not found"})
                    return
            self._send(200, body)
        except ValueError as e:
            self._send(400, {"error": f"invalid params: {e}"})
        except Exception:
            self._send(500, {"error": "internal"})


def serve(bind: str, db: str, token: str) -> None:
    host, port_s = bind.rsplit(":", 1)
    port = int(port_s)
    Handler.db_path = db
    Handler.token = token
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(json.dumps({"service": "falcon-fills-market", "bind": bind, "db": db}, separators=(",", ":")))
    httpd.serve_forever()


def main() -> int:
    token = os.environ.get("FPL_MARKET_TOKEN", "").strip()
    if not token:
        raise SystemExit("FPL_MARKET_TOKEN missing")
    bind = os.environ.get("FPL_MARKET_BIND", DEFAULT_BIND).strip() or DEFAULT_BIND
    db = os.environ.get("FALCON_FILLS_DB", DEFAULT_DB)
    serve(bind, db, token)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
