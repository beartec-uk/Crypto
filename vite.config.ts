import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { visualizer } from 'rollup-plugin-visualizer'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
