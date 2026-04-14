/**
 * 集成测试专用 Vitest 配置
 */

import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

export default defineConfig({
  plugins: [vue(), vueJsx()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/test/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 60000,
    hookTimeout: 30000,
    retry: 2,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/services/matrix/**/*.ts'],
      exclude: [
        'src/services/matrix/**/*.d.ts',
        'src/services/matrix/**/__tests__/**',
        'src/services/matrix/**/index.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../src', import.meta.url)),
      '~': fileURLToPath(new URL('../../', import.meta.url)),
      '#': fileURLToPath(new URL('../../src/mobile', import.meta.url)),
      'matrix-js-sdk/src/*': fileURLToPath(new URL('../../../matrix-js-sdk/src', import.meta.url))
    }
  }
})
