import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A simulação não toca no DOM, então os testes rodam em Node puro.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
