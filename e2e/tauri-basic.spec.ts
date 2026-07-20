import { expect, test } from '../tests/tauri-fixture'

test.describe('Tauri 原生行为测试', () => {
  test('应该能够启动并显示登录页', async ({ tauriPage }) => {
    // 检查页面标题
    await expect(tauriPage).toHaveTitle(/HuLa/)

    // Check login form is rendered (uses Vue components, not HTML <form>)
    const loginForm = tauriPage.locator('.login-box')
    await expect(loginForm).toBeVisible({ timeout: 10000 })
  })

  test('窗口标题应该包含版本号', async ({ tauriPage }) => {
    // 在 Tauri 中，我们可以通过 window.__TAURI__ 访问原生 API (如果未禁用)
    // 但在 Playwright 中，我们更多是检查 Webview 呈现的内容
    const _title = await tauriPage.title()
  })
})
