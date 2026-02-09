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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: [
        'src/lib/**/*.ts',
        'supabase/functions/_shared/cors.ts',
        'supabase/functions/_shared/rateLimit.ts',
        'supabase/functions/_shared/validation.ts',
      ],
      exclude: [
        '**/__tests__/**',
        '**/*.d.ts',
        'src/lib/supabase.ts',
      ],
    },
  },
})
