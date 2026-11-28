import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Server bundle used only to prerender public routes after the client build.
 * Clerk is aliased to a signed-out stub so the real provider never loads.
 * No extra packages: Vite plus react-dom/server, both already installed.
 */
export default defineConfig({
  root: path.resolve(__dirname, 'client'),
  plugins: [
    {
      name: 'stub-css-for-prerender',
      enforce: 'pre',
      resolveId(id) {
        if (id.endsWith('.css') || id.includes('.css?')) return '\0prerender-css-stub'
      },
      load(id) {
        if (id === '\0prerender-css-stub') return 'export default {}'
      },
    },
    react(),
  ],
  resolve: {
    alias: [
      {
        find: '@clerk/clerk-react',
        replacement: path.resolve(__dirname, 'client/src/prerender/clerkStub.tsx'),
      },
      { find: '@', replacement: path.resolve(__dirname, 'client/src') },
      { find: '@shared', replacement: path.resolve(__dirname, 'shared') },
      { find: '@assets', replacement: path.resolve(__dirname, 'client/src/assets/media') },
    ],
  },
  ssr: {
    noExternal: true,
  },
  build: {
    ssr: 'src/prerender/entry.tsx',
    outDir: path.resolve(__dirname, 'dist-prerender'),
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: 'entry.js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
  },
})
