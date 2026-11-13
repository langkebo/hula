/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test'
import { DESKTOP_ONLY_SPECS, MOBILE_ONLY_SPECS, specIgnorePattern } from './e2e/specRouteSets'

const liveHomeserverUrl = process.env.MATRIX_LIVE_HOMESERVER_URL?.trim()

/**
 * 两套 dev server（构建期路由装配决定，见 `src/router/entries/platformRoutes.ts`）：
 *
 * - 5210：`TAURI_ENV_PLATFORM=android` ⇒ 装配**移动端**路由集（`/mobile/*`）
 * - 5211：`TAURI_ENV_PLATFORM=windows`  ⇒ 装配**桌面端**路由集（`/message`、`/settings`…）
 *
 * 历史坑（§4.12-④ / §4.13-④「桌面空窗」）：以前只有 5210，`desktop-chromium` 项目也跑在
 * 移动端路由集上，桌面 spec 要么跳过、要么只能验到不存在的路由 ⇒ 桌面结论长期空窗。
 * 现在按项目分流：桌面项目跑 5211 并排除移动专属 spec，移动项目跑 5210。
 *
 * spec 归属**不在本文件硬编码**：名单与判定逻辑统一在 `e2e/specRouteSets.ts`，
 * 每个 spec 顶部还要写 `路由集: desktop|mobile|both`，由 `tests/lint/e2e-route-sets.test.ts`
 * 校验三者一致 —— 忘记登记会直接红，而不是变成假红。
 *
 * 另一处环境前提：宿主的 `NODE_OPTIONS` 会注入 WorkBuddy 的 safe-delete shim，
 * vite 预构建清理 `node_modules/.vite/deps`（>50 文件）会被拦成
 * `SAFE_DELETE_BULK_CONFIRM_REQUIRED` 直接起不来 ⇒ 两个 server 都显式清空。
 */
const APP_URL_MOBILE = 'http://127.0.0.1:5210'
const APP_URL_DESKTOP = 'http://127.0.0.1:5211'

const MOBILE_ONLY_SPECS_IGNORE = specIgnorePattern(MOBILE_ONLY_SPECS)
const DESKTOP_ONLY_SPECS_IGNORE = specIgnorePattern(DESKTOP_ONLY_SPECS)

const serverBaseEnv = {
  ...process.env,
  NODE_OPTIONS: '',
  CODEBUDDY_BROKERED_FS_HOOK_ENABLED: '0'
}

/** 全局忽略：单测目录与 Storybook 视觉基线都不属于应用 e2e。 */
const BASE_IGNORE = ['**/__tests__/**', '**/visual/**']

export default defineConfig({
  testDir: './e2e',
  // visual 子目录跑 Storybook 截图基线（见 playwright.visual.config.ts），不属于应用 e2e
  testIgnore: BASE_IGNORE,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: APP_URL_MOBILE,
    trace: 'on-first-retry'
  },
  webServer: [
    {
      command: 'pnpm dev --host 127.0.0.1 --port 5210',
      env: {
        ...serverBaseEnv,
        // 走 mobile vite 配置（含 VantResolver + NaiveUiResolver），否则 van-* 组件在 e2e 中解析失败
        TAURI_ENV_PLATFORM: 'android',
        ...(liveHomeserverUrl ? { VITE_HOMESERVER_URL: liveHomeserverUrl } : {})
      },
      url: APP_URL_MOBILE,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000
    },
    {
      command: 'pnpm dev --host 127.0.0.1 --port 5211',
      env: {
        ...serverBaseEnv,
        // 桌面 vite 配置：只有 PC 平台才走 desktopConfig，否则 `/message`、`/settings` 全部 404
        TAURI_ENV_PLATFORM: 'windows',
        ...(liveHomeserverUrl ? { VITE_HOMESERVER_URL: liveHomeserverUrl } : {})
      },
      url: APP_URL_DESKTOP,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000
    }
  ],
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], baseURL: APP_URL_DESKTOP },
      // ⚠️ 项目级 testIgnore 会**整体覆盖**全局 testIgnore（Playwright 行为），
      // 因此这里必须把全局的两条也一起列上，否则 `e2e/support/__tests__/*.test.ts`
      // 这类 vitest 文件会被当成 Playwright 用例收集（实测报 `reading 'config'`）。
      testIgnore: [...BASE_IGNORE, MOBILE_ONLY_SPECS_IGNORE]
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], baseURL: APP_URL_MOBILE },
      // 同 desktop-chromium 的注意点：项目级 testIgnore 覆盖全局，必须带上 BASE_IGNORE
      testIgnore: [...BASE_IGNORE, DESKTOP_ONLY_SPECS_IGNORE]
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'], baseURL: APP_URL_MOBILE },
      testIgnore: [...BASE_IGNORE, DESKTOP_ONLY_SPECS_IGNORE]
    }
  ]
})
