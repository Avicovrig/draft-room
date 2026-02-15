import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    exclude: ['node_modules', 'dist', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: [
        'src/lib/**/*.ts',
        // Edge function shared utils (cors, rateLimit, validation, draftOrder) are tested
        // via re-implementation in supabase/functions/_shared/__tests__/ because Vitest
        // can't resolve Deno-style .ts imports. They're excluded from coverage metrics
        // but their logic is validated by 80+ re-implementation tests.
      ],
      exclude: [
        '**/__tests__/**',
        '**/*.d.ts',
        'src/lib/supabase.ts',
        // Type-only files (no runtime code)
        'src/lib/types.ts',
        'src/lib/spreadsheetTypes.ts',
        // Browser-dependent files that require Web Audio API / ExcelJS / FileReader / location mocking
        'src/lib/lazyWithRetry.ts',
        'src/lib/sounds.ts',
        'src/lib/exportPlayers.ts',
        'src/lib/exportDraftResults.ts',
        'src/lib/generateTemplate.ts',
      ],
      thresholds: {
        // Thresholds apply to src/lib files that are meaningfully testable.
        // Edge function shared files show 0% because tests re-implement the logic
        // (Deno-style .ts imports can't be resolved by Vitest).
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
