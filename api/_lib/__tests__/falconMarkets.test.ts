import { describe, expect, it } from 'vitest';
import {
  FALCON_DEFAULT_MARKET,
  FALCON_MARKETS,
  baseRawToNumber,
  isFalconSymbol,
  normalizeFalconSymbol,
  priceRawToNumber,
} from '../falconMarkets';

describe('falconMarkets', () => {
  it('defaults to USDC-FPL', () => {
    expect(FALCON_DEFAULT_MARKET).toBe('USDC-FPL');
  });

  it('normalizes shorthand', () => {
    expect(normalizeFalconSymbol('btc4')).toBe('BTC4-FPL');
    expect(normalizeFalconSymbol('USDC')).toBe('USDC-FPL');
    expect(isFalconSymbol('BTCUSDT')).toBe(false);
  });

  it('uses chain-validated scales', () => {
    expect(FALCON_MARKETS['BTC4-FPL'].priceScale).toBe(100_000_000);
    expect(FALCON_MARKETS['BTC4-FPL'].baseDecimals).toBe(8);
    expect(FALCON_MARKETS['USDC-FPL'].priceScale).toBe(1_000_000);
    expect(FALCON_MARKETS['USDC-FPL'].baseDecimals).toBe(6);
    expect(priceRawToNumber(4176926, 100_000_000)).toBeCloseTo(0.04176926);
    expect(baseRawToNumber(23, 8)).toBeCloseTo(0.00000023);
  });

  it('labels mark testnet and FPL quote', () => {
    for (const m of Object.values(FALCON_MARKETS)) {
      expect(m.label).toMatch(/Falcon testnet 2300/);
      expect(m.quote).toBe('FPL');
      expect(m.testnet).toBe(true);
    }
  });
});

describe('falconMarkets edges', () => {
  it('rejects non-falcon and empty symbols', () => {
    expect(isFalconSymbol(null)).toBe(false);
    expect(isFalconSymbol(undefined)).toBe(false);
    expect(isFalconSymbol('')).toBe(false);
    expect(normalizeFalconSymbol('ETHUSDT')).toBeNull();
  });

  it('throws on non-finite raw values', () => {
    expect(() => priceRawToNumber('x', 1e8)).toThrow(/bad price/);
    expect(() => baseRawToNumber(Number.NaN, 8)).toThrow(/bad base/);
  });
});
