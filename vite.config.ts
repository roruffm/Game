import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative paths so the build works on GitHub Pages (/Game/) and any other sub-path.
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
