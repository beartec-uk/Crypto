// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import type { CheckoutLineInput, CheckoutResponse, ShopCatalogue } from '@shared/shop/types';
import { mockProducts } from './mockCatalogue';
import type { ShopTheme } from './themes';

/**
 * Loads the theme's collection from /api/shop (Shopify Storefront API). Falls back to the
 * bundled MOCK catalogue when the API says it isn't configured, errors, or is unreachable
 * (e.g. `vite dev` without the Vercel functions).
 */
export async function loadCatalogue(theme: ShopTheme, signal?: AbortSignal): Promise<ShopCatalogue> {
  const mock: ShopCatalogue = { source: 'mock', collection: theme.collectionHandle, products: mockProducts(theme.id) };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(`/api/shop?collection=${encodeURIComponent(theme.collectionHandle)}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('application/json')) return mock;
    const data = (await res.json()) as ShopCatalogue;
    if (data.source !== 'shopify' || !Array.isArray(data.products) || data.products.length === 0) return mock;
    return data;
  } catch (err) {
    if (signal?.aborted) throw err;
    return mock;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function startCheckout(lines: CheckoutLineInput[]): Promise<string> {
  const res = await fetch('/api/shop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lines }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<CheckoutResponse> & { error?: string };
  if (!res.ok || !data.checkoutUrl) throw new Error(data.error || 'Could not start checkout');
  return data.checkoutUrl;
}
