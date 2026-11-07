#!/usr/bin/env python3
import json
import unittest
from pathlib import Path

from candle_lib import (
    TIME_QUALITY_OBSERVER,
    TIME_QUALITY_VERIFIED_UTC,
    TIME_SOURCE_CHAIN_PHYSICS,
    TIME_SOURCE_OBSERVER,
    TIME_SOURCE_VERIFIED_UTC,
    VERIFIED_UTC_BUCKETS_ENABLED,
    TimedFill,
    aggregate_timed_fills,
    bucket_start,
    build_candles,
    classify_seal_time,
    coverage_gaps,
    normalize_time_quality,
    normalize_time_source,
    parse_iso_to_unix,
    resolve_block_unix,
    resolve_observation_unix,
    resolve_ohlcv_block_unix,
    assign_dup_seq,
    assign_window_positions,
)

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "time_honesty.json").read_text())
# Unix second the old code derived from the legacy sealed_at ISO fixture.
LEGACY_ISO_UNIX = 1793926800
PHYSICS_ISO_UNIX = 1793923200


class TestTimestamps(unittest.TestCase):
    def test_parse_iso(self):
        self.assertEqual(parse_iso_to_unix("2026-11-06T01:00:00Z"), LEGACY_ISO_UNIX)

    def test_parseable_sealed_at_is_not_ohlcv(self):
        self.assertFalse(VERIFIED_UTC_BUCKETS_ENABLED)
        unix, source = resolve_ohlcv_block_unix("2026-11-06T01:00:00Z")
        self.assertIsNone(unix)
        self.assertIsNone(source)
        unix2, source2 = resolve_block_unix("2026-11-06T01:00:00Z", "2026-11-06T01:00:00Z")
        self.assertIsNone(unix2)
        self.assertIsNone(source2)

    def test_observed_ignored_for_ohlcv(self):
        unix, source = resolve_ohlcv_block_unix(None)
        self.assertIsNone(unix)
        self.assertIsNone(source)
        unix2, source2 = resolve_block_unix(None, "2026-11-06T01:00:00Z")
        self.assertIsNone(unix2)
        self.assertIsNone(source2)

    def test_observation_helper_separate(self):
        unix, source = resolve_observation_unix("2026-11-06T01:00:00Z")
        self.assertEqual(source, TIME_SOURCE_OBSERVER)
        self.assertEqual(unix, LEGACY_ISO_UNIX)

    def test_no_invent(self):
        unix, source = resolve_block_unix(None, None)
        self.assertIsNone(unix)
        self.assertIsNone(source)

    def test_retired_vocabulary_is_not_verified_utc(self):
        self.assertEqual(normalize_time_quality("canonical_sealed"), "unavailable")
        self.assertEqual(normalize_time_quality("estimated_observation"), "observer")
        self.assertEqual(normalize_time_quality("verified_utc"), "unavailable")
        self.assertEqual(normalize_time_quality("utc_committed"), "utc_committed")
        self.assertEqual(normalize_time_source("explorer.sealed_at"), "none")
        self.assertEqual(normalize_time_source("signed_utc_v5"), "signed_utc_v5")


class TestHonestyFixtures(unittest.TestCase):
    def test_negative_fixtures_never_enter_verified_utc_buckets(self):
        self.assertGreaterEqual(len(FIXTURE["cases"]), 8)
        required = {
            "physics_only",
            "physics_as_iso",
            "observed_only",
            "missing_utc",
            "zero_utc",
            "malformed_time",
            "pre_activation",
            "legacy_sealed_at_iso",
            "utc_committed_network_2300",
        }
        seen = {case["name"] for case in FIXTURE["cases"]}
        self.assertTrue(required <= seen)
        for case in FIXTURE["cases"]:
            got = classify_seal_time(case["block"]).public_dict()
            expect = case["expect"]
            for key, value in expect.items():
                self.assertEqual(got[key], value, f"{case['name']}.{key}")
            self.assertIsNone(got["bucketUnix"], case["name"])
            self.assertFalse(got["verifiedUtc"], case["name"])
            self.assertIsNone(got["emittedIso"], case["name"])
            self.assertNotEqual(got["timeQuality"], "canonical_sealed", case["name"])
            self.assertNotEqual(got["timeQuality"], TIME_QUALITY_VERIFIED_UTC, case["name"])
            self.assertNotEqual(got["timeQuality"], "estimated_observation", case["name"])
            self.assertNotEqual(got["timeSource"], "explorer.sealed_at", case["name"])
            self.assertNotEqual(got["bucketUnix"], LEGACY_ISO_UNIX, case["name"])
            self.assertNotEqual(got["bucketUnix"], PHYSICS_ISO_UNIX, case["name"])
            self.assertFalse(got["identityBound"], case["name"])


class TestDupSeq(unittest.TestCase):
    def test_multiplicity(self):
        fills = [{"a": 1}, {"a": 1}, {"a": 2}, {"a": 1}]
        out = assign_dup_seq(fills, lambda fill: fill["a"])
        self.assertEqual([seq for _, seq in out], [0, 1, 0, 2])


class TestCandles(unittest.TestCase):
    def test_bucket_boundary(self):
        self.assertEqual(bucket_start(100, "1m"), 60)
        self.assertEqual(bucket_start(120, "1m"), 120)

    def test_published_candles_use_observer_not_physics_or_verified(self):
        fills = [
            TimedFill(1, 10.0, 1.0, "buy", 120, TIME_SOURCE_VERIFIED_UTC, (1,), 0),
            TimedFill(2, 12.0, 2.0, "sell", 130, "explorer.sealed_at", (2,), 0),
            TimedFill(3, 11.0, 1.5, "buy", 140, TIME_SOURCE_OBSERVER, (3,), 0),
            TimedFill(4, 9.0, 1.0, "buy", 150, TIME_SOURCE_CHAIN_PHYSICS, (4,), 0),
        ]
        candles = build_candles(fills, "1m")
        self.assertEqual(len(candles), 1)
        self.assertEqual(candles[0]["time"], 120)
        self.assertEqual(candles[0]["open"], 11.0)
        self.assertEqual(candles[0]["close"], 11.0)
        self.assertEqual(candles[0]["timeQuality"], TIME_QUALITY_OBSERVER)
        self.assertEqual(candles[0]["timeSource"], TIME_SOURCE_OBSERVER)
        self.assertEqual(build_candles([], "5m"), [])

    def test_unwired_aggregate_rejects_non_verified_sources(self):
        """OHLC fold stays available but refuses physics, observer, and retired sealed_at."""
        fills = [
            TimedFill(1, 10.0, 1.0, "buy", 120, TIME_SOURCE_VERIFIED_UTC, (1,), 0),
            TimedFill(2, 12.0, 2.0, "sell", 130, TIME_SOURCE_VERIFIED_UTC, (2,), 0),
            TimedFill(3, 11.0, 1.5, "buy", 140, TIME_SOURCE_VERIFIED_UTC, (3,), 0),
            TimedFill(4, 99.0, 50.0, "buy", 120, "explorer.sealed_at", (4,), 0),
            TimedFill(5, 1.0, 50.0, "buy", 120, TIME_SOURCE_OBSERVER, (5,), 0),
            TimedFill(6, 1.0, 50.0, "buy", 120, TIME_SOURCE_CHAIN_PHYSICS, (6,), 0),
        ]
        candles = aggregate_timed_fills(fills, "1m")
        self.assertEqual(len(candles), 1)
        self.assertEqual(candles[0]["time"], 120)
        self.assertEqual(candles[0]["open"], 10.0)
        self.assertEqual(candles[0]["high"], 12.0)
        self.assertEqual(candles[0]["low"], 10.0)
        self.assertEqual(candles[0]["close"], 11.0)
        self.assertEqual(candles[0]["volume"], 4.5)
        self.assertEqual(candles[0]["fillCount"], 3)
        self.assertEqual(candles[0]["timeQuality"], TIME_QUALITY_VERIFIED_UTC)
        published = build_candles(fills, "1m")
        self.assertEqual(len(published), 1)
        self.assertEqual(published[0]["open"], 1.0)
        self.assertEqual(published[0]["timeQuality"], TIME_QUALITY_OBSERVER)

    def test_observation_source_builds_estimated_candles(self):
        fills = [
            TimedFill(1, 10.0, 1.0, "buy", 120, TIME_SOURCE_OBSERVER, (1,), 0),
            TimedFill(2, 12.0, 2.0, "sell", 130, TIME_SOURCE_OBSERVER, (2,), 0),
        ]
        candles = build_candles(fills, "1m")
        self.assertEqual(len(candles), 1)
        self.assertEqual(candles[0]["open"], 10.0)
        self.assertEqual(candles[0]["close"], 12.0)
        self.assertEqual(candles[0]["timeQuality"], TIME_QUALITY_OBSERVER)
        self.assertEqual(aggregate_timed_fills(fills, "1m"), [])

    def test_empty_gap(self):
        candles = [
            {"time": 0, "open": 1.0, "high": 1.0, "low": 1.0, "close": 1.0, "volume": 1.0},
            {"time": 180, "open": 2.0, "high": 2.0, "low": 2.0, "close": 2.0, "volume": 1.0},
        ]
        gaps = coverage_gaps(candles, "1m")
        self.assertTrue(any(gap["fromTime"] == 60 for gap in gaps))

    def test_untimed_excluded(self):
        self.assertEqual(build_candles([], "5m"), [])


class TestCollectPos(unittest.TestCase):
    def test_newest_first_window_is_reversed(self):
        window = [{"id": "newest"}, {"id": "mid"}, {"id": "oldest"}]
        out = assign_window_positions(window, lambda fill: fill["id"])
        self.assertEqual([fill["id"] for fill, _, _ in out], ["oldest", "mid", "newest"])
        self.assertEqual([pos for _, _, pos in out], [0, 1, 2])

    def test_ohlc_uses_collect_pos_not_dup_seq(self):
        fills = [
            TimedFill(1, 12.0, 1.0, "buy", 120, TIME_SOURCE_VERIFIED_UTC, (1,), 0, collect_pos=1),
            TimedFill(1, 10.0, 1.0, "buy", 120, TIME_SOURCE_VERIFIED_UTC, (2,), 0, collect_pos=0),
        ]
        candles = aggregate_timed_fills(fills, "1m")
        self.assertEqual(len(candles), 1)
        self.assertEqual(candles[0]["open"], 10.0)
        self.assertEqual(candles[0]["close"], 12.0)
        self.assertEqual(candles[0]["high"], 12.0)
        self.assertEqual(candles[0]["low"], 10.0)


if __name__ == "__main__":
    unittest.main()
