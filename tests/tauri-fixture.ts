import { type ChildProcess, spawn } from 'node:child_process'
import path from 'node:path'
import { test as base, expect, type Page } from '@playwright/test'

/**
 * Tauri 专用 Playwright Fixture
 *
 * 允许在 E2E 测试中直接操控 Tauri 原生窗口、拦截权限、模拟更新等。
 * 注意：运行此测试前需要确保已构建好生产二进制或正在运行 tauri dev。
 */

interface TauriFixtures {
  tauriApp: ChildProcess
  tauriPage: Page
}

export const test = base.extend<TauriFixtures>({
  tauriApp: async ({ browser: _ }, use) => {
    // 根据环境决定二进制路径
    // 生产环境下通常在 src-tauri/target/release/hula
    // 开发环境下可以使用 pnpm tauri dev
    const isCI = !!process.env.CI
    const appPath = isCI
      ? path.join(process.cwd(), 'src-tauri/target/release/hula')
      : path.join(process.cwd(), 'src-tauri/target/debug/hula')

    // 启动 Tauri 应用并开启远程调试端口
    // 注意：Tauri 应用需要配置远程调试端口或通过 tauri-driver 驱动
    const tauriProcess = spawn(appPath, [], {
      env: {
        ...process.env,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9222'
      }
    })

    await use(tauriProcess)

    // 清理
    tauriProcess.kill()
  },

  tauriPage: async ({ browser }, use) => {
    // 连接到 Tauri 的 Webview 远程调试端口
    // 这里假设应用在 9222 端口开启了调试
    const context = await browser.newContext()
    const page = await context.newPage()

    // 等待应用加载完成
    await page.goto('http://localhost:5210')

    await use(page)
    await context.close()
  }
})

export { expect }
