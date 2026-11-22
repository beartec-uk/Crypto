// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { describe, expect, it } from 'vitest';
import { dismissShopPromo, isShopPromoDismissed, shouldShowShopBar, SHOP_PROMO_DISMISS_KEY } from './shopPromo';

describe('shouldShowShopBar', () => {
  it('shows on public and app pages', () => {
    for (const p of ['/', '/pricing', '/contact', '/privacy', '/crypto/training', '/cryptoindicators', '/nope']) {
      expect(shouldShowShopBar(p)).toBe(true);
    }
  });
  it('hides on the shop, admin/dev tools and the full-screen chart', () => {
    for (const p of ['/shop', '/shop/', '/shop?theme=falcon', '/shop/falcon-preview', '/admin', '/admin/users', '/dev/sandbox', '/chart']) {
      expect(shouldShowShopBar(p)).toBe(false);
    }
  });
  it('does not treat /shopping-like paths as the shop', () => {
    expect(shouldShowShopBar('/shopping')).toBe(true);
  });
});

describe('dismissal', () => {
  it('round-trips through storage', () => {
    const m = new Map<string, string>();
    const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    expect(isShopPromoDismissed(s)).toBe(false);
    dismissShopPromo(s);
    expect(m.get(SHOP_PROMO_DISMISS_KEY)).toBe('1');
    expect(isShopPromoDismissed(s)).toBe(true);
  });
  it('survives storage that throws', () => {
    const bad = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(isShopPromoDismissed(bad)).toBe(false);
    expect(() => dismissShopPromo(bad)).not.toThrow();
  });
});
