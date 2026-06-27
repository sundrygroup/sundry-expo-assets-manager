import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      vscode: fileURLToPath(new URL('./test/mocks/vscode.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
  },
  esbuild: {
    target: 'es2022',
  }
});
