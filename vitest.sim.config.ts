import { defineConfig } from 'vitest/config';

// Configuration for the bot tournament only (`npm run sim`). Kept out of `npm test` because it is slow.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['sim/**/*.sim.ts'],
    testTimeout: 3_600_000,
    // Without this, Vitest hides the console.log output with the results.
    disableConsoleIntercept: true,
    silent: false,
  },
});
