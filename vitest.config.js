import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/global-setup.js'],
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['tests/generated/**/*.js'],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
    },
  },
});
