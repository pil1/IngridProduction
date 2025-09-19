import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/components/ui/', // Exclude shadcn/ui components from coverage
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        'android/',
        'ios/',
        'supabase/'
      ],
      thresholds: {
        global: {
          branches: 50,
          functions: 50,
          lines: 60,
          statements: 60
        }
      }
    },
    // Increase timeout for integration tests
    testTimeout: 10000,
    // Mock configuration
    server: {
      deps: {
        inline: ['@testing-library/user-event']
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});