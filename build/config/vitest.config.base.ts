import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import type { UserConfig } from 'vite'
import { defineConfig } from 'vitest/config'
import { getComponentsDirs, getComponentsDtsPath, getComponentsGlobs } from './components'

const testPlatform = process.env.TAURI_ENV_PLATFORM
const testComponentsDirs = getComponentsDirs(testPlatform)
const testComponentsDtsPath = getComponentsDtsPath(testPlatform)
const testComponentsGlobs = getComponentsGlobs(testPlatform)

export const baseVitestConfig: UserConfig = {
  plugins: [
    vue(),
    vueJsx(),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'pinia',
        {
          'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar', 'useModal']
        }
      ],
      dts: 'src/typings/auto-imports.d.ts'
    }),
    Components({
      dirs: testComponentsDirs,
      globs: testComponentsGlobs,
      resolvers: [NaiveUiResolver()],
      dts: testComponentsDtsPath
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../src', import.meta.url)),
      '#': fileURLToPath(new URL('../../src/mobile', import.meta.url)),
      '~': fileURLToPath(new URL('../../', import.meta.url))
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{vue,js,jsx,ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{js,ts}', 'src/types/**', 'src/**/*.d.ts']
    }
  }
}

export default defineConfig(baseVitestConfig)
