// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.

/** Which headless shop a shopper should land back on after Shopify checkout. */
export type ShopReturnSite = 'beartec' | 'falcon';

/**
 * Wraps a Shopify `checkoutUrl` in the theme handoff so checkout's "Continue shopping"
 * (which always goes to the Shopify store root) sends the shopper back to the right shop.
 *
 * The live Shopify theme reads `?return=` on the store root, remembers it in a first-party
 * cookie on the myshopify domain, then forwards to `checkout` (same-origin cart/checkout
 * paths only). Anything that isn't a myshopify checkout URL is returned unchanged.
 */
export function withCheckoutReturn(checkoutUrl: string, site: ShopReturnSite): string {
  let url: URL;
  try {
    url = new URL(checkoutUrl);
  } catch {
    return checkoutUrl;
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.myshopify.com')) return checkoutUrl;
  if (!url.pathname.startsWith('/cart/c/') && !url.pathname.startsWith('/checkouts/')) return checkoutUrl;
  return `${url.origin}/?return=${site}&checkout=${encodeURIComponent(url.href)}`;
}
