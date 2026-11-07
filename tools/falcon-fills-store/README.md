# Falcon fills store (beartec-brain)

Persistent trade/fill collection for Falcon Cloud Free API onto **existing** `beartec-brain` capacity.

## Cost (honest)
- **No new subscription / hosted DB.** Uses disk + a tiny Python oneshot timer already on the machine.
- **Not literally free forever:** burns a slice of Free RPC monthly units and a little CPU/disk on brain. At default 60s × 2 pairs (+ status every 10 cycles) ≈ **~90k units/month**, well under Free 300k, with headroom for Crypto PR routes.
- Vercel alone is **not** durable storage; a Vercel DB/KV would be a separate bill. This path avoids that.

## Layout
| Path | Purpose |
|------|---------|
| `/usr/local/lib/falcon-fills-store/collector.py` | Stdlib collector |
| `/usr/local/lib/falcon-fills-store/backup.sh` | `sqlite3 .backup` |
| `/etc/falcon-fills-store/env` | `FALCON_CLOUD_API_KEY=…` (mode 640, root:falcon-fills) |
| `/var/lib/falcon-fills-store/fills.sqlite` | WAL database |
| `/var/lib/falcon-fills-store/backups/` | Daily backups, keep 7 |
| `falcon-fills-store.timer` | Every 60s |
| `falcon-fills-backup.timer` | Daily 03:15 UTC |

Service user: `falcon-fills` (nologin). No listen port. No Funnel. No public DB.

## Dedup
Natural key from `fd-pl` `Fill` (`orderbook.rs`):
`height, asset, side, price, base, quote, taker, maker, ifnull(taker_order,-1), ifnull(maker_order,-1)`.

`height+taker_order` alone is **not** unique. Amounts stored as integer strings. Optional `maker_order` included when present (AMM often omits it).

**Gap:** if two distinct on-chain fills ever share every serialized field, `INSERT OR IGNORE` would collapse them. Bounded `raw_poll_snapshots` retained for audit. No invented synthetic IDs.

## Timestamps / candles
`fpl_fills` has **no block timestamp**. `block_time_unix` stays NULL. `first_seen_at` is ingestion only and **must not** be used as OHLCV time. Physics ms is not a validated UTC source. No historical backfill beyond the live 200-fill ring (`RECENT_FILLS`).

## Quota (default)
- Pairs allowlisted: `BTC4`, `USDC`
- `limit=200` each poll
- Interval 60s → ~2 fills RPC/min + ~0.1 status/min ≈ 3k+/day ≈ **90k/month**

## BearTec read access
**Pending.** Store is local to brain (Tailscale). No new unauthenticated HTTP. Wiring Crypto to read history needs an approved authenticated path (e.g. existing operator patterns) — not enabled here.

## Ops
```bash
systemctl status falcon-fills-store.timer
journalctl -u falcon-fills-store.service -n 50 --no-pager
sudo -u falcon-fills sqlite3 /var/lib/falcon-fills-store/fills.sqlite 'SELECT COUNT(*) FROM fills;'
sudo systemctl start falcon-fills-backup.service
```

## Timestamps & candles (honesty contract)
- `fpl_fills` has no trade timestamp. `first_seen_at` is collector arrival, not candle time.
- Explorer tips (`GET /api/v1/explorer/blocks`) are classified with wallet #187 `honestSealTimes` rules. See `docs/FALCON_CANDLES_TICKER.md`.
  - Physics ms (`sealed_at_ms` / `tip_sealed_at_ms` / `last_pack_at_ms`) is `chain_physics`. Never an ISO candle time.
  - `sealed_at` ISO is not verified UTC unless it is the #187 `utc_committed` form, and even then this package does not open a verified bucket.
  - `observed_at` is explorer arrival (`observer`). Not trade time.
- Fills stay `time_status=untimed` and are counted in `coverage.untimedFills`. They are not dropped and not placed on a UTC axis.
- `block_times` is still keyed by height. That join does not admit verified UTC.
- `sync_candles.py` can POST 1m/5m/15m/1h coverage to `/api/crypto/falcon/ingest`. Published candle arrays are empty while verified UTC is disabled. USDC-FPL is exported on its own; empty USDC is not replaced with BTC4. Quote is FPL.
- Dedup unique key includes `dup_seq` so identical full-field fills in one ring snapshot are preserved; raw snapshots remain evidence.
