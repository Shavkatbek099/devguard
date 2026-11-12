import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@devguard/core': p('./packages/core/src/index.ts'),
      '@devguard/validator': p('./packages/validator/src/index.ts'),
      '@devguard/scanner': p('./packages/scanner/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 30000,
  },
});
