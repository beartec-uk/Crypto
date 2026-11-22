import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { visualizer } from 'rollup-plugin-visualizer'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Emits dist/shop.html: the built index.html with /shop's title, description and
 * Open Graph / Twitter tags baked in, so link previews (X, WhatsApp, Slack, which
 * don't run JS) show the shop. vercel.json rewrites /shop to it; the SPA is unchanged.
 */
const SHOP_META = {
  title: 'BearTec Shop — tees, hoodies, caps & stickers',
  description: 'Official BearTec merch. Printed and shipped in the UK.',
  url: 'https://www.beartec.uk/shop',
  image: 'https://cdn.shopify.com/s/files/1/1116/3110/6373/files/unisex-staple-t-shirt-black-front-6b0293bdcbdcf.jpg',
}
function shopMetaPage() {
  return {
    name: 'beartec-shop-meta-page',
    apply: 'build' as const,
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist')
      const src = path.join(outDir, 'index.html')
      if (!fs.existsSync(src)) return
      const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
      const m = SHOP_META
      const tags = [
        `<link rel="canonical" href="${m.url}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="BearTec" />`,
        `<meta property="og:title" content="${esc(m.title)}" />`,
        `<meta property="og:description" content="${esc(m.description)}" />`,
        `<meta property="og:url" content="${m.url}" />`,
        `<meta property="og:image" content="${m.image}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${esc(m.title)}" />`,
        `<meta name="twitter:description" content="${esc(m.description)}" />`,
        `<meta name="twitter:image" content="${m.image}" />`,
      ].join('\n    ')
      const html = fs
        .readFileSync(src, 'utf8')
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`)
        .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(m.description)}" />`)
        .replace('</head>', `    ${tags}\n  </head>`)
      fs.writeFileSync(path.join(outDir, 'shop.html'), html)
    },
  }
}

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    react(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util'],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
    visualizer({
      filename: './client/dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
    shopMetaPage(),
  ],

  root: 'client',
  base: '/',

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@assets': path.resolve(__dirname, 'client/src/assets/media'),
    },
  },

  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    target: 'esnext',
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],
          'router': ['wouter'],
          'crypto-vendor': [
            '@noble/curves',
            '@noble/hashes',
            'bip39',
            'bitcoinjs-lib',
            '@scure/bip32',
          ],
          // web3-vendor and charts-vendor removed: under Vite 6 they form a
          // circular chunk import (ReferenceError: Cannot access before initialization).
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
          ],
          'd3-vendor': ['d3'],
          'query-vendor': ['@tanstack/react-query', 'react-hook-form'],
          'icons': ['lucide-react', 'react-icons'],
          'clerk': ['@clerk/clerk-react'],
          'wallet-vendor': [
            '@simplewebauthn/browser',
            'qrcode.react',
            'idb',
          ],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
  },

  server: {
    port: 3000,
    host: true,
  },

  optimizeDeps: {
    include: [
      '@noble/curves',
      '@noble/hashes',
      'buffer',
      'bitcoinjs-lib',
      '@solana/web3.js',
      'xrpl',
    ],
    exclude: ['tiny-secp256k1'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
})
