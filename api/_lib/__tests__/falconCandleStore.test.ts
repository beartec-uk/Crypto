import { describe, expect, it } from 'vitest';
import {
  FALCON_UPSERT_BATCH_SIZE,
  READ_NEWEST_CANDLES_SQL,
  attachInitRetry,
  buildCandleUpsertSql,
  chunkArray,
} from '../falconCandleStore';

describe('falcon candle store helpers', () => {
  it('chunks upserts into bounded multi-row batches', () => {
    expect(chunkArray([], 200)).toEqual([]);
    expect(chunkArray([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    expect(chunkArray(Array.from({ length: 201 }, (_, i) => i), FALCON_UPSERT_BATCH_SIZE)).toHaveLength(2);
    expect(buildCandleUpsertSql(2)).toContain('($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())');
    expect(buildCandleUpsertSql(2)).toContain('($10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())');
    expect(buildCandleUpsertSql(2)).toContain('ON CONFLICT (pair, timeframe, bucket_time)');
  });

  it('reads newest N buckets then returns them oldest to newest', () => {
    expect(READ_NEWEST_CANDLES_SQL).toMatch(/ORDER BY bucket_time DESC/);
    expect(READ_NEWEST_CANDLES_SQL).toMatch(/ORDER BY bucket_time ASC/);
    expect(READ_NEWEST_CANDLES_SQL).toMatch(/LIMIT \$3/);
  });

  it('clears a rejected init promise so the next caller retries', async () => {
    let cleared = false;
    const failed = attachInitRetry(Promise.reject(new Error('neon down')), () => {
      cleared = true;
    });
    await expect(failed).rejects.toThrow('neon down');
    expect(cleared).toBe(true);
  });
});
