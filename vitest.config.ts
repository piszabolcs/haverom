import { defineConfig } from 'vitest/config';

// The tested modules are plain logic or server-rendered components, so a node environment is enough.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'electron/**/*.test.ts']
  }
});
