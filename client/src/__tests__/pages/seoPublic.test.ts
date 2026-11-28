// Copyright (c) 2026 BEARTEC LTD. All rights reserved.
import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { PUBLIC_ROUTES, ROBOTS_DISALLOW, canonicalUrl } from '@/seo/publicRoutes'

const root = process.cwd()

describe('public SEO shell', () => {
  const vercel = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'))
  const indexHtml = readFileSync(path.join(root, 'client/index.html'), 'utf8')
  const coldHtml = readFileSync(path.join(root, 'cold-signer/index.html'), 'utf8')
  const entry = readFileSync(path.join(root, 'client/src/prerender/entry.tsx'), 'utf8')

  it('drops zoom-blocking viewport flags', () => {
    for (const html of [indexHtml, coldHtml]) {
      expect(html).not.toMatch(/user-scalable/)
      expect(html).not.toMatch(/maximum-scale/)
      expect(html).toMatch(/name="viewport"/)
    }
  })

  it('keeps the SPA shell noindex so signed-in routes are not indexed', () => {
    expect(indexHtml).toMatch(/name="robots"\s+content="noindex"/)
  })

  it('redirects the apex host to www with a permanent (308) redirect', () => {
    const apex = vercel.redirects.find((rule: { has?: { type: string; value: string }[] }) =>
      rule.has?.some((has) => has.type === 'host' && has.value === 'beartec.uk'),
    )
    expect(apex).toBeTruthy()
    expect(apex.permanent).toBe(true)
    expect(apex.destination).toBe('https://www.beartec.uk/:path*')
    expect(apex.source).toBe('/:path*')
  })

  it('serves sitemap.xml and robots.txt as files, not the SPA shell', () => {
    const catchAll = vercel.rewrites.find((rule: { destination: string }) => rule.destination === '/spa.html')
    expect(catchAll).toBeTruthy()
    expect(catchAll.source).toMatch(/sitemap/)
    expect(catchAll.source).toMatch(/robots/)
    expect(catchAll.source).not.toMatch(/\/index\.html/)
    const sitemapHeader = vercel.headers.find((rule: { source: string }) => rule.source === '/sitemap.xml')
    const robotsHeader = vercel.headers.find((rule: { source: string }) => rule.source === '/robots.txt')
    expect(sitemapHeader.headers[0].value).toMatch(/xml/)
    expect(robotsHeader.headers[0].value).toMatch(/text\/plain/)
  })

  it('rewrites only the public pages to their prerendered html', () => {
    for (const route of PUBLIC_ROUTES) {
      expect(entry).toContain(`'${route.path}'`)
      if (route.path === '/') continue
      const rewrite = vercel.rewrites.find((rule: { source: string }) => rule.source === route.path)
      expect(rewrite?.destination).toBe(`/${route.outFile}`)
    }
    expect(PUBLIC_ROUTES.map((route) => route.path)).not.toContain('/cryptoindicators')
    expect(PUBLIC_ROUTES.map((route) => route.path)).not.toContain('/admin')
    expect(canonicalUrl('/')).toBe('https://www.beartec.uk/')
    expect(canonicalUrl('/pricing')).toBe('https://www.beartec.uk/pricing')
    expect(canonicalUrl('/privacy')).toBe('https://www.beartec.uk/privacy')
  })

  it('disallows app and api routes and leaves public pages crawlable', () => {
    expect(ROBOTS_DISALLOW).toContain('/api/')
    expect(ROBOTS_DISALLOW).toContain('/cryptoindicators')
    expect(ROBOTS_DISALLOW).toContain('/crypto/account')
    expect(ROBOTS_DISALLOW).not.toContain('/pricing')
    expect(ROBOTS_DISALLOW).not.toContain('/')
  })
})
