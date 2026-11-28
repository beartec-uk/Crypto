/**
 * After `vite build`, render each public route to real HTML and write
 * sitemap.xml, robots.txt and the noindex SPA shell.
 * Run from the repo root: node scripts/prerender-public.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const dist = path.join(root, 'dist')
const entryPath = path.join(root, 'dist-prerender', 'entry.js')

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html missing. Run vite build first.')
  process.exit(1)
}
if (!fs.existsSync(entryPath)) {
  console.error('dist-prerender/entry.js missing. Run the prerender Vite build first.')
  process.exit(1)
}

const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
if (!template.includes('<div id="root"></div>')) {
  console.error('Built index.html has no empty <div id="root"></div> to fill.')
  process.exit(1)
}

const { render, PUBLIC_ROUTES, ROBOTS_DISALLOW, SITE_ORIGIN } = await import(pathToFileURL(entryPath).href)

function applyRoute(htmlTemplate, helmet, indexable) {
  let html = htmlTemplate
  const title = helmet.title?.toString?.() ?? ''
  if (!title.includes('<title')) throw new Error('Rendered page has no <title>')
  html = html.replace(/<title>[\s\S]*?<\/title>/, title.trim())
  html = html.replace(/\s*<meta\s+name="description"[^>]*>/i, '')
  if (indexable) {
    html = html.replace(/\s*<meta\s+name="robots"\s+content="noindex"\s*\/?>/i, '')
  }
  const meta = (helmet.meta?.toString?.() ?? '').trim()
  const link = (helmet.link?.toString?.() ?? '').trim()
  const tags = [meta, link].filter(Boolean).join('\n    ')
  html = html.replace('</head>', `    ${tags}\n  </head>`)
  return html
}

const rendered = []
for (const route of PUBLIC_ROUTES) {
  const { html: body, helmet } = render(route.path)
  if (!body || body.length < 40) {
    throw new Error(`Prerender of ${route.path} produced no body HTML`)
  }
  let page = applyRoute(template, helmet, true)
  const rootHtml = `<div id="root">${body}</div>`
  if (!page.includes('<div id="root"></div>')) {
    throw new Error(`Could not find root mount in template while rendering ${route.path}`)
  }
  page = page.replace('<div id="root"></div>', rootHtml)
  if (page.includes('name="robots" content="noindex"') || page.includes("name='robots' content='noindex'")) {
    throw new Error(`${route.path} still has noindex`)
  }
  if (!page.includes('rel="canonical"')) {
    throw new Error(`${route.path} is missing a canonical link`)
  }
  fs.writeFileSync(path.join(dist, route.outFile), page)
  rendered.push(`${route.path} -> ${route.outFile} (${body.length} bytes of body)`)
}

let spa = template
if (!/name="robots"\s+content="noindex"/i.test(spa)) {
  spa = spa.replace('</head>', '    <meta name="robots" content="noindex">\n  </head>')
}
spa = spa.replace(/<title>[\s\S]*?<\/title>/, '<title>BearTec</title>')
spa = spa.replace(/\s*<meta\s+name="description"[^>]*>/i, '')
fs.writeFileSync(path.join(dist, 'spa.html'), spa)

const urls = PUBLIC_ROUTES.filter((route) => route.sitemap).map((route) => {
  const loc = route.path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${route.path}`
  return `  <url><loc>${loc}</loc></url>`
})
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`
fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap)

const robots = `User-agent: *
Allow: /
${ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`).join('\n')}

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`
fs.writeFileSync(path.join(dist, 'robots.txt'), robots)

console.log('Prerendered public routes:')
for (const line of rendered) console.log(`  ${line}`)
console.log('Wrote dist/spa.html (noindex), dist/sitemap.xml, dist/robots.txt')
