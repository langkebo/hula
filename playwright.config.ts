/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test'

const liveHomeserverUrl = process.env.MATRIX_LIVE_HOMESERVER_URL?.trim()

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:5210',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 5210',
    env: {
      ...process.env,
      // 走 mobile vite 配置（含 VantResolver + NaiveUiResolver），否则 van-* 组件在 e2e 中解析失败
      TAURI_ENV_PLATFORM: 'android',
      ...(liveHomeserverUrl ? { VITE_HOMESERVER_URL: liveHomeserverUrl } : {})
    },
    url: 'http://127.0.0.1:5210',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] }
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] }
    }
  ]
})
