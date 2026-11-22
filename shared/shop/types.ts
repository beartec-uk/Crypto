// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
/**
 * Shared types for the merch shop front (/shop). Used by the client (three-wheel UI)
 * and by the Vercel function (api/shop.ts) that talks to the Shopify Storefront API.
 */

export type ShopCategoryId = 'tees' | 'hoodies' | 'caps' | 'stickers';

export interface ShopImage {
  url: string;
  alt: string;
}

export interface ShopColour {
  name: string;
  /** CSS colour used for the swatch and the preview halo. */
  hex: string;
  /** Second colour for two-tone items (e.g. Black/Teal snapback). */
  hex2?: string;
  image?: ShopImage;
}

export interface ShopVariant {
  /** Shopify ProductVariant GID (gid://shopify/ProductVariant/…) or a mock:… id. */
  id: string;
  colour: string | null;
  size: string | null;
  /** Price in major units (e.g. 20 = £20.00). */
  price: number;
  currency: string;
  available: boolean;
  image?: ShopImage;
}

export interface ShopProduct {
  id: string;
  handle: string;
  title: string;
  /** Short line under the title, e.g. "Large front logo". */
  tagline?: string;
  category: ShopCategoryId;
  image: ShopImage;
  colours: ShopColour[];
  /** Ordered sizes; empty for one-size items (caps, stickers). */
  sizes: string[];
  variants: ShopVariant[];
  priceMin: number;
  priceMax: number;
  currency: string;
}

export interface ShopCatalogue {
  source: 'shopify' | 'mock';
  collection: string;
  products: ShopProduct[];
}

export interface CheckoutLineInput {
  merchandiseId: string;
  quantity: number;
}

export interface CheckoutResponse {
  checkoutUrl: string;
}

export const SHOP_CATEGORIES: ReadonlyArray<{ id: ShopCategoryId; label: string }> = [
  { id: 'tees', label: 'Tees' },
  { id: 'hoodies', label: 'Hoodies' },
  { id: 'caps', label: 'Caps' },
  { id: 'stickers', label: 'Stickers' },
];

/** Work out a product's category from its Shopify productType / title / tags. */
export function categoriseProduct(title: string, productType = '', tags: string[] = []): ShopCategoryId | null {
  const hay = `${productType} ${title} ${tags.join(' ')}`.toLowerCase();
  if (/hoodie|hoody|sweatshirt|jumper/.test(hay)) return 'hoodies';
  if (/\btee\b|t-shirt|tshirt|shirt/.test(hay)) return 'tees';
  if (/cap\b|snapback|hat\b|trucker|beanie/.test(hay)) return 'caps';
  if (/sticker|decal/.test(hay)) return 'stickers';
  return null;
}

/** Garment colour names used by Printful blanks → swatch colours. */
const COLOUR_HEX: Record<string, string> = {
  black: '#111111',
  white: '#f5f5f2',
  natural: '#efe6d2',
  sand: '#d9c7a3',
  'heather grey': '#a7a9ac',
  'athletic heather': '#b4b6b8',
  'sport grey': '#9c9ea1',
  'light grey': '#c8c9cb',
  navy: '#1c2541',
  charcoal: '#3a3d42',
  maroon: '#5b1a26',
  'forest green': '#1f3b2c',
  teal: '#00b5c8',
  gold: '#f2a900',
};

export function colourHex(name: string): { hex: string; hex2?: string } {
  const key = name.trim().toLowerCase();
  if (COLOUR_HEX[key]) return { hex: COLOUR_HEX[key] };
  const parts = key.split(/\s*\/\s*/);
  if (parts.length === 2) {
    return { hex: COLOUR_HEX[parts[0]] ?? '#777777', hex2: COLOUR_HEX[parts[1]] ?? '#999999' };
  }
  return { hex: '#777777' };
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL'];

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.toUpperCase());
    const ib = SIZE_ORDER.indexOf(b.toUpperCase());
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export function formatPrice(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}
