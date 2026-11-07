// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
/**
 * Falcon PL testnet 2300 market metadata (validated against live
 * fpl_orderBook price_scale / explorer Amount.decimals — 2026-11-06).
 *
 * Price orientation: FPL raw per 1 whole base coin (not inverted).
 * These are TESTNET markets; tokens have no monetary value.
 */

export type FalconMarketId = 'USDC-FPL' | 'BTC4-FPL';

export interface FalconMarket {
  id: FalconMarketId;
  /** Ticker selector value (same as id). */
  symbol: FalconMarketId;
  /** UI label — must state testnet + quote unit. */
  label: string;
  base: string;
  quote: 'FPL';
  /** Whole-coin scale for base asset (10^decimals). */
  baseDecimals: number;
  /** price_scale from order book: FPL raw per 1 whole base. */
  priceScale: number;
  /** FPL amount decimals (explorer uses 0 for FPL raw integers). */
  quoteDecimals: number;
  networkId: 2300;
  testnet: true;
}

/** Default market for Falcon selector. */
export const FALCON_DEFAULT_MARKET: FalconMarketId = 'USDC-FPL';

export const FALCON_MARKETS: Record<FalconMarketId, FalconMarket> = {
  'USDC-FPL': {
    id: 'USDC-FPL',
    symbol: 'USDC-FPL',
    label: 'USDC/FPL (Falcon testnet 2300)',
    base: 'USDC',
    quote: 'FPL',
    baseDecimals: 6, // matches price_scale 1e6
    priceScale: 1_000_000,
    quoteDecimals: 0,
    networkId: 2300,
    testnet: true,
  },
  'BTC4-FPL': {
    id: 'BTC4-FPL',
    symbol: 'BTC4-FPL',
    label: 'BTC4/FPL (Falcon testnet 2300)',
    base: 'BTC4',
    quote: 'FPL',
    baseDecimals: 8, // explorer amount.decimals=8; price_scale 1e8
    priceScale: 100_000_000,
    quoteDecimals: 0,
    networkId: 2300,
    testnet: true,
  },
};

export const FALCON_MARKET_LIST: FalconMarket[] = [
  FALCON_MARKETS['USDC-FPL'],
  FALCON_MARKETS['BTC4-FPL'],
];

export function isFalconSymbol(symbol: string | undefined | null): symbol is FalconMarketId {
  if (!symbol) return false;
  const s = String(symbol).toUpperCase();
  return s === 'USDC-FPL' || s === 'BTC4-FPL' || s === 'USDC' || s === 'BTC4';
}

export function normalizeFalconSymbol(symbol: string): FalconMarketId | null {
  const s = String(symbol || '').toUpperCase().trim();
  if (s === 'USDC' || s === 'USDC-FPL') return 'USDC-FPL';
  if (s === 'BTC4' || s === 'BTC4-FPL') return 'BTC4-FPL';
  return null;
}

/** Convert integer price raw → display number (FPL per whole base). */
export function priceRawToNumber(priceRaw: string | number, priceScale: number): number {
  const raw = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw);
  if (!Number.isFinite(raw)) throw new Error('bad price raw');
  return raw / priceScale;
}

/** Convert integer base raw → whole-base units. */
export function baseRawToNumber(baseRaw: string | number, baseDecimals: number): number {
  const raw = typeof baseRaw === 'number' ? baseRaw : Number(baseRaw);
  if (!Number.isFinite(raw)) throw new Error('bad base raw');
  return raw / 10 ** baseDecimals;
}
