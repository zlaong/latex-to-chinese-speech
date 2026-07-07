import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30000, // SRE first-time init can take ~1s
    hookTimeout: 30000,
  },
});
