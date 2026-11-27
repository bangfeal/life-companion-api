import { defineConfig } from 'vitest/config';
// Migration setup shares the explicit test database: serialize test files.
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
  },
});
