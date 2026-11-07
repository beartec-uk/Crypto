// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { getPool } from './db.js';
import type { FalconCandleRow, FalconCoverageMeta } from './falconTimeQuality.js';

export type { FalconCandleRow, FalconCoverageMeta };

export const FALCON_UPSERT_BATCH_SIZE = 200;

export const READ_NEWEST_CANDLES_SQL = `
  SELECT bucket_time AS time, open, high, low, close, volume, fill_count AS "fillCount"
  FROM (
    SELECT bucket_time, open, high, low, close, volume, fill_count
    FROM falcon_candles
    WHERE pair = $1 AND timeframe = $2
    ORDER BY bucket_time DESC
    LIMIT $3
  ) newest
  ORDER BY bucket_time ASC
`;

let ready: Promise<void> | null = null;

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) {
    out.push(items.slice(i, i + n));
  }
  return out;
}

export function buildCandleUpsertSql(rowCount: number): string {
  const placeholders = Array.from({ length: rowCount }, (_, i) => {
    const b = i * 9;
    return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},NOW())`;
  }).join(',');
  return `INSERT INTO falcon_candles
        (pair, timeframe, bucket_time, open, high, low, close, volume, fill_count, updated_at)
       VALUES ${placeholders}
       ON CONFLICT (pair, timeframe, bucket_time) DO UPDATE SET
         open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low, close=EXCLUDED.close,
         volume=EXCLUDED.volume, fill_count=EXCLUDED.fill_count, updated_at=NOW()`;
}

export function attachInitRetry<T>(promise: Promise<T>, clear: () => void): Promise<T> {
  return promise.catch((err) => {
    clear();
    throw err;
  });
}

async function migrateCoveragePrimaryKey(): Promise<void> {
  const { rows } = await getPool().query<{ column_name: string }>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'falcon_candle_coverage'`,
  );
  const cols = new Set(rows.map((r) => r.column_name));
  if (!cols.size || cols.has('timeframe')) return;
  await getPool().query(
    `ALTER TABLE falcon_candle_coverage ADD COLUMN timeframe TEXT NOT NULL DEFAULT ''`,
  );
  await getPool().query(`
    DO $$
    DECLARE pk text;
    BEGIN
      SELECT c.conname INTO pk
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'falcon_candle_coverage' AND c.contype = 'p';
      IF pk IS NOT NULL THEN
        EXECUTE format('ALTER TABLE falcon_candle_coverage DROP CONSTRAINT %I', pk);
      END IF;
    END $$;
  `);
  await getPool().query(
    `ALTER TABLE falcon_candle_coverage ADD PRIMARY KEY (pair, timeframe)`,
  );
}

export function ensureFalconCandleTables(): Promise<void> {
  if (!ready) {
    ready = attachInitRetry(
      (async () => {
        await getPool().query(`
        CREATE TABLE IF NOT EXISTS falcon_candles (
          pair TEXT NOT NULL,
          timeframe TEXT NOT NULL,
          bucket_time BIGINT NOT NULL,
          open DOUBLE PRECISION NOT NULL,
          high DOUBLE PRECISION NOT NULL,
          low DOUBLE PRECISION NOT NULL,
          close DOUBLE PRECISION NOT NULL,
          volume DOUBLE PRECISION NOT NULL,
          fill_count INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (pair, timeframe, bucket_time)
        );
        CREATE TABLE IF NOT EXISTS falcon_candle_coverage (
          pair TEXT NOT NULL,
          timeframe TEXT NOT NULL DEFAULT '5m',
          meta JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (pair, timeframe)
        );
      `);
        await migrateCoveragePrimaryKey();
      })(),
      () => {
        ready = null;
      },
    );
  }
  return ready;
}

export async function upsertCandles(
  pair: string,
  timeframe: string,
  candles: FalconCandleRow[],
): Promise<number> {
  await ensureFalconCandleTables();
  let n = 0;
  for (const batch of chunkArray(candles, FALCON_UPSERT_BATCH_SIZE)) {
    const values: unknown[] = [];
    for (const c of batch) {
      values.push(
        pair,
        timeframe,
        c.time,
        c.open,
        c.high,
        c.low,
        c.close,
        c.volume,
        c.fillCount,
      );
    }
    await getPool().query(buildCandleUpsertSql(batch.length), values);
    n += batch.length;
  }
  return n;
}

export async function saveCoverage(
  pair: string,
  timeframe: string,
  meta: FalconCoverageMeta,
): Promise<void> {
  await ensureFalconCandleTables();
  await getPool().query(
    `INSERT INTO falcon_candle_coverage(pair, timeframe, meta, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (pair, timeframe) DO UPDATE SET meta=EXCLUDED.meta, updated_at=NOW()`,
    [pair, timeframe, JSON.stringify({ ...meta, pair, timeframe })],
  );
}

export async function readCandles(
  pair: string,
  timeframe: string,
  limit = 500,
): Promise<{ candles: FalconCandleRow[]; coverage: FalconCoverageMeta | null; emptyReason: string | null }> {
  await ensureFalconCandleTables();
  const { rows } = await getPool().query(
    READ_NEWEST_CANDLES_SQL,
    [pair, timeframe, Math.min(Math.max(limit, 1), 5000)],
  );
  const cov = await getPool().query(
    `SELECT meta FROM falcon_candle_coverage WHERE pair=$1 AND timeframe=$2`,
    [pair, timeframe],
  );
  const coverage = (cov.rows[0]?.meta as FalconCoverageMeta) || null;
  const candles = rows.map((r: any) => ({
    time: Number(r.time),
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: Number(r.volume),
    fillCount: Number(r.fillCount),
  }));
  let emptyReason: string | null = null;
  if (!candles.length) {
    const hint = coverage?.emptyReasonHint;
    emptyReason = hint && hint !== 'no_canonical_block_time'
      ? hint
      : (coverage ? 'verified_utc_unavailable' : 'no_ingest_yet');
  }
  return { candles, coverage, emptyReason };
}
