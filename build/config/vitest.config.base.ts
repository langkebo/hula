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
  define: {
    // 测试环境按桌面态编译，避免 __TJG_MOBILE_BUILD__ 未定义
    __TJG_MOBILE_BUILD__: 'false'
  },
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
      reporter: ['text', 'json', 'json-summary', 'html'],
      // 即使套件里有失败用例也强制落盘：全量运行时事件循环可能被加密货币相关图谱阻塞，
      // 进程在 close 阶段超时退出，若不开启此选项覆盖率报告将不会被写出（CI artifact 为空）。
      reportOnFailure: true,
      include: ['src/**/*.{vue,js,jsx,ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{js,ts}', 'src/types/**', 'src/**/*.d.ts'],
      // 覆盖率地板：以 2026-10-12 全量实测值向下取整。权威登记见 scripts/coverage-floor.json，
      // 由 scripts/check-coverage-floor.mjs 做「只升不降」的棘轮断言。此处为第二道防线，
      // 保证 vitest 自身在低于阈值时即以非零码退出。
      thresholds: {
        lines: 51,
        statements: 50,
        functions: 43,
        branches: 41
      }
    }
  }
}

export default defineConfig(baseVitestConfig)
