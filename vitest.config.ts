/// <reference types="vitest" />

import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vitest/config'
import { getComponentsDirs, getComponentsDtsPath, getComponentsGlobs } from './build/config/components'
import path from 'node:path'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const testPlatform = process.env.TAURI_ENV_PLATFORM
const testComponentsDirs = getComponentsDirs(testPlatform)
const testComponentsDtsPath = getComponentsDtsPath(testPlatform)
const testComponentsGlobs = getComponentsGlobs(testPlatform)
export default defineConfig({
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
    }) /**自动导入组件，但是不会自动导入jsx和tsx*/,
    Components({
      dirs: testComponentsDirs,
      // 根据环境加载对应组件目录
      globs: testComponentsGlobs,
      resolvers: [NaiveUiResolver()],
      dts: testComponentsDtsPath
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '#': fileURLToPath(new URL('./src/mobile', import.meta.url)),
      '~': fileURLToPath(new URL('.', import.meta.url))
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
    },
    projects: [
      {
        extends: true,
        test: {
          environment: 'happy-dom',
          globals: true,
          setupFiles: ['./tests/setup.ts'],
          include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
        }
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook')
          })
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium'
              }
            ]
          }
        }
      }
    ]
  }
})
