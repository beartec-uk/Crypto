#!/usr/bin/env python3
# Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
"""Unit + HTTP tests for the Falcon market data API. No live network, no secrets printed."""
from __future__ import annotations

import json
import os
import sqlite3
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

import serve
from sync_candles import upsert_candles


def _db() -> str:
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)
    conn = sqlite3.connect(path)
    conn.executescript(
        """
        CREATE TABLE fills (
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
          raw_json TEXT NOT NULL DEFAULT '{}',
          first_seen_at TEXT NOT NULL DEFAULT '',
          block_time_unix INTEGER,
          time_status TEXT NOT NULL DEFAULT 'timed'
        );
        CREATE TABLE coverage (
          asset TEXT PRIMARY KEY,
          first_height INTEGER,
          last_height INTEGER,
          fill_rows INTEGER NOT NULL DEFAULT 0,
          last_poll_at TEXT
        );
        INSERT INTO coverage(asset, first_height, last_height, fill_rows, last_poll_at)
        VALUES ('BTC4', 1, 100, 3, '2026-11-26T12:00:00Z');
        INSERT INTO fills(height, asset, side, price, base, quote, taker, maker, taker_order, maker_order, block_time_unix, time_status)
        VALUES
          (90, 'BTC4', 'buy', '4000000', '100', '400', 'a', 'b', 1, 2, 1000, 'timed'),
          (91, 'BTC4', 'sell', '4100000', '200', '820', 'c', 'd', 3, 4, 2000, 'timed'),
          (92, 'BTC4', 'buy', '4200000', '150', '630', 'e', 'f', 5, 6, 3000, 'timed');
        """
    )
    now = int(time.time())
    candles = []
    for i in range(30):
        t0 = now - (29 - i) * 60
        px = 4000000 + i * 1000
        candles.append(
            {
                "time": t0 - (t0 % 60),
                "open": px,
                "high": px + 500,
                "low": px - 500,
                "close": px + 200,
                "volume": 0.01 * (i + 1),
                "fillCount": 2,
                "timeQuality": "observer",
                "timeSource": "observer",
            }
        )
    upsert_candles(conn, "BTC4-FPL", "1m", candles)
    # also a couple of 1h bars
    upsert_candles(
        conn,
        "BTC4-FPL",
        "1h",
        [
            {
                "time": now - 7200 - ((now - 7200) % 3600),
                "open": 3900000,
                "high": 4100000,
                "low": 3800000,
                "close": 4000000,
                "volume": 1.0,
                "fillCount": 10,
                "timeQuality": "observer",
                "timeSource": "observer",
            }
        ],
    )
    conn.commit()
    conn.close()
    return path


class MarketApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.path = _db()
        self.conn = sqlite3.connect(self.path)
        self.conn.row_factory = sqlite3.Row

    def tearDown(self) -> None:
        self.conn.close()
        Path(self.path).unlink(missing_ok=True)

    def test_pairs_and_candles(self) -> None:
        pairs = serve.handle_pairs(self.conn)
        names = [p["pair"] for p in pairs["pairs"]]
        self.assertEqual(names, ["USDC-FPL", "BTC4-FPL", "ETH-FPL"])
        btc = next(p for p in pairs["pairs"] if p["pair"] == "BTC4-FPL")
        self.assertEqual(btc["fill_rows"], 3)
        self.assertIsNotNone(btc["last"])
        c = serve.handle_candles(self.conn, {"pair": ["BTC4-FPL"], "interval": ["1m"], "limit": ["10"]})
        self.assertEqual(c["count"], 10)
        self.assertEqual(c["time_quality"], "observer")
        times = [x["time"] for x in c["candles"]]
        self.assertEqual(times, sorted(times))

    def test_trades_cursor_and_ticker(self) -> None:
        first = serve.handle_trades(self.conn, {"pair": ["BTC4"], "limit": ["2"]})
        self.assertEqual(first["count"], 2)
        self.assertEqual(first["fills"][0]["height"], 92)
        self.assertIsNotNone(first["next_cursor"])
        second = serve.handle_trades(
            self.conn, {"pair": ["BTC4-FPL"], "limit": ["2"], "cursor": [str(first["next_cursor"])]}
        )
        self.assertEqual(second["count"], 1)
        self.assertEqual(second["fills"][0]["height"], 90)
        self.assertIsNone(second["next_cursor"])
        tick = serve.handle_ticker(self.conn, {"pair": ["BTC4-FPL"]})["tickers"][0]
        self.assertEqual(tick["pair"], "BTC4-FPL")
        self.assertIsNotNone(tick["last"])
        self.assertGreater(tick["volume_24h"], 0)

    def test_bad_pair(self) -> None:
        with self.assertRaises(ValueError):
            serve.handle_candles(self.conn, {"pair": ["DOGE-FPL"], "interval": ["1m"]})


class MarketHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.path = _db()
        cls.token = "test-market-token-do-not-use"
        # bind ephemeral
        serve.Handler.db_path = cls.path
        serve.Handler.token = cls.token
        from http.server import ThreadingHTTPServer
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), serve.Handler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        time.sleep(0.05)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.httpd.shutdown()
        Path(cls.path).unlink(missing_ok=True)

    def _get(self, path: str, token: str | None = None) -> tuple[int, dict]:
        headers = {}
        if token is not None:
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}{path}", headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return r.status, json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            body = json.loads(e.read().decode()) if e.fp else {}
            return e.code, body

    def test_auth_and_health(self) -> None:
        code, body = self._get("/health")
        self.assertEqual(code, 200)
        self.assertTrue(body["ok"])
        code, body = self._get("/v1/pairs")
        self.assertEqual(code, 401)
        code, body = self._get("/v1/pairs", "wrong-token")
        self.assertEqual(code, 401)
        code, body = self._get("/v1/pairs", self.token)
        self.assertEqual(code, 200)
        self.assertGreaterEqual(len(body["pairs"]), 3)
        code, body = self._get("/v1/candles?pair=BTC4-FPL&interval=1h", self.token)
        self.assertEqual(code, 200)
        self.assertGreaterEqual(body["count"], 1)


if __name__ == "__main__":
    unittest.main()
