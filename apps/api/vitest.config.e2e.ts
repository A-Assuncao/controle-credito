import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * Config separada para suite e2e.
 *
 * Usa unplugin-swc (transformer baseado em Rust) em vez do esbuild padrao.
 * Motivo: esbuild 0.21 (vitest 3.x) NAO emite `__metadata("design:paramtypes")`
 * para decorators em modo ESM, o que quebra constructor injection do Nest.
 *
 * SWC tem suporte estavel a decorators legacy + emitDecoratorMetadata.
 */
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: {
          syntax: 'typescript',
          decorators: true,
          dynamicImport: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        keepClassNames: true,
      },
      module: {
        type: 'es6',
      },
    }),
  ],
  test: {
    globals: false,
    environment: 'node',
    include: ['test/e2e/**/*.test.ts'],
    hookTimeout: 60_000,
    testTimeout: 30_000,
    teardownTimeout: 30_000,
    pool: 'forks',
    fileParallelism: false,
  },
});
