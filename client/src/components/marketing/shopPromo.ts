// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
/** Shop launch promo: shared copy, dismissal key and where the announcement bar shows. */

export const SHOP_PROMO_DISMISS_KEY = 'bt_shop_promo_dismissed_v1';

/** Public product image used for /shop social cards (Shopify CDN, BearTec Chest Logo Tee). */
export const SHOP_OG_IMAGE =
  'https://cdn.shopify.com/s/files/1/1116/3110/6373/files/unisex-staple-t-shirt-black-front-6b0293bdcbdcf.jpg';

/**
 * The bar shows on every page except the shop itself, internal admin/dev tools and the
 * full-screen chart (where an extra strip would push the canvas off screen).
 */
export function shouldShowShopBar(path: string): boolean {
  const p = (path || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (p === '/shop' || p.startsWith('/shop/')) return false;
  if (p === '/admin' || p.startsWith('/admin/')) return false;
  if (p === '/dev' || p.startsWith('/dev/')) return false;
  if (p === '/chart') return false;
  return true;
}

export function isShopPromoDismissed(storage: Pick<Storage, 'getItem'> | null | undefined): boolean {
  try {
    return storage?.getItem(SHOP_PROMO_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissShopPromo(storage: Pick<Storage, 'setItem'> | null | undefined): void {
  try {
    storage?.setItem(SHOP_PROMO_DISMISS_KEY, '1');
  } catch {
    /* private mode / storage disabled: dismiss for this page view only */
  }
}
