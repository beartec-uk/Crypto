#!/usr/bin/env python3
# Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
"""OHLCV helpers and honest seal-time classification.

Aligned with Falcon-faucet-wallet #187 `honestSealTimes` (draft head 6c10e19):

  sealed_at ISO is emitted only when signed UTC quality is utc_committed.
  sealed_at_ms / tip_sealed_at_ms / last_pack_at_ms are chain physics.
  They are never converted with Date() and never treated as wall-clock UTC.
  observed_at / first_seen_at are observer arrival, not trade time.

Chart mode is estimated_observer: published candles are bucketed by observer
arrival (observed_at / first_seen_at), labelled observer, and are not trade time.
Verified UTC candles stay disabled until protocol activation is signed off and a
hash-bound identity→committed-UTC source exists. Network 2300 cannot arm UTC.
A parseable sealed_at is not verified UTC. Height-only matching is not that
identity source. Physics ms is never a candle clock.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping

INTERVAL_SEC = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
}

# Public qualities. `verified_utc` is reserved and is not emitted here.
TIME_QUALITY_CHAIN_PHYSICS = "chain_physics"
TIME_QUALITY_OBSERVER = "observer"
TIME_QUALITY_UNAVAILABLE = "unavailable"
TIME_QUALITY_UTC_COMMITTED = "utc_committed"
TIME_QUALITY_VERIFIED_UTC = "verified_utc"

TIME_SOURCE_CHAIN_PHYSICS = "chain_physics"
TIME_SOURCE_OBSERVER = "observer"
TIME_SOURCE_NONE = "none"
TIME_SOURCE_SIGNED_UTC_V5 = "signed_utc_v5"
TIME_SOURCE_VERIFIED_UTC = "verified_utc"

# Retired. `canonical_sealed` treated any parseable sealed_at as verified UTC.
# `estimated_observation` reads like a trade-time estimate; observer arrival is not one.
# `explorer.sealed_at` was the old OHLCV source token for that mistake.
RETIRED_TIME_QUALITY = {
    "canonical_sealed": TIME_QUALITY_UNAVAILABLE,
    "estimated_observation": TIME_QUALITY_OBSERVER,
}
RETIRED_TIME_SOURCE = "explorer.sealed_at"

PUBLIC_TIME_QUALITIES = frozenset(
    {
        TIME_QUALITY_CHAIN_PHYSICS,
        TIME_QUALITY_OBSERVER,
        TIME_QUALITY_UNAVAILABLE,
        TIME_QUALITY_UTC_COMMITTED,
    }
)
PUBLIC_TIME_SOURCES = frozenset(
    {
        TIME_SOURCE_CHAIN_PHYSICS,
        TIME_SOURCE_OBSERVER,
        TIME_SOURCE_NONE,
        TIME_SOURCE_SIGNED_UTC_V5,
    }
)

# Verified UTC admission stays off. Estimated observer bars are a separate chart.
CHART_MODE = "estimated_observer"
VERIFIED_UTC_BUCKETS_ENABLED = False
NETWORK_UTC_ACTIVATION_DISABLED = 2300

PHYSICS_MS_KEYS = ("sealed_at_ms", "tip_sealed_at_ms", "last_pack_at_ms")
UTC_MS_KEYS = ("sealed_utc_ms", "tip_sealed_utc_ms")

# Backward-compatible names. Neither is an accepted OHLCV source anymore.
CANONICAL_OHLCV_SOURCE = RETIRED_TIME_SOURCE
OBSERVATION_ONLY_SOURCE = TIME_SOURCE_OBSERVER


def parse_iso_to_unix(iso: str | None) -> int | None:
    """Diagnostic parse. Not used to admit a verified UTC bucket."""
    state, unix = _parse_iso(iso, require_offset=False)
    if state == "ok":
        return unix
    return None


def _parse_iso(iso: str | None, *, require_offset: bool) -> tuple[str, int | None]:
    if iso is None:
        return "missing", None
    if not isinstance(iso, str):
        return "malformed", None
    s = iso.strip()
    if not s:
        return "missing", None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    if require_offset and re.search(r"[+-]\d\d:\d\d$", s) is None:
        return "malformed", None
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return "malformed", None
    if dt.tzinfo is None:
        if require_offset:
            return "malformed", None
        dt = dt.replace(tzinfo=timezone.utc)
    return "ok", int(dt.timestamp())


def _ms_state(value: Any) -> tuple[str, int | None]:
    if value is None:
        return "missing", None
    if isinstance(value, bool):
        return "malformed", None
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return "missing", None
        if re.fullmatch(r"-?\d+", s) is None:
            return "malformed", None
        value = int(s)
    elif isinstance(value, float):
        if not math.isfinite(value) or not value.is_integer():
            return "malformed", None
        value = int(value)
    if not isinstance(value, int):
        return "malformed", None
    if value == 0:
        return "zero", None
    if value < 0:
        return "malformed", None
    return "ok", value


def _first_present_ms(raw: Mapping[str, Any], keys: tuple[str, ...]) -> tuple[str, int | None]:
    for key in keys:
        if key not in raw or raw[key] is None:
            continue
        return _ms_state(raw[key])
    return "missing", None


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    s = value.strip()
    return s or None


def _network_id(raw: Mapping[str, Any]) -> int | None:
    value = raw.get("network_id", raw.get("networkId"))
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    if isinstance(value, int):
        return value
    if isinstance(value, float) and math.isfinite(value) and value.is_integer():
        return int(value)
    return None


def _utc_activated(raw: Mapping[str, Any]) -> bool | None:
    if "utc_activated" in raw:
        value = raw.get("utc_activated")
    elif "utcActivated" in raw:
        value = raw.get("utcActivated")
    else:
        return None
    if isinstance(value, bool):
        return value
    return None


def normalize_time_quality(value: str | None) -> str:
    """Map stored labels onto the public set. Never returns verified_utc."""
    if not value or not isinstance(value, str):
        return TIME_QUALITY_UNAVAILABLE
    token = value.strip()
    if token in RETIRED_TIME_QUALITY:
        return RETIRED_TIME_QUALITY[token]
    # Reserved label. This package does not present verified UTC.
    if token == TIME_QUALITY_VERIFIED_UTC:
        return TIME_QUALITY_UNAVAILABLE
    if token in PUBLIC_TIME_QUALITIES:
        return token
    return TIME_QUALITY_UNAVAILABLE


def normalize_time_source(value: str | None) -> str:
    """Honest source tokens only. The retired explorer.sealed_at token becomes none."""
    if not value or not isinstance(value, str):
        return TIME_SOURCE_NONE
    token = value.strip()
    if token in (RETIRED_TIME_SOURCE, TIME_SOURCE_VERIFIED_UTC, ""):
        return TIME_SOURCE_NONE
    if token in PUBLIC_TIME_SOURCES:
        return token
    return TIME_SOURCE_NONE


@dataclass(frozen=True)
class SealClassification:
    """One block or tip. bucket_unix is the verified-UTC candle time, or None.

    emitted_iso is always None: this package does not render physics or
    uncommitted stamps as UTC ISO.
    """

    time_quality: str
    time_source: str
    verified_utc: bool
    bucket_unix: int | None
    pre_activation: bool
    reason: str
    reported_utc_quality: str | None
    physics_ms: int | None
    observer_unix: int | None
    utc_candidate_unix: int | None
    identity_bound: bool
    emitted_iso: str | None = None

    def public_dict(self) -> dict[str, Any]:
        return {
            "timeQuality": self.time_quality,
            "timeSource": self.time_source,
            "verifiedUtc": self.verified_utc,
            "bucketUnix": self.bucket_unix,
            "preActivation": self.pre_activation,
            "reason": self.reason,
            "reportedUtcQuality": self.reported_utc_quality,
            "utcCandidateUnix": self.utc_candidate_unix,
            "identityBound": self.identity_bound,
            "emittedIso": self.emitted_iso,
        }


def _finish(
    *,
    time_quality: str,
    time_source: str,
    pre_activation: bool,
    reason: str,
    reported_utc_quality: str | None,
    physics_ms: int | None,
    observer_unix: int | None,
    utc_candidate_unix: int | None,
) -> SealClassification:
    # Admission is impossible in this package: the gate is off and identity
    # is not hash-bound. Keep the predicate visible so a later edit cannot
    # bucket from a parseable ISO by accident.
    identity_bound = False
    admit = bool(
        VERIFIED_UTC_BUCKETS_ENABLED
        and time_quality == TIME_QUALITY_UTC_COMMITTED
        and time_source == TIME_SOURCE_SIGNED_UTC_V5
        and utc_candidate_unix is not None
        and not pre_activation
        and identity_bound
    )
    return SealClassification(
        time_quality=TIME_QUALITY_VERIFIED_UTC if admit else time_quality,
        time_source=TIME_SOURCE_VERIFIED_UTC if admit else time_source,
        verified_utc=admit,
        bucket_unix=utc_candidate_unix if admit else None,
        pre_activation=pre_activation,
        reason=reason,
        reported_utc_quality=reported_utc_quality,
        physics_ms=physics_ms,
        observer_unix=observer_unix,
        utc_candidate_unix=utc_candidate_unix,
        identity_bound=identity_bound,
        emitted_iso=None,
    )


def classify_seal_time(raw: Mapping[str, Any] | None) -> SealClassification:
    """Classify one explorer block or node tip. Never Date(physics_ms).

    A parseable sealed_at is not verified UTC. utc_committed is preserved as a
    candidate label only; it still does not open a verified bucket.
    """
    src: Mapping[str, Any] = raw or {}
    physics_state, physics_ms = _first_present_ms(src, PHYSICS_MS_KEYS)
    utc_state, utc_ms = _first_present_ms(src, UTC_MS_KEYS)
    reported = _text(src.get("sealed_utc_quality")) or _text(src.get("tip_sealed_utc_quality"))
    quality = reported or "unavailable"
    source_in = _text(src.get("sealed_utc_source"))
    sealed_at_state, sealed_at_unix = _parse_iso(
        src.get("sealed_at") if isinstance(src.get("sealed_at"), str) or src.get("sealed_at") is None else "",
        require_offset=True,
    )
    # Non-string sealed_at (numbers, objects) is malformed, not a timestamp.
    if "sealed_at" in src and src.get("sealed_at") is not None and not isinstance(src.get("sealed_at"), str):
        sealed_at_state = "malformed"
    sealed_utc_state, sealed_utc_unix = _parse_iso(
        src.get("sealed_utc") if isinstance(src.get("sealed_utc"), str) or src.get("sealed_utc") is None else "",
        require_offset=True,
    )
    if "sealed_utc" in src and src.get("sealed_utc") is not None and not isinstance(src.get("sealed_utc"), str):
        sealed_utc_state = "malformed"

    observed_state, observed_unix = _parse_iso(
        src.get("observed_at") if isinstance(src.get("observed_at"), str) else None,
        require_offset=False,
    )
    if observed_state != "ok":
        fs_state, fs_unix = _parse_iso(
            src.get("first_seen_at") if isinstance(src.get("first_seen_at"), str) else None,
            require_offset=False,
        )
        if observed_state == "missing":
            observed_state, observed_unix = fs_state, fs_unix
        elif fs_state == "malformed" and observed_state != "malformed":
            observed_state = "malformed"

    network = _network_id(src)
    activated = _utc_activated(src)
    # Network 2300 ignores activation overrides. Any other network is armed
    # only by an explicit true flag. Missing flag is not armed.
    if network == NETWORK_UTC_ACTIVATION_DISABLED:
        activation_armed = False
    else:
        activation_armed = activated is True
    pre_activation = not activation_armed

    iso_malformed = sealed_at_state == "malformed" or sealed_utc_state == "malformed"
    iso_values = [u for state, u in ((sealed_at_state, sealed_at_unix), (sealed_utc_state, sealed_utc_unix)) if state == "ok"]
    candidate_unix = (utc_ms // 1000) if utc_state == "ok" and utc_ms is not None else None
    iso_mismatch = bool(iso_values) and candidate_unix is not None and any(u != candidate_unix for u in iso_values)
    iso_present = sealed_at_state != "missing" or sealed_utc_state != "missing"

    utc_candidate = (
        quality == TIME_QUALITY_UTC_COMMITTED
        and utc_state == "ok"
        and source_in == TIME_SOURCE_SIGNED_UTC_V5
        and candidate_unix is not None
        and not iso_malformed
        and not iso_mismatch
    )

    physics_malformed = physics_state == "malformed"
    any_malformed = iso_malformed or utc_state == "malformed" or physics_malformed or observed_state == "malformed"

    if utc_candidate:
        if pre_activation:
            reason = "pre_activation"
        elif not VERIFIED_UTC_BUCKETS_ENABLED:
            reason = "verified_utc_not_enabled"
        else:
            reason = "identity_not_bound"
        return _finish(
            time_quality=TIME_QUALITY_UTC_COMMITTED,
            time_source=TIME_SOURCE_SIGNED_UTC_V5,
            pre_activation=pre_activation,
            reason=reason,
            reported_utc_quality=reported,
            physics_ms=physics_ms,
            observer_unix=observed_unix if observed_state == "ok" else None,
            utc_candidate_unix=candidate_unix,
        )

    if physics_ms is not None:
        parsed_sealed = sealed_at_state == "ok"
        return _finish(
            time_quality=TIME_QUALITY_CHAIN_PHYSICS,
            time_source=TIME_SOURCE_CHAIN_PHYSICS,
            pre_activation=pre_activation,
            reason="physics_iso_rejected" if parsed_sealed else "chain_physics",
            reported_utc_quality=reported,
            physics_ms=physics_ms,
            observer_unix=observed_unix if observed_state == "ok" else None,
            utc_candidate_unix=None,
        )

    if quality == TIME_QUALITY_UTC_COMMITTED and utc_state == "ok":
        if iso_mismatch:
            reason = "sealed_at_disagrees"
        elif iso_malformed:
            reason = "malformed_time"
        else:
            reason = "utc_not_committed"
        return _finish(
            time_quality=TIME_QUALITY_UNAVAILABLE,
            time_source=TIME_SOURCE_NONE,
            pre_activation=pre_activation,
            reason=reason,
            reported_utc_quality=reported,
            physics_ms=None,
            observer_unix=None,
            utc_candidate_unix=None,
        )

    if utc_state == "zero":
        return _finish(
            time_quality=TIME_QUALITY_UNAVAILABLE,
            time_source=TIME_SOURCE_NONE,
            pre_activation=pre_activation,
            reason="zero_utc",
            reported_utc_quality=reported,
            physics_ms=None,
            observer_unix=None,
            utc_candidate_unix=None,
        )

    if any_malformed or (iso_present and iso_malformed):
        return _finish(
            time_quality=TIME_QUALITY_UNAVAILABLE,
            time_source=TIME_SOURCE_NONE,
            pre_activation=pre_activation,
            reason="malformed_time",
            reported_utc_quality=reported,
            physics_ms=None,
            observer_unix=None,
            utc_candidate_unix=None,
        )

    if sealed_at_state == "ok" or sealed_utc_state == "ok":
        return _finish(
            time_quality=TIME_QUALITY_UNAVAILABLE,
            time_source=TIME_SOURCE_NONE,
            pre_activation=pre_activation,
            reason="sealed_at_not_verified_utc",
            reported_utc_quality=reported,
            physics_ms=None,
            observer_unix=None,
            utc_candidate_unix=None,
        )

    if observed_state == "ok":
        return _finish(
            time_quality=TIME_QUALITY_OBSERVER,
            time_source=TIME_SOURCE_OBSERVER,
            pre_activation=pre_activation,
            reason="observer_not_trade_time",
            reported_utc_quality=reported,
            physics_ms=None,
            observer_unix=observed_unix,
            utc_candidate_unix=None,
        )

    other_quality = bool(reported) and reported not in (TIME_QUALITY_UNAVAILABLE, TIME_QUALITY_UTC_COMMITTED)
    utc_ms_uncommitted = utc_state == "ok" and quality != TIME_QUALITY_UTC_COMMITTED
    if network == NETWORK_UTC_ACTIVATION_DISABLED and (utc_ms_uncommitted or other_quality or activated is False and utc_state == "ok"):
        reason = "pre_activation"
    elif activated is False and utc_state == "ok":
        reason = "pre_activation"
    elif other_quality or utc_ms_uncommitted:
        reason = "pre_activation"
    else:
        reason = "missing_utc"
    return _finish(
        time_quality=TIME_QUALITY_UNAVAILABLE,
        time_source=TIME_SOURCE_NONE,
        pre_activation=pre_activation,
        reason=reason,
        reported_utc_quality=reported,
        physics_ms=None,
        observer_unix=None,
        utc_candidate_unix=None,
    )


def resolve_ohlcv_block_unix(sealed_at: str | None) -> tuple[int | None, str | None]:
    """Verified bucket time from a sealed_at string alone.

    Always (None, None). A parseable ISO is not verified UTC. Callers that
    still pass only sealed_at must not regain a candle clock.
    """
    _ = sealed_at
    return None, None


def resolve_observation_unix(observed_at: str | None) -> tuple[int | None, str | None]:
    """Observer arrival, diagnostics only. Not a candle time."""
    unix = parse_iso_to_unix(observed_at)
    if unix is None:
        return None, None
    return unix, TIME_SOURCE_OBSERVER


def resolve_block_unix(sealed_at: str | None, observed_at: str | None) -> tuple[int | None, str | None]:
    """Compat wrapper. Neither argument can produce an OHLCV time."""
    _ = observed_at
    return resolve_ohlcv_block_unix(sealed_at)


def bucket_start(unix_sec: int, interval: str) -> int:
    step = INTERVAL_SEC[interval]
    return unix_sec - (unix_sec % step)


@dataclass(frozen=True)
class TimedFill:
    height: int
    price: float  # FPL per whole base
    base_units: float  # whole base
    side: str
    unix: int
    time_source: str
    natural_key: tuple
    dup_seq: int
    collect_pos: int = 0


def assign_dup_seq(fills: list[dict[str, Any]], key_fn) -> list[tuple[dict[str, Any], int]]:
    """Preserve multiplicity: identical natural keys in one batch get dup_seq 0..n-1."""
    counts: dict[Any, int] = {}
    out: list[tuple[dict[str, Any], int]] = []
    for fill in fills:
        key = key_fn(fill)
        seq = counts.get(key, 0)
        counts[key] = seq + 1
        out.append((fill, seq))
    return out


def assign_window_positions(
    fills_newest_first: list[dict[str, Any]],
    key_fn,
) -> list[tuple[dict[str, Any], int, int]]:
    """Assign collector-observed positions for a newest-first RPC window.

    Live fpl_fills returns newest first and has no protocol timestamp or
    stable in-block trade id. Reverse the window so lower collect_pos is
    earlier in this poll. That is collector order, not chain chronology.
    dup_seq stays multiplicity only.
    """
    oldest_first = list(reversed(fills_newest_first))
    sequenced = assign_dup_seq(oldest_first, key_fn)
    return [(fill, dup_seq, i) for i, (fill, dup_seq) in enumerate(sequenced)]


def _fold_fills(fills: Iterable[TimedFill], interval: str, wanted: str, quality: str, source: str) -> list[dict[str, Any]]:
    if interval not in INTERVAL_SEC:
        raise ValueError(f"unsupported interval {interval}")
    safe = [f for f in fills if f.time_source == wanted and f.unix > 0]
    buckets: dict[int, list[TimedFill]] = {}
    for fill in safe:
        start = bucket_start(fill.unix, interval)
        buckets.setdefault(start, []).append(fill)
    candles: list[dict[str, Any]] = []
    for start in sorted(buckets):
        rows = sorted(buckets[start], key=lambda f: (f.unix, f.height, f.collect_pos, f.dup_seq))
        candles.append(
            {
                "time": start,
                "open": rows[0].price,
                "high": max(row.price for row in rows),
                "low": min(row.price for row in rows),
                "close": rows[-1].price,
                "volume": sum(row.base_units for row in rows),
                "fillCount": len(rows),
                "timeQuality": quality,
                "timeSource": source,
            }
        )
    return candles


def aggregate_timed_fills(fills: Iterable[TimedFill], interval: str) -> list[dict[str, Any]]:
    """OHLC fold for fills already tagged verified_utc.

    Physics, observer, and retired explorer.sealed_at rows are excluded.
    Not used for published candles while VERIFIED_UTC_BUCKETS_ENABLED is false.
    """
    return _fold_fills(fills, interval, TIME_SOURCE_VERIFIED_UTC, TIME_QUALITY_VERIFIED_UTC, TIME_SOURCE_VERIFIED_UTC)


def aggregate_observer_fills(fills: Iterable[TimedFill], interval: str) -> list[dict[str, Any]]:
    """OHLC fold for observer-arrival fills. Not trade time and not verified UTC."""
    return _fold_fills(fills, interval, TIME_SOURCE_OBSERVER, TIME_QUALITY_OBSERVER, TIME_SOURCE_OBSERVER)


def build_candles(fills: Iterable[TimedFill], interval: str) -> list[dict[str, Any]]:
    """Published candles. Estimated observer bars, or verified UTC if that gate is on."""
    if interval not in INTERVAL_SEC:
        raise ValueError(f"unsupported interval {interval}")
    if VERIFIED_UTC_BUCKETS_ENABLED:
        return aggregate_timed_fills(fills, interval)
    if CHART_MODE == "estimated_observer":
        return aggregate_observer_fills(fills, interval)
    return []


def coverage_gaps(candles: list[dict[str, Any]], interval: str) -> list[dict[str, Any]]:
    """Report missing buckets between first and last candle (empty states)."""
    if len(candles) < 2:
        return []
    step = INTERVAL_SEC[interval]
    gaps = []
    times = [c["time"] for c in candles]
    for left, right in zip(times, times[1:]):
        expect = left + step
        if right > expect:
            gaps.append({"fromTime": expect, "toTime": right - step, "reason": "no_timed_fills_in_bucket"})
    return gaps


def summarize_classifications(rows: Iterable[SealClassification]) -> dict[str, Any]:
    """Pair-level label. Mixed evidence stays unavailable so one candidate cannot paint the set as UTC."""
    items = list(rows)
    counts: Counter[str] = Counter(normalize_time_quality(row.time_quality) for row in items)
    if not items:
        return {
            "timeQuality": TIME_QUALITY_UNAVAILABLE,
            "timeSource": TIME_SOURCE_NONE,
            "verifiedUtc": False,
            "evidenceCounts": {},
        }
    sources = {normalize_time_source(row.time_source) for row in items}
    if len(counts) == 1:
        quality = next(iter(counts))
        source = next(iter(sources)) if len(sources) == 1 else TIME_SOURCE_NONE
    else:
        quality = TIME_QUALITY_UNAVAILABLE
        source = TIME_SOURCE_NONE
    if quality == TIME_QUALITY_VERIFIED_UTC or any(row.verified_utc for row in items):
        quality = TIME_QUALITY_UNAVAILABLE
        source = TIME_SOURCE_NONE
    return {
        "timeQuality": quality,
        "timeSource": source,
        "verifiedUtc": False,
        "evidenceCounts": {key: int(counts[key]) for key in sorted(counts)},
    }
