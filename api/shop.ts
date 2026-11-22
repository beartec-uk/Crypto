// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
/**
 * Merch shop front backend.
 *   GET  /api/shop?collection=beartec  → ShopCatalogue (or { source: 'mock' } when Shopify isn't configured)
 *   POST /api/shop { lines: CheckoutLineInput[] } → { checkoutUrl } (Shopify-hosted checkout)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createCheckout,
  fetchCollectionProducts,
  getStorefrontConfig,
  sanitiseLines,
} from './_lib/shopifyStorefront.js';
import type { ShopCatalogue } from '../shared/shop/types.js';

const HANDLE_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

function buyerIp(req: VercelRequest): string | undefined {
  const xff = req.headers['x-forwarded-for'];
  const v = Array.isArray(xff) ? xff[0] : xff;
  return v?.split(',')[0]?.trim() || undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cfg = getStorefrontConfig();

  if (req.method === 'GET') {
    const requested = typeof req.query.collection === 'string' ? req.query.collection : '';
    const collection = HANDLE_RE.test(requested) ? requested : cfg?.defaultCollection || 'beartec';
    if (!cfg) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ source: 'mock', collection, products: [] } satisfies ShopCatalogue);
    }
    try {
      const products = await fetchCollectionProducts(cfg, collection);
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
      return res.status(200).json({ source: 'shopify', collection, products } satisfies ShopCatalogue);
    } catch (err) {
      console.error('[shop] catalogue error:', err instanceof Error ? err.message : err);
      return res.status(502).json({ error: 'Shop catalogue unavailable' });
    }
  }

  if (req.method === 'POST') {
    if (!cfg) return res.status(503).json({ error: 'Checkout is not configured yet' });
    const body = typeof req.body === 'string' ? safeJson(req.body) : req.body;
    const lines = sanitiseLines((body as { lines?: unknown } | null)?.lines);
    if (!lines) return res.status(400).json({ error: 'Invalid basket' });
    try {
      const checkoutUrl = await createCheckout(cfg, lines, buyerIp(req));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ checkoutUrl });
    } catch (err) {
      console.error('[shop] checkout error:', err instanceof Error ? err.message : err);
      return res.status(502).json({ error: 'Could not start checkout' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
