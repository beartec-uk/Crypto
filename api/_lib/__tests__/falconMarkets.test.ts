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
    expect(normalizeFalconSymbol('eth')).toBe('ETH-FPL');
    expect(isFalconSymbol('ETH')).toBe(true);
    expect(isFalconSymbol('ETH-FPL')).toBe(true);
    expect(isFalconSymbol('BTCUSDT')).toBe(false);
  });

  it('uses chain-validated scales', () => {
    expect(FALCON_MARKETS['BTC4-FPL'].priceScale).toBe(1);
    expect(FALCON_MARKETS['BTC4-FPL'].baseDecimals).toBe(8);
    expect(FALCON_MARKETS['USDC-FPL'].priceScale).toBe(1);
    expect(FALCON_MARKETS['USDC-FPL'].baseDecimals).toBe(6);
    expect(FALCON_MARKETS['ETH-FPL'].priceScale).toBe(1);
    expect(FALCON_MARKETS['ETH-FPL'].baseDecimals).toBe(18);
    expect(priceRawToNumber(4070000, 1)).toBe(4070000);
    expect(priceRawToNumber(82, 1)).toBe(82);
    expect(priceRawToNumber(51847, 1)).toBe(51847);
    expect(baseRawToNumber(23, 8)).toBeCloseTo(0.00000023);
    expect(baseRawToNumber('1000000000000000000', 18)).toBe(1);
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
