// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
/**
 * Shop front themes. Both themes drive the exact same three-wheel component; only
 * colours, logo, copy and the Shopify collection handle differ. To lift the Falcon
 * theme into falcon-fpl.com, copy client/src/shop + shared/shop and render
 * <ShopFront theme={FALCON_THEME} />.
 */
export type ShopThemeId = 'beartec' | 'falcon';

export interface ShopTheme {
  id: ShopThemeId;
  brand: string;
  /** Shopify collection handle holding this brand's products. */
  collectionHandle: string;
  logo: { src: string; alt: string; height: number; round?: boolean };
  homeHref: string;
  copy: {
    pageTitle: string;
    metaDescription: string;
    intro: string;
    /** Shown after "Swipe up" (touch) or "Scroll down" (mouse). */
    categoryHint: string;
    productHint: string;
    variantHint: string;
  };
  /** CSS custom properties applied to the shop root. */
  vars: {
    bg: string;
    bgGlow: string;
    surface: string;
    surfaceHi: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    accent2: string;
    accentInk: string;
    glow: string;
    font: string;
  };
}

export const BEARTEC_THEME: ShopTheme = {
  id: 'beartec',
  brand: 'BearTec',
  collectionHandle: 'beartec',
  logo: { src: '/shop-assets/beartec-wordmark.webp', alt: 'BearTec', height: 30 },
  homeHref: '/',
  copy: {
    pageTitle: 'BearTec Shop — tees, hoodies, caps & stickers',
    metaDescription: 'Official BearTec merch. Printed and shipped in the UK.',
    intro: 'Official merch',
    categoryHint: 'for styles',
    productHint: 'to pick colour & size',
    variantHint: 'Pick a colour, then your size',
  },
  vars: {
    bg: '#0e0e0e',
    bgGlow: 'rgba(0, 196, 180, 0.16)',
    surface: 'rgba(24, 24, 27, 0.78)',
    surfaceHi: 'rgba(39, 39, 42, 0.92)',
    border: 'rgba(63, 63, 70, 0.7)',
    text: '#fafafa',
    muted: '#a1a1aa',
    accent: '#00c4b4',
    accent2: '#00d8f0',
    accentInk: '#001614',
    glow: 'rgba(0, 216, 240, 0.35)',
    font: '"Inter", "Open Sans", system-ui, sans-serif',
  },
};

export const FALCON_THEME: ShopTheme = {
  id: 'falcon',
  brand: 'Falcon PL',
  collectionHandle: 'falcon',
  logo: { src: '/shop-assets/falcon-coin.webp', alt: 'Falcon PL', height: 34, round: true },
  homeHref: 'https://falcon-fpl.com',
  copy: {
    pageTitle: 'Falcon PL Shop — coin merch',
    metaDescription: 'Falcon PL coin merch: tees, hoodies, caps and stickers.',
    intro: 'Coin collection',
    categoryHint: 'for styles',
    productHint: 'to pick colour & size',
    variantHint: 'Pick a colour, then your size',
  },
  vars: {
    bg: '#0a0806',
    bgGlow: 'rgba(212, 146, 42, 0.16)',
    surface: 'rgba(28, 22, 16, 0.8)',
    surfaceHi: 'rgba(48, 36, 24, 0.92)',
    border: 'rgba(125, 74, 36, 0.55)',
    text: '#fdf6ee',
    muted: '#c9b49a',
    accent: '#d4922a',
    accent2: '#c07838',
    accentInk: '#1a0f04',
    glow: 'rgba(212, 146, 42, 0.38)',
    font: '"Inter", "Open Sans", system-ui, sans-serif',
  },
};

export const SHOP_THEMES: Record<ShopThemeId, ShopTheme> = { beartec: BEARTEC_THEME, falcon: FALCON_THEME };
