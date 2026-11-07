#!/usr/bin/env python3
"""SQLite round-trip: bad clocks stay off the candle axis and labels survive export."""
import tempfile
import unittest
from pathlib import Path

from collector import migrate as migrate_fills
from sync_candles import connect, enrich_fills, exports_for_asset, migrate, split_ingest_candle_batches, upsert_block_times


def _insert_fill(conn, asset: str, height: int) -> None:
    conn.execute(
        """
        INSERT INTO fills (
          height, asset, side, price, base, quote, taker, maker,
          taker_order, maker_order, raw_json, first_seen_at, block_time_unix,
          dup_seq, time_status
        ) VALUES (?, ?, 'buy', '100', '1', '1', 'taker', 'maker', 1, 1, '{}',
                  '2026-11-06T00:00:00Z', NULL, 0, 'untimed')
        """,
        (height, asset),
    )


class TestSyncHonesty(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.conn = connect(Path(self.tmp.name) / "fills.sqlite")
        migrate_fills(self.conn)
        migrate(self.conn)

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()

    def test_legacy_sealed_at_is_demoted(self):
        self.conn.execute(
            """
            INSERT INTO block_times(
              height, hash, sealed_at, observed_at, block_unix, time_source, recorded_at
            ) VALUES (5, 'abc', '2026-11-06T01:00:00Z', '2026-11-06T01:00:01Z',
                      1793926800, 'explorer.sealed_at', '2026-11-06T01:00:02Z')
            """
        )
        _insert_fill(self.conn, "BTC4", 5)
        self.conn.execute(
            """
            UPDATE fills
            SET time_status='timed', block_time_unix=1793926800, block_time_source='explorer.sealed_at'
            WHERE height=5
            """
        )
        self.conn.commit()
        migrate(self.conn)
        block = self.conn.execute(
            "SELECT block_unix, time_quality, time_source, verified_utc FROM block_times WHERE height=5"
        ).fetchone()
        fill = self.conn.execute(
            "SELECT time_status, block_time_unix, block_time_source FROM fills WHERE height=5"
        ).fetchone()
        self.assertIsNone(block["block_unix"])
        self.assertEqual(block["time_quality"], "unavailable")
        self.assertEqual(block["time_source"], "none")
        self.assertEqual(block["verified_utc"], 0)
        self.assertEqual(fill["time_status"], "untimed")
        self.assertIsNone(fill["block_time_unix"])
        self.assertIsNone(fill["block_time_source"])

    def test_observer_arrival_times_fills_physics_does_not_become_utc(self):
        blocks = [
            {
                "height": 10,
                "hash": "phys",
                "sealed_at": "2026-11-06T00:00:00.000Z",
                "sealed_at_ms": 1793923200000,
                "sealed_at_quality": "chain_physics",
                "sealed_utc_quality": "unavailable",
                "sealed_utc_source": "none",
                "observed_at": "2026-11-06T00:00:05Z",
            },
            {
                "height": 11,
                "hash": "obs",
                "sealed_at": None,
                "observed_at": "2026-11-06T01:00:00Z",
            },
            {
                "height": 12,
                "network_id": 2300,
                "utc_activated": False,
                "sealed_utc_ms": 1793923200000,
                "sealed_utc_quality": "unavailable",
                "sealed_utc_source": "none",
                "sealed_at": None,
            },
            {
                "height": 13,
                "sealed_utc_ms": 0,
                "sealed_utc_quality": "utc_committed",
                "sealed_utc_source": "signed_utc_v5",
            },
            {
                "height": 14,
                "sealed_at": "not-a-date",
                "sealed_utc_ms": "nope",
            },
        ]
        upsert_block_times(self.conn, blocks)
        for height, asset in ((10, "BTC4"), (11, "BTC4"), (12, "BTC4"), (13, "USDC"), (14, "USDC")):
            _insert_fill(self.conn, asset, height)
        self.conn.commit()
        self.assertGreaterEqual(enrich_fills(self.conn)["enriched"], 1)
        timed = self.conn.execute("SELECT COUNT(*) c FROM fills WHERE time_status='timed'").fetchone()["c"]
        self.assertEqual(timed, 5)
        observer = self.conn.execute(
            "SELECT COUNT(*) c FROM fills WHERE time_status='timed' AND block_time_source='observer'"
        ).fetchone()["c"]
        self.assertEqual(observer, 5)
        rows = self.conn.execute("SELECT height, block_unix, verified_utc FROM block_times").fetchall()
        self.assertEqual(len(rows), 5)
        for row in rows:
            self.assertIsNone(row["block_unix"], row["height"])
            self.assertEqual(row["verified_utc"], 0, row["height"])
        self.assertEqual(self.conn.execute("SELECT COUNT(*) c FROM fills").fetchone()["c"], 5)

        btc = exports_for_asset(self.conn, "BTC4")
        usdc = exports_for_asset(self.conn, "USDC")
        self.assertTrue(all(item["candles"] for item in btc))
        self.assertTrue(all(item["candles"] for item in usdc))
        btc_cov = btc[0]["coverage"]
        usdc_cov = usdc[0]["coverage"]
        self.assertEqual(btc_cov["pair"], "BTC4-FPL")
        self.assertEqual(usdc_cov["pair"], "USDC-FPL")
        self.assertNotEqual(btc_cov["pair"], usdc_cov["pair"])
        self.assertEqual(btc_cov["untimedFills"], 0)
        self.assertEqual(usdc_cov["untimedFills"], 0)
        self.assertEqual(btc_cov["timedFills"], 3)
        self.assertEqual(usdc_cov["timedFills"], 2)
        self.assertFalse(btc_cov["verifiedUtc"])
        self.assertFalse(usdc_cov["verifiedUtc"])
        self.assertEqual(btc_cov["quote"], "FPL")
        self.assertEqual(usdc_cov["quote"], "FPL")
        self.assertEqual(btc_cov["chartMode"], "estimated_observer")
        self.assertEqual(usdc_cov["chartMode"], "estimated_observer")
        self.assertEqual(btc_cov["timeQuality"], "observer")
        self.assertEqual(btc_cov["timeSource"], "observer")
        self.assertEqual(usdc_cov["timeQuality"], "observer")
        self.assertNotEqual(btc_cov["timeQuality"], "canonical_sealed")
        self.assertNotEqual(btc_cov["timeQuality"], "verified_utc")
        self.assertGreaterEqual(btc_cov["evidenceCounts"].get("chain_physics", 0), 1)
        self.assertGreaterEqual(btc_cov["evidenceCounts"].get("observer", 0), 1)
        self.assertIsNone(btc_cov["emptyReasonHint"])

    def test_empty_usdc_is_not_replaced_with_btc4(self):
        upsert_block_times(
            self.conn,
            [{
                "height": 20,
                "sealed_at_ms": 42,
                "sealed_at_quality": "chain_physics",
                "sealed_utc_quality": "unavailable",
                "sealed_utc_source": "none",
                "sealed_at": None,
                "observed_at": None,
            }],
        )
        _insert_fill(self.conn, "BTC4", 20)
        _insert_fill(self.conn, "BTC4", 21)
        self.conn.commit()
        enrich_fills(self.conn)
        usdc = exports_for_asset(self.conn, "USDC")[0]
        btc = exports_for_asset(self.conn, "BTC4")[0]
        self.assertEqual(usdc["pair"], "USDC-FPL")
        self.assertEqual(usdc["candles"], [])
        self.assertEqual(usdc["coverage"]["untimedFills"], 0)
        self.assertEqual(usdc["coverage"]["timedFills"], 0)
        self.assertEqual(usdc["coverage"]["timeQuality"], "unavailable")
        self.assertEqual(btc["coverage"]["untimedFills"], 0)
        self.assertEqual(btc["coverage"]["timedFills"], 2)
        self.assertEqual(btc["coverage"]["timeQuality"], "observer")
        self.assertEqual(btc["coverage"]["timeSource"], "observer")
        self.assertEqual(btc["coverage"]["chartMode"], "estimated_observer")
        self.assertTrue(btc["candles"])
        self.assertFalse(btc["coverage"]["verifiedUtc"])
        self.assertNotEqual(usdc["coverage"]["timeQuality"], btc["coverage"]["timeQuality"])
        self.assertEqual(self.conn.execute("SELECT COUNT(*) c FROM fills").fetchone()["c"], 2)

    def test_observed_refresh_keeps_stored_physics_and_reclassifies(self):
        upsert_block_times(
            self.conn,
            [{
                "height": 30,
                "hash": "abc",
                "sealed_at_ms": 42,
                "sealed_at_quality": "chain_physics",
                "sealed_utc_quality": "unavailable",
                "sealed_utc_source": "none",
                "sealed_at": None,
                "observed_at": None,
            }],
        )
        upsert_block_times(
            self.conn,
            [{
                "height": 30,
                "hash": "abc",
                "sealed_at": None,
                "observed_at": "2026-11-06T02:00:00Z",
            }],
        )
        row = self.conn.execute("SELECT * FROM block_times WHERE height=30").fetchone()
        self.assertEqual(row["sealed_at_ms"], 42)
        self.assertEqual(row["time_quality"], "chain_physics")
        self.assertEqual(row["time_source"], "chain_physics")
        self.assertEqual(row["observed_at"], "2026-11-06T02:00:00Z")
        self.assertIsNone(row["block_unix"])
        self.assertEqual(row["verified_utc"], 0)

    def test_ingest_batches_keep_empty_coverage_only(self):
        self.assertEqual(split_ingest_candle_batches([]), [[]])
        self.assertEqual(len(split_ingest_candle_batches([{"time": 1}] * 5000)), 1)
        batches = split_ingest_candle_batches([{"time": i} for i in range(5001)])
        self.assertEqual(len(batches), 2)
        self.assertEqual(len(batches[0]), 5000)
        self.assertEqual(len(batches[1]), 1)


if __name__ == "__main__":
    unittest.main()
