import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'research/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
});
