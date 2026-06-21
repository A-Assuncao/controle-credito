import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'test/unit/**/*.test.ts'],
    /**
     * Sprint 1: sem testes no apps/api ainda (conteudo real entra
     * na task 6). passWithNoTests evita que o CI falhe ate la.
     */
    passWithNoTests: true,
  },
});
