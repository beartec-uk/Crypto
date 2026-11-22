// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
/**
 * Minimal, typed Shopify Storefront API (GraphQL) client for the merch shop front.
 *
 * Env (set in Vercel → Project → Settings → Environment Variables, never in code):
 *   SHOPIFY_STORE_DOMAIN            e.g. puyw54-pw.myshopify.com
 *   SHOPIFY_STOREFRONT_TOKEN        public Storefront access token (Headless channel)
 *   SHOPIFY_STOREFRONT_PRIVATE_TOKEN  optional private token; preferred server-side if set
 *   SHOPIFY_COLLECTION_HANDLE       default collection when the client sends none
 *   SHOPIFY_API_VERSION             optional, defaults to DEFAULT_API_VERSION
 */
import {
  categoriseProduct,
  colourHex,
  sortSizes,
  type CheckoutLineInput,
  type ShopColour,
  type ShopImage,
  type ShopProduct,
  type ShopVariant,
} from '../../shared/shop/types.js';

const DEFAULT_API_VERSION = '2026-07';

export interface StorefrontConfig {
  domain: string;
  token: string;
  tokenKind: 'public' | 'private';
  apiVersion: string;
  defaultCollection: string;
}

/** Returns null when the shop isn't configured yet (the client then uses mock data). */
export function getStorefrontConfig(): StorefrontConfig | null {
  const domain = (process.env.SHOPIFY_STORE_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const privateToken = (process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN || '').trim();
  const publicToken = (process.env.SHOPIFY_STOREFRONT_TOKEN || '').trim();
  const token = privateToken || publicToken;
  if (!domain || !token) return null;
  return {
    domain,
    token,
    tokenKind: privateToken ? 'private' : 'public',
    apiVersion: (process.env.SHOPIFY_API_VERSION || DEFAULT_API_VERSION).trim(),
    defaultCollection: (process.env.SHOPIFY_COLLECTION_HANDLE || 'beartec').trim(),
  };
}

export class StorefrontError extends Error {}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function storefrontFetch<T>(
  cfg: StorefrontConfig,
  query: string,
  variables: Record<string, unknown>,
  buyerIp?: string,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (cfg.tokenKind === 'private') {
    headers['Shopify-Storefront-Private-Token'] = cfg.token;
    if (buyerIp) headers['Shopify-Storefront-Buyer-IP'] = buyerIp;
  } else {
    headers['X-Shopify-Storefront-Access-Token'] = cfg.token;
  }
  const res = await fetch(`https://${cfg.domain}/api/${cfg.apiVersion}/graphql.json`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new StorefrontError(`Storefront HTTP ${res.status}`);
  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) throw new StorefrontError(json.errors.map((e) => e.message).join('; '));
  if (!json.data) throw new StorefrontError('Storefront returned no data');
  return json.data;
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

const COLLECTION_QUERY = /* GraphQL */ `
  query ShopCollection($handle: String!) @inContext(country: GB) {
    collection(handle: $handle) {
      handle
      products(first: 100, sortKey: MANUAL) {
        nodes {
          id
          handle
          title
          productType
          tags
          featuredImage { url(transform: { maxWidth: 800, preferredContentType: WEBP }) altText }
          options { name optionValues { name swatch { color } } }
          variants(first: 100) {
            nodes {
              id
              availableForSale
              price { amount currencyCode }
              selectedOptions { name value }
              image { url(transform: { maxWidth: 800, preferredContentType: WEBP }) altText }
            }
          }
        }
      }
    }
  }
`;

interface SfImage { url: string; altText: string | null }
interface SfProduct {
  id: string;
  handle: string;
  title: string;
  productType: string;
  tags: string[];
  featuredImage: SfImage | null;
  options: Array<{ name: string; optionValues: Array<{ name: string; swatch: { color: string | null } | null }> }>;
  variants: {
    nodes: Array<{
      id: string;
      availableForSale: boolean;
      price: { amount: string; currencyCode: string };
      selectedOptions: Array<{ name: string; value: string }>;
      image: SfImage | null;
    }>;
  };
}
interface CollectionData {
  collection: { handle: string; products: { nodes: SfProduct[] } } | null;
}

const isColourOpt = (n: string) => /^colou?r$/i.test(n.trim());
const isSizeOpt = (n: string) => /^size$/i.test(n.trim());
const toImage = (img: SfImage | null, fallbackAlt: string): ShopImage | undefined =>
  img ? { url: img.url, alt: img.altText || fallbackAlt } : undefined;

/** Split "Logo Tee — Light Colours" style titles into a title + tagline. */
function splitTitle(title: string): { title: string; tagline?: string } {
  const m = title.match(/^(.*?)\s+[—–|-]\s+(.*)$/);
  return m ? { title: m[1], tagline: m[2] } : { title };
}

export function mapProduct(p: SfProduct): ShopProduct | null {
  const category = categoriseProduct(p.title, p.productType, p.tags);
  if (!category) return null;
  const variants: ShopVariant[] = p.variants.nodes.map((v) => ({
    id: v.id,
    colour: v.selectedOptions.find((o) => isColourOpt(o.name))?.value ?? null,
    size: v.selectedOptions.find((o) => isSizeOpt(o.name))?.value ?? null,
    price: Number(v.price.amount),
    currency: v.price.currencyCode,
    available: v.availableForSale,
    image: toImage(v.image, p.title),
  }));
  if (!variants.length) return null;

  const colourOpt = p.options.find((o) => isColourOpt(o.name));
  const colours: ShopColour[] = (colourOpt?.optionValues ?? []).map((ov) => {
    const fallback = colourHex(ov.name);
    return {
      name: ov.name,
      hex: ov.swatch?.color || fallback.hex,
      hex2: fallback.hex2,
      image: variants.find((v) => v.colour === ov.name && v.image)?.image,
    };
  });
  const sizes = sortSizes(p.options.find((o) => isSizeOpt(o.name))?.optionValues.map((o) => o.name) ?? []);
  const prices = variants.map((v) => v.price);
  const image = toImage(p.featuredImage, p.title) ?? variants.find((v) => v.image)?.image ?? { url: '', alt: p.title };

  return {
    id: p.id,
    handle: p.handle,
    ...splitTitle(p.title),
    category,
    image,
    colours,
    sizes,
    variants,
    priceMin: Math.min(...prices),
    priceMax: Math.max(...prices),
    currency: variants[0].currency,
  };
}

export async function fetchCollectionProducts(cfg: StorefrontConfig, handle: string): Promise<ShopProduct[]> {
  const data = await storefrontFetch<CollectionData>(cfg, COLLECTION_QUERY, { handle });
  if (!data.collection) throw new StorefrontError(`Collection "${handle}" not found`);
  return data.collection.products.nodes.map(mapProduct).filter((p): p is ShopProduct => p !== null);
}

// ---------------------------------------------------------------------------
// Cart → Shopify-hosted checkout (no card data ever touches our servers)
// ---------------------------------------------------------------------------

const CART_CREATE = /* GraphQL */ `
  mutation CartCreate($input: CartInput!) @inContext(country: GB) {
    cartCreate(input: $input) {
      cart { id checkoutUrl }
      userErrors { field message }
    }
  }
`;

const CART_LINES_ADD = /* GraphQL */ `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) @inContext(country: GB) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { id checkoutUrl }
      userErrors { field message }
    }
  }
`;

interface CartPayload {
  cart: { id: string; checkoutUrl: string } | null;
  userErrors: Array<{ field: string[] | null; message: string }>;
}

function unwrapCart(p: CartPayload): { id: string; checkoutUrl: string } {
  if (p.userErrors.length) throw new StorefrontError(p.userErrors.map((e) => e.message).join('; '));
  if (!p.cart) throw new StorefrontError('No cart returned');
  return p.cart;
}

const LINE_BATCH = 50;

/** Creates a cart with the basket lines (cartCreate, then cartLinesAdd for any overflow batches). */
export async function createCheckout(cfg: StorefrontConfig, lines: CheckoutLineInput[], buyerIp?: string): Promise<string> {
  const [first, ...rest] = chunk(lines, LINE_BATCH);
  const created = await storefrontFetch<{ cartCreate: CartPayload }>(cfg, CART_CREATE, { input: { lines: first } }, buyerIp);
  let cart = unwrapCart(created.cartCreate);
  for (const batch of rest) {
    const added = await storefrontFetch<{ cartLinesAdd: CartPayload }>(cfg, CART_LINES_ADD, { cartId: cart.id, lines: batch }, buyerIp);
    cart = unwrapCart(added.cartLinesAdd);
  }
  return cart.checkoutUrl;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out.length ? out : [[]];
}

/** Validates untrusted basket lines from the browser. */
export function sanitiseLines(input: unknown): CheckoutLineInput[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 100) return null;
  const lines: CheckoutLineInput[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null;
    const { merchandiseId, quantity } = raw as Record<string, unknown>;
    if (typeof merchandiseId !== 'string' || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(merchandiseId)) return null;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return null;
    lines.push({ merchandiseId, quantity });
  }
  return lines;
}
