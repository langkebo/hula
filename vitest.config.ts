import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

export default defineConfig({
  plugins: [vue(), vueJsx()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'e2e', 'src/test/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', '!src/**/*.d.ts'],
      exclude: ['src/**/*.vue', 'src/types/**', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
      thresholds: {
        lines: 8.5,
        functions: 9.5,
        branches: 5,
        statements: 8.5
      }
    },
    pool: 'forks',
    singleFork: true,
    testTimeout: 30000,
    hookTimeout: 30000
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '~': fileURLToPath(new URL('.', import.meta.url)),
      '#': fileURLToPath(new URL('./src/mobile', import.meta.url)),
      'matrix-js-sdk/src/*': fileURLToPath(new URL('../matrix-js-sdk/src', import.meta.url))
    }
  }
})
