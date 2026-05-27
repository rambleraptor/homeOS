import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // tsconfig sets `jsx: preserve` for Next.js, which leaves the JSX
  // runtime up to the bundler. Vitest doesn't go through Next.js, so
  // pin it to the automatic runtime here — otherwise components that
  // don't import `React` blow up at render time with
  // `ReferenceError: React is not defined`.
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
      '../packages/*/**/*.{test,spec}.{js,jsx,ts,tsx}',
    ],
    // Playwright e2e specs colocated next to their modules live under
    // `packages/homestead-modules/<module>/e2e/`. Vitest must not run them.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '../packages/homestead-modules/**/e2e/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@homestead/config': path.resolve(__dirname, '../homestead.config.ts'),
    },
  },
});
