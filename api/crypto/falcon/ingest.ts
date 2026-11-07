// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
/**
 * Authenticated ingest from beartec-brain (server-to-server).
 * Authorization: Bearer $FALCON_BRAIN_INGEST_TOKEN
 * No public brain port; brain pushes outbound to this route.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { saveCoverage, upsertCandles, type FalconCandleRow } from '../../_lib/falconCandleStore.js';
import { normalizeFalconSymbol } from '../../_lib/falconMarkets.js';
import { decideCandleIngest, FALCON_CANDLE_TIMEFRAMES, parseFalconTimeframe } from '../../_lib/falconTimeQuality.js';
import crypto from 'crypto';

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function authorized(req: VercelRequest): boolean {
  const expected = process.env.FALCON_BRAIN_INGEST_TOKEN?.trim();
  if (!expected) return false;
  const hdr = String(req.headers.authorization || '');
  if (!hdr.startsWith('Bearer ')) return false;
  const got = hdr.slice(7).trim();
  return timingSafeEqualStr(got, expected);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', 'null');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const pair = normalizeFalconSymbol(body.pair || '');
  if (!pair) return res.status(400).json({ error: 'invalid pair' });
  const timeframe = parseFalconTimeframe(body.timeframe ?? '');
  if (!timeframe) {
    return res.status(400).json({
      error: 'unsupported_timeframe',
      supported: FALCON_CANDLE_TIMEFRAMES,
    });
  }
  const coverageTf = body.coverage && typeof body.coverage.timeframe === 'string'
    ? body.coverage.timeframe.trim()
    : '';
  if (coverageTf && coverageTf !== timeframe) {
    return res.status(400).json({ error: 'coverage_timeframe_mismatch' });
  }
  const candlesIn = Array.isArray(body.candles) ? body.candles : [];
  if (candlesIn.length > 5000) return res.status(413).json({ error: 'too many candles' });

  const candles: FalconCandleRow[] = [];
  for (const c of candlesIn) {
    const time = Number(c.time);
    const open = Number(c.open);
    const high = Number(c.high);
    const low = Number(c.low);
    const close = Number(c.close);
    const volume = Number(c.volume);
    const fillCount = Number(c.fillCount ?? c.fill_count ?? 0);
    if (![time, open, high, low, close, volume].every(Number.isFinite)) {
      return res.status(400).json({ error: 'invalid candle numeric fields' });
    }
    if (time <= 0) return res.status(400).json({ error: 'candle time must be unix seconds > 0' });
    candles.push({ time, open, high, low, close, volume, fillCount });
  }

  const decision = decideCandleIngest(pair, candles, body.coverage);
  if (!decision.ok) {
    return res.status(decision.status).json({ error: decision.error });
  }
  try {
    const n = await upsertCandles(pair, timeframe, decision.candles);
    if (decision.coverage) {
      await saveCoverage(pair, timeframe, { ...decision.coverage, timeframe });
    }
    return res.status(200).json({
      ok: true,
      pair,
      timeframe,
      upserted: n,
      timeQuality: decision.coverage?.timeQuality ?? 'unavailable',
      timeSource: decision.coverage?.timeSource ?? 'none',
      verifiedUtc: false,
    });
  } catch (err: any) {
    console.error('falcon ingest failed', err?.message || err);
    return res.status(500).json({ error: 'ingest failed' });
  }
}
