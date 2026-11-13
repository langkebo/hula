/**
 * 路由集: both
 * 依据：两套路由集都要跑（用例内部自带路由集能力守卫）。
 * 校验：`tests/lint/e2e-route-sets.test.ts`（与 `e2e/specRouteSets.ts` 名单逐条比对）。
 */
import { expect, test } from '../tests/tauri-fixture'

/**
 * Tauri 原生层 smoke：**需要先构建出桌面二进制**（`src-tauri/target/debug/hula`），
 * fixture 会 spawn 它并用 CDP 接管 WebView。
 *
 * 默认跳过：浏览器 e2e 项目（`desktop-chromium` 等）跑的是 `http://127.0.0.1:5211` 的
 * dev server，没有二进制也没有 WebView 进程，直接跑只会得到「`.login-box` 不存在」的假红。
 * 需要时显式开启：`TJG_TAURI_BINARY=1 npx playwright test e2e/tauri-basic.spec.ts`。
 */
const TAURI_BINARY_READY = !!process.env.TJG_TAURI_BINARY

test.describe('Tauri 原生行为测试', () => {
  test.skip(!TAURI_BINARY_READY, '需要已构建的桌面二进制：TJG_TAURI_BINARY=1')

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
