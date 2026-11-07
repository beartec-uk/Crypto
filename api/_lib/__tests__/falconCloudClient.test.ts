import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FalconCloudClient,
  FalconCloudError,
  clearFalconCloudCache,
  clampLimit,
  clampLevels,
  hasFalconCloudApiKey,
  normalizePair,
  sanitizeUsage,
  summarizeStatus,
} from '../falconCloudClient';

afterEach(() => {
  clearFalconCloudCache();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('falconCloud helpers', () => {
  it('detects key presence without reading the value in assertions', () => {
    expect(hasFalconCloudApiKey({} as NodeJS.ProcessEnv)).toBe(false);
    expect(hasFalconCloudApiKey({ FALCON_CLOUD_API_KEY: '' } as any)).toBe(false);
    expect(hasFalconCloudApiKey({ FALCON_CLOUD_API_KEY: '  ' } as any)).toBe(false);
    expect(hasFalconCloudApiKey({ FALCON_CLOUD_API_KEY: 'fplk_test' } as any)).toBe(true);
  });

  it('normalizes pair shorthand to *-FPL', () => {
    expect(normalizePair('btc4')).toBe('BTC4-FPL');
    expect(normalizePair('USDC-FPL')).toBe('USDC-FPL');
    expect(normalizePair('USDC')).toBe('USDC-FPL');
  });

  it('clamps limit and levels', () => {
    expect(clampLimit(999)).toBe(200);
    expect(clampLimit(-1)).toBe(50);
    expect(clampLevels(500)).toBe(200);
  });

  it('summarizes status without dumping accounts', () => {
    const s = summarizeStatus({
      tip_height: 100,
      best_peer_tip: 101,
      network_id: 2300,
      amm_pools: 5,
      chain_len: 100,
      accounts: { alice: { balance: 1 } },
    });
    expect(s.tip_height).toBe(100);
    expect(s.network_id).toBe(2300);
    expect(JSON.stringify(s)).not.toMatch(/alice/);
  });

  it('redacts usage key_id', () => {
    const u = sanitizeUsage({
      tier: 'free',
      key_id: 'k_secret',
      units_used: 0,
      monthly_quota: 300000,
    });
    expect(u.tier).toBe('free');
    expect(u.key_id).toBe('<present>');
    expect(JSON.stringify(u)).not.toMatch(/k_secret/);
  });
});

describe('FalconCloudClient rpc', () => {
  it('requires object params and sends Bearer auth from env', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer test-key-value');
      const body = JSON.parse(String(init?.body));
      expect(body.params).toEqual({ pair: 'BTC4-FPL', levels: 10 });
      expect(Array.isArray(body.params)).toBe(false);
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            pair: 'BTC4-FPL',
            base: 'BTC4',
            quote: 'FPL',
            bids: [],
            asks: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const client = new FalconCloudClient({
      env: { FALCON_CLOUD_API_KEY: 'test-key-value' } as any,
      fetchImpl: fetchImpl as any,
      cacheTtlMs: 0,
    });

    const book = await client.getOrderBook('BTC4', 10);
    expect(book.pair).toBe('BTC4-FPL');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects when key missing', async () => {
    const client = new FalconCloudClient({
      env: {} as any,
      fetchImpl: vi.fn() as any,
    });
    await expect(client.getStatusSummary()).rejects.toBeInstanceOf(FalconCloudError);
  });

  it('maps fills recent-window result', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            fills: [
              {
                asset: 'BTC4',
                base: 1,
                height: 10,
                maker: 'amm:btc4-fpl',
                price: 100,
                quote: 1,
                side: 'buy',
                taker: 'mm01',
                taker_order: 1,
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    const client = new FalconCloudClient({
      env: { FALCON_CLOUD_API_KEY: 'k' } as any,
      fetchImpl: fetchImpl as any,
      cacheTtlMs: 60_000,
    });
    const a = await client.getFills({ limit: 5 });
    const b = await client.getFills({ limit: 5 });
    expect(a.fills).toHaveLength(1);
    expect(b.fills).toHaveLength(1);
    // second call served from cache
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('surfaces JSON-RPC errors', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Invalid params' },
        }),
        { status: 200 },
      ),
    );
    const client = new FalconCloudClient({
      env: { FALCON_CLOUD_API_KEY: 'k' } as any,
      fetchImpl: fetchImpl as any,
      cacheTtlMs: 0,
    });
    await expect(client.rpc('fpl_orderBook', { pair: 'X' })).rejects.toMatchObject({
      code: -32602,
    });
  });
});

describe('falconCloud branch coverage', () => {
  it('summarizeStatus falls back to height and nulls', () => {
    expect(summarizeStatus({ height: 42 }).tip_height).toBe(42);
    expect(summarizeStatus({}).tip_height).toBeNull();
    expect(summarizeStatus({ best_peer_tip: 'x' } as any).best_peer_tip).toBeNull();
  });

  it('sanitizeUsage omits non-string key_id and non-numbers', () => {
    const u = sanitizeUsage({ tier: 1, key_id: 9, units_used: 'n' } as any);
    expect(u.tier).toBeUndefined();
    expect(u.key_id).toBeUndefined();
    expect(u.units_used).toBeUndefined();
  });

  it('normalizePair defaults empty and leaves *-FPL', () => {
    expect(normalizePair('')).toBe('BTC4-FPL');
    expect(normalizePair('eth-fpl')).toBe('ETH-FPL');
  });

  it('clampLevels falls back and floors', () => {
    expect(clampLevels(undefined)).toBe(50);
    expect(clampLevels(3.9)).toBe(3);
  });

  it('rejects array params', async () => {
    const client = new FalconCloudClient({
      env: { FALCON_CLOUD_API_KEY: 'k' } as any,
      fetchImpl: vi.fn() as any,
    });
    await expect(client.rpc('fpl_status', [] as any)).rejects.toMatchObject({ code: -32602 });
  });

  it('handles 401 / non-ok HTTP / 429 then success', async () => {
    const fetch401 = vi.fn(async () => new Response('nope', { status: 401 }));
    const c401 = new FalconCloudClient({
      env: { FALCON_CLOUD_API_KEY: 'k' } as any,
      fetchImpl: fetch401 as any,
      cacheTtlMs: 0,
    });
    await expect(c401.rpc('fpl_status', {})).rejects.toMatchObject({ status: 401 });

    const fetch500 = vi.fn(async () => new Response('err', { status: 500 }));
    const c500 = new FalconCloudClient({
      env: { FALCON_CLOUD_API_KEY: 'k' } as any,
      fetchImpl: fetch500 as any,
      cacheTtlMs: 0,
    });
    await expect(c500.rpc('fpl_status', {})).rejects.toMatchObject({ status: 500 });

    let n = 0;
    const fetch429 = vi.fn(async () => {
      n += 1;
      if (n < 2) {
        return new Response('slow', { status: 429, headers: { 'retry-after': '0' } });
      }
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { ok: true } }), {
        status: 200,
      });
    });
    const c429 = new FalconCloudClient({
      env: { FALCON_CLOUD_API_KEY: 'k' } as any,
      fetchImpl: fetch429 as any,
      cacheTtlMs: 0,
    });
    // sleep uses real timers; stub sleep path by making retry-after 0 and expecting success after retry
    const result = await c429.rpc<{ ok: boolean }>('fpl_status', {});
    expect(result.ok).toBe(true);
    expect(fetch429).toHaveBeenCalledTimes(2);
  });

  it('getUsage covers 401, http error, success + cache', async () => {
    const fetch401 = vi.fn(async () => new Response('', { status: 401 }));
    await expect(
      new FalconCloudClient({
        env: { FALCON_CLOUD_API_KEY: 'k' } as any,
        fetchImpl: fetch401 as any,
        cacheTtlMs: 0,
      }).getUsage(),
    ).rejects.toMatchObject({ status: 401 });

    const fetch500 = vi.fn(async () => new Response('', { status: 503 }));
    await expect(
      new FalconCloudClient({
        env: { FALCON_CLOUD_API_KEY: 'k' } as any,
        fetchImpl: fetch500 as any,
        cacheTtlMs: 0,
      }).getUsage(),
    ).rejects.toMatchObject({ status: 503 });

    const fetchOk = vi.fn(async () =>
      new Response(JSON.stringify({ tier: 'free', units_used: 1, key_id: 'secret' }), {
        status: 200,
      }),
    );
    const client = new FalconCloudClient({
      env: { FALCON_CLOUD_API_KEY: 'k' } as any,
      fetchImpl: fetchOk as any,
      cacheTtlMs: 60_000,
    });
    const a = await client.getUsage();
    const b = await client.getUsage();
    expect(a.tier).toBe('free');
    expect(a.key_id).toBe('<present>');
    expect(b.tier).toBe('free');
    expect(fetchOk).toHaveBeenCalledTimes(1);
  });

  it('getFills without pair/account and empty fills array', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }), { status: 200 }),
    );
    const client = new FalconCloudClient({
      env: { FALCON_CLOUD_API_KEY: 'k' } as any,
      fetchImpl: fetchImpl as any,
      cacheTtlMs: 0,
    });
    const r = await client.getFills({});
    expect(r.fills).toEqual([]);
  });

  it('getOrderBook omits levels when undefined; getFalconCloudClient singleton', async () => {
    const fetchImpl = vi.fn(async (_u: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.params.levels).toBeUndefined();
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', id: 1, result: { pair: 'BTC4-FPL', bids: [], asks: [] } }),
        { status: 200 },
      );
    });
    const client = new FalconCloudClient({
      env: { FALCON_CLOUD_API_KEY: 'k' } as any,
      fetchImpl: fetchImpl as any,
      cacheTtlMs: 0,
    });
    await client.getOrderBook('BTC4');
    const { getFalconCloudClient } = await import('../falconCloudClient');
    const s1 = getFalconCloudClient();
    const s2 = getFalconCloudClient();
    expect(s1).toBe(s2);
  });

  it('expires cache entries', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { fills: [] } }), {
        status: 200,
      }),
    );
    const client = new FalconCloudClient({
      env: { FALCON_CLOUD_API_KEY: 'k' } as any,
      fetchImpl: fetchImpl as any,
      cacheTtlMs: 1000,
    });
    await client.getFills({ pair: 'USDC', limit: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1500);
    await client.getFills({ pair: 'USDC', limit: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
