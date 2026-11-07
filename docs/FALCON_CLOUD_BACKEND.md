# Falcon Cloud backend connection (BearTec Crypto)

## What this PR adds
Server-only Falcon Cloud RPC integration for BearTec Crypto:

| Path | Role |
|------|------|
| `api/_lib/falconCloudClient.ts` | Shared client (Bearer `FALCON_CLOUD_API_KEY`, object JSON-RPC params, short in-memory cache, 429 backoff) |
| `GET /api/crypto/falcon/status` | Sanitized tip/network + usage metadata (no secret echo) |
| `GET /api/crypto/falcon/orderbook?pair=&levels=` | Live CLOB depth + AMM spot |
| `GET /api/crypto/falcon/fills?pair=&account=&limit=` | Recent fills window |

Express (`server/routes.ts`) bridges the same paths for local `npm run dev`.

## Env
- **Name:** `FALCON_CLOUD_API_KEY`
- **Scope:** server-only (Vercel Production / Preview / Development). Never `NEXT_PUBLIC_` / `VITE_`.
- **Gateway:** `https://rpc.falcon-fpl.com` (`POST /v1/rpc`, `GET /v1/usage`)

## Confirmed `fpl_fills` schema (live, 2026-11-06)
Params (object): `pair?`, `account?`, `limit?` (≤200). Newest first.

Fill object fields observed:
`asset`, `base`, `height`, `maker`, `price`, `quote`, `side`, `taker`, `taker_order`.

**Pagination:** no working `offset` / `cursor` / `beforeHeight`. Only a recent window. Historical persistence is required before chart candles.

## Existing UI / chart support — remaining gaps (truthful)
| Area | Status |
|------|--------|
| Binance klines in `api/crypto/data.ts` | **Unchanged** — still Binance; not Falcon |
| `server/lib/indicators.ts` Candle OHLCV | Still expects stored/fetched candles; no Falcon adapter wired |
| Falcon order book UI | Not built in this PR (backend feed only) |
| Falcon fill → candle aggregation | **Not a verified UTC chart.** Draft #618 stores coverage labels; it does not publish UTC buckets. See `docs/FALCON_CANDLES_TICKER.md`. |
| Artificial volume / Binance masquerading as Falcon | **Explicitly refused** |

Safe next steps after merge: poll `fpl_fills` + `fpl_orderBook` into storage, derive OHLCV only from real fills/AMM prints, then optionally add a Falcon source switch in chart APIs without renaming Binance data.

## Security
- Key never returned by API routes.
- Usage `key_id` is replaced with `<present>` in responses.
- Do not log Authorization headers or env values.

## Persistent fills store (beartec-brain)

Ops chose **existing beartec-brain** over a new Vercel/hosted DB to avoid a new bill.
Collector sources live under `tools/falcon-fills-store/` (deployed to brain; not required for Vercel runtime).

| Item | Value |
|------|-------|
| Host | `beartec-brain` (Tailscale) |
| Service | `falcon-fills-store.timer` → oneshot every 60s |
| DB | `/var/lib/falcon-fills-store/fills.sqlite` (WAL) |
| Config | `/etc/falcon-fills-store/env` (`FALCON_CLOUD_API_KEY`, mode 640) |
| User | `falcon-fills` (nologin, least privilege) |
| Pairs | allowlisted `BTC4`, `USDC` |
| Dedup | natural Fill key incl. `ifnull(taker_order/maker_order,-1)` |
| Block time | **NULL.** Physics ms and observer arrival are not UTC. Verified UTC candles are not enabled. |
| BearTec HTTP read | **Pending** — no public/Funnel port opened |

Quota estimate ≈ 2 fills RPC/min + status every 10 cycles ≈ **~90k units/month** (Free 300k).
Backups: `falcon-fills-backup.timer` daily, keep 7 under `/var/lib/falcon-fills-store/backups/`.
