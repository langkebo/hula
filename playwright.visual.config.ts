/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test'

const storybookUrl = process.env.STORYBOOK_URL?.trim() || 'http://127.0.0.1:6006'

/**
 * Storybook 视觉基线配置。
 *
 * 与 `playwright.config.ts`（应用 e2e）分离：这里只跑 `e2e/visual` 下的
 * story 截图断言，webServer 指向 Storybook 而不是 `pnpm dev`。
 *
 * 基线按平台提交（Playwright 默认 `-{platform}` 后缀）。没有当前平台基线时
 * 用例会显式 SKIP 并给出 `pnpm test:visual:update` 提示，不会静默变绿。
 */
export default defineConfig({
  testDir: './e2e/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  // 相对用例文件所在目录解析，最终落在 e2e/visual/__screenshots__/
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}-{projectName}-{platform}{ext}',
  use: {
    baseURL: storybookUrl,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    trace: 'off'
  },
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      // 同平台内允许 1% 像素抖动，覆盖字体抗锯齿与亚像素误差
      maxDiffPixelRatio: 0.01,
      threshold: 0.2
    }
  },
  projects: [{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm storybook --ci --quiet',
    url: storybookUrl,
    // CI 中复用 a11y 步骤已启动的 Storybook；本地复用开发者手动启动的实例
    reuseExistingServer: true,
    timeout: 120 * 1000
  }
})
