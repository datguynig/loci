import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          epub: ['epubjs', 'jszip'],
          motion: ['framer-motion'],
          clerk: ['@clerk/clerk-react'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    watch: {
      ignored: ['**/test-results/**', '**/.playwright-mcp/**'],
    },
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      path: 'path-browserify',
    },
  },
  optimizeDeps: {
    include: ['epubjs'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/utils/**',
        'src/services/annotationService.ts',
        'src/hooks/usePreferences.ts',
      ],
      exclude: [],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
      reporter: ['text', 'html'],
    },
  },
})
