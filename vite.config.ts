import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The simulation doesn't touch the DOM, so the tests run in plain Node.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
