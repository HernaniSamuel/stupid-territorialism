import { defineConfig } from 'vitest/config';

// Configuração só do torneio de bots (`npm run sim`). Fica fora do `npm test` porque demora.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['sim/**/*.sim.ts'],
    testTimeout: 3_600_000,
    // Sem isso o Vitest esconde o console.log com o resultado.
    disableConsoleIntercept: true,
    silent: false,
  },
});
