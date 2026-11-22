// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
/**
 * MOCK DATA — used only when the Shopify Storefront API isn't configured (no
 * SHOPIFY_STORE_DOMAIN / SHOPIFY_STOREFRONT_TOKEN) or is unreachable, so preview
 * deploys still render. Modelled on the real Printful range in store puyw54-pw.
 * Mock variant ids start with "mock:" and can't be checked out.
 *
 * Images (client/public/shop-mock): Printful's own product mockups where we have them;
 * otherwise our actual print file composited onto Printful's real blank-garment photo
 * (files.cdn.printful.com catalogue images). Once the Storefront token is set, the real
 * Shopify product images are used instead and none of these load.
 */
import { colourHex, type ShopCategoryId, type ShopColour, type ShopProduct, type ShopVariant } from '@shared/shop/types';
import type { ShopThemeId } from './themes';

const IMG = (name: string) => `/shop-mock/${name}.webp`;
const GARMENT_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
const teePrice = (size: string | null) => (size === '3XL' ? 24 : size === '2XL' ? 22 : 20);
const hoodiePrice = (size: string | null) => (size === '3XL' ? 42 : size === '2XL' ? 40 : 38);

interface MockDef {
  id: string;
  title: string;
  tagline: string;
  category: ShopCategoryId;
  /** colour name → image file stem (falls back to the first colour's image). */
  colours: Array<[string, string | null]>;
  sizes?: string[];
  price: (size: string | null) => number;
}

function build(def: MockDef): ShopProduct {
  const firstImg = def.colours.find(([, img]) => img)?.[1] ?? 'bt-sticker';
  const colours: ShopColour[] = def.colours.map(([name, img]) => ({
    name,
    ...colourHex(name),
    image: { url: IMG(img ?? firstImg), alt: `${def.title} in ${name}` },
  }));
  const sizes = def.sizes ?? [];
  const variants: ShopVariant[] = [];
  for (const c of colours) {
    for (const size of sizes.length ? sizes : [null]) {
      variants.push({
        id: `mock:${def.id}:${c.name}:${size ?? 'one'}`,
        colour: c.name,
        size,
        price: def.price(size),
        currency: 'GBP',
        available: true,
        image: c.image,
      });
    }
  }
  const prices = variants.map((v) => v.price);
  return {
    id: `mock:${def.id}`,
    handle: def.id,
    title: def.title,
    tagline: def.tagline,
    category: def.category,
    image: { url: IMG(firstImg), alt: def.title },
    colours,
    sizes,
    variants,
    priceMin: Math.min(...prices),
    priceMax: Math.max(...prices),
    currency: 'GBP',
  };
}

const tee = (d: Omit<MockDef, 'category' | 'sizes' | 'price'>): MockDef => ({ ...d, category: 'tees', sizes: GARMENT_SIZES, price: teePrice });
const hoodie = (d: Omit<MockDef, 'category' | 'sizes' | 'price'>): MockDef => ({ ...d, category: 'hoodies', sizes: GARMENT_SIZES, price: hoodiePrice });

const BEARTEC: MockDef[] = [
  tee({ id: 'bt-logo-tee', title: 'Logo Tee', tagline: 'Large front logo', colours: [['Black', 'bt-logo-tee-black']] }),
  tee({ id: 'bt-chest-tee', title: 'Chest Logo Tee', tagline: 'Small chest logo', colours: [['Black', 'bt-chest-tee-black']] }),
  tee({
    id: 'bt-logo-tee-light',
    title: 'Logo Tee',
    tagline: 'Light Colours · two-tone, cyan bear',
    colours: [['White', 'bt-logo-tee-white'], ['Natural', 'bt-logo-tee-natural'], ['Heather Grey', 'bt-logo-tee-grey']],
  }),
  tee({
    id: 'bt-chest-tee-light',
    title: 'Chest Logo Tee',
    tagline: 'Light Colours · two-tone, cyan bear',
    colours: [['White', 'bt-chest-tee-white'], ['Natural', 'bt-chest-tee-natural'], ['Heather Grey', 'bt-chest-tee-grey']],
  }),
  hoodie({ id: 'bt-hoodie', title: 'Chest Logo Hoodie', tagline: 'Heavy blend, cyan logo', colours: [['Black', 'bt-hoodie-dark']] }),
  hoodie({
    id: 'bt-hoodie-light',
    title: 'Chest Logo Hoodie',
    tagline: 'Light Colours · two-tone, cyan bear',
    colours: [['White', 'bt-hoodie-white'], ['Sand', 'bt-hoodie-sand'], ['Sport Grey', 'bt-hoodie-grey']],
  }),
  { id: 'bt-dad-cap', title: 'Dad Cap', tagline: 'Embroidered, true cyan', category: 'caps', colours: [['Black', 'bt-dad-cap-black']], price: () => 30 },
  {
    id: 'bt-snapback',
    title: 'Snapback',
    tagline: 'Flat peak, embroidered',
    category: 'caps',
    colours: [['Black', 'bt-snapback-black'], ['Black/Teal', 'bt-snapback-black-teal']],
    price: () => 28,
  },
  { id: 'bt-sticker', title: 'Bumper Sticker', tagline: 'Kiss-cut, 15 × 3.75 in', category: 'stickers', colours: [['White', 'bt-sticker']], price: () => 9 },
];

/** Falcon: every design in "coin only" and "coin + FALCON PL" text versions, dark and light. */
function falconDefs(): MockDef[] {
  const versions: Array<[string, string]> = [['coin', 'Coin only'], ['text', 'Coin + FALCON PL']];
  const defs: MockDef[] = [];
  for (const [v, label] of versions) {
    const suffix = v === 'text' ? ' + FALCON PL' : '';
    // Text versions use Printful's own light mockups for White/Natural/Sand; everything
    // else is our print file composited onto Printful's blank-garment photo.
    const t = v === 'text';
    defs.push(
      tee({ id: `fa-logo-tee-${v}`, title: `Coin Logo Tee${suffix}`, tagline: `${label} · large front`, colours: [['Black', t ? 'fa-logo-tee-black' : 'fa-logo-tee-black-coin']] }),
      tee({
        id: `fa-logo-tee-light-${v}`,
        title: `Coin Logo Tee${suffix}`,
        tagline: `${label} · Light Colours`,
        colours: [
          ['White', t ? 'fa-logo-tee-white' : 'fa-logo-tee-white-coin'],
          ['Natural', t ? 'fa-logo-tee-natural' : 'fa-logo-tee-natural-coin'],
          ['Heather Grey', `fa-logo-tee-grey-${v}`],
        ],
      }),
      tee({ id: `fa-chest-tee-${v}`, title: `Coin Chest Tee${suffix}`, tagline: `${label} · chest`, colours: [['Black', `fa-chest-tee-black-${v}`]] }),
      tee({
        id: `fa-chest-tee-light-${v}`,
        title: `Coin Chest Tee${suffix}`,
        tagline: `${label} · Light Colours`,
        colours: [
          ['White', t ? 'fa-chest-tee-white' : 'fa-chest-tee-white-coin'],
          ['Natural', t ? 'fa-chest-tee-natural' : 'fa-chest-tee-natural-coin'],
          ['Heather Grey', `fa-chest-tee-grey-${v}`],
        ],
      }),
      hoodie({ id: `fa-hoodie-${v}`, title: `Coin Hoodie${suffix}`, tagline: `${label} · chest`, colours: [['Black', `fa-hoodie-dark-${v}`]] }),
      hoodie({
        id: `fa-hoodie-light-${v}`,
        title: `Coin Hoodie${suffix}`,
        tagline: `${label} · Light Colours`,
        colours: [
          ['White', t ? 'fa-hoodie-white' : 'fa-hoodie-white-coin'],
          ['Sand', t ? 'fa-hoodie-sand' : 'fa-hoodie-sand-coin'],
          ['Sport Grey', `fa-hoodie-grey-${v}`],
        ],
      }),
      { id: `fa-dad-cap-${v}`, title: `Coin Dad Cap${suffix}`, tagline: `${label} · embroidered`, category: 'caps', colours: [['Black', 'fa-dad-cap-black']], price: () => 27 },
      {
        id: `fa-snapback-${v}`,
        title: `Coin Snapback${suffix}`,
        tagline: `${label} · flat peak`,
        category: 'caps',
        colours: [['Black', 'fa-snapback-black'], ['Black/Gold', 'fa-snapback-black-gold']],
        price: () => 25,
      },
    );
  }
  // Keep both versions of each design side by side on the product wheel.
  const designKey = (d: MockDef) => d.id.replace(/-(coin|text)$/, '');
  const order = new Map<string, number>();
  for (const d of defs) if (!order.has(designKey(d))) order.set(designKey(d), order.size);
  defs.sort((a, b) => (order.get(designKey(a)) ?? 0) - (order.get(designKey(b)) ?? 0));
  defs.push({ id: 'fa-sticker', title: 'Bumper Sticker', tagline: 'Kiss-cut, 15 × 3.75 in', category: 'stickers', colours: [['Black', 'fa-sticker']], price: () => 9 });
  return defs;
}

export function mockProducts(theme: ShopThemeId): ShopProduct[] {
  return (theme === 'falcon' ? falconDefs() : BEARTEC).map(build);
}
