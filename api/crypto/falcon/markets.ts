// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FALCON_DEFAULT_MARKET, FALCON_MARKET_LIST } from '../../_lib/falconMarkets.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(200).json({
    networkId: 2300,
    testnet: true,
    notice: 'Falcon PL testnet — tokens have no monetary value.',
    defaultMarket: FALCON_DEFAULT_MARKET,
    markets: FALCON_MARKET_LIST,
  });
}
