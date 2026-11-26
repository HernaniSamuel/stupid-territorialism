import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths, so the build works under a sub-folder such as user.github.io/repo-name/.
  base: './',
  test: {
    // The simulation doesn't touch the DOM, so the tests run in plain Node.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
