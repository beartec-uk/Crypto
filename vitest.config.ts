import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom for React component testing
    environment: 'jsdom',
    
    // Setup file for global test configuration
    setupFiles: [path.resolve(__dirname, 'client/src/__tests__/setup.ts')],
    
    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Coverage thresholds
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
      // Include patterns - only files that are actually tested
      // NOTE: This list is explicit rather than pattern-based to prevent untested files
      // (pages, UI components, API integrations) from being included in coverage metrics.
      // When adding new tests, add the tested file path here to include it in coverage.
      include: [
        'client/src/hooks/useDrawingState.ts',
        'client/src/hooks/useChartScales.ts',
        'client/src/hooks/useErrorHandler.ts',
        'client/src/components/ErrorBoundary.tsx',
        'client/src/components/LoadingSpinner.tsx',
        'client/src/components/menus/TrendlineMenu.tsx',
        'client/src/components/menus/HorizontalMenu.tsx',
        'client/src/components/menus/ChannelMenu.tsx',
        'client/src/components/menus/MenuButton.tsx',
        'client/src/components/menus/MenuDragHandle.tsx',
        'client/src/lib/errorHandler.ts',
        'client/src/lib/cryptoAiDeepJob.ts',
        'api/_lib/deepDiveJobBudget.ts',
        'api/_lib/deepDiveJobs.ts',
        'api/_lib/falconCloudClient.ts',
        'api/_lib/falconMarkets.ts',
        'api/_lib/falconTimeQuality.ts',
        'client/src/lib/watchlistHints.ts',
      ],
      // Exclude patterns
      exclude: [
        'client/src/**/*.test.{ts,tsx}',
        'client/src/**/__tests__/**',
        'client/src/vite-env.d.ts',
        'client/src/main.tsx',
      ],
    },
    
    // Test file patterns
    include: ['client/src/**/*.{test,spec}.{ts,tsx}', 'api/_lib/**/*.test.ts'],
    
    // Exclude patterns
    exclude: ['node_modules', 'dist', 'client/dist', '.git'],
    
    // Test timeout
    testTimeout: 30000,
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@assets': path.resolve(__dirname, 'client/src/assets/media'),
    },
  },
})
