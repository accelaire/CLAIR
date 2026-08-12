import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Pool 'forks' obligatoire : avec le pool 'threads' par défaut, le client
    // Prisma laisse des FILEHANDLE ouverts que le worker ne peut pas fermer.
    // Les tests passaient bien, puis vitest restait bloqué indéfiniment sur
    // « Failed to terminate worker ». Un process forké, lui, se tue proprement.
    pool: 'forks',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/index.ts',
        'src/types/**',
      ],
    },
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
