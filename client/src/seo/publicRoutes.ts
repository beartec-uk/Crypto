// Copyright (c) 2026 BEARTEC LTD. All rights reserved.
/**
 * Public routes from client/src/App.tsx (not behind CryptoAuthGate or InternalOnlyRoute).
 * Signed-in tool, chart, account and admin routes are intentionally absent: they are
 * noindex and omitted from the sitemap. There is no /about route.
 */

export const SITE_ORIGIN = 'https://www.beartec.uk'

/** Polar-bear mark already shipped in client/public/bear.jpg */
export const OG_IMAGE = `${SITE_ORIGIN}/bear.jpg`
export const OG_IMAGE_ALT = 'BearTec polar bear'

export type PublicRoute = {
  path: string
  /** File written into dist/. `/` is the directory index. */
  outFile: string
  sitemap: boolean
}

export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: '/', outFile: 'index.html', sitemap: true },
  { path: '/crypto', outFile: 'crypto.html', sitemap: true },
  { path: '/pricing', outFile: 'pricing.html', sitemap: true },
  { path: '/shop', outFile: 'shop.html', sitemap: true },
  { path: '/privacy', outFile: 'privacy.html', sitemap: true },
  { path: '/terms', outFile: 'terms.html', sitemap: true },
  { path: '/contact', outFile: 'contact.html', sitemap: true },
  { path: '/login', outFile: 'login.html', sitemap: true },
  { path: '/cryptologin', outFile: 'cryptologin.html', sitemap: true },
]

/** App, auth-gated and internal paths. robots.txt disallows these plus /api/. */
export const ROBOTS_DISALLOW = [
  '/api/',
  '/cryptoindicators',
  '/chart',
  '/cryptoai',
  '/cryptoelliottwave',
  '/crypto/training',
  '/crypto/subscribe',
  '/cryptosubscribe',
  '/crypto/account',
  '/crypto/feedback',
  '/crypto/elliott-lessons',
  '/admin',
  '/dev',
  '/shop/falcon-preview',
]

export function canonicalUrl(path: string): string {
  if (path === '/' || path === '') return `${SITE_ORIGIN}/`
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}
