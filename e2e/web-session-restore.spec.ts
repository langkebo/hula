import { expect, test } from '@playwright/test'
import { loginOnMobileUi } from './support/androidDevice'

/**
 * 浏览器态「刷新后仍在登录态」。
 *
 * 背景：`hasTauriRuntime()` 为真不代表 Rust 侧能存取凭证 —— e2e 的 Tauri shim 会伪造
 * `__TAURI_INTERNALS__`，`GET_USER_TOKENS` 拿不到 token，刷新必掉登录，于是
 * 「进程重建后恢复」在浏览器里永远测不了。
 *
 * 现在 `SessionRestoreService.getStoredTokens()` 在 Rust 侧无令牌时回退到浏览器
 * at-rest token（`tjg.matrix.accessToken`）；是否允许这么用由显式开关
 * `tjg:session:web-fallback=1` 控制（真机默认关闭，凭证只由 Rust 保管）。
 *
 * 这条用例就是该回退的端到端证明：登录 → 整页 reload → 仍在登录态。
 *
 * 默认不跑：`TJG_MOBILE_LIVE=1` 开启。
 */

const APP_URL = (process.env.TJG_MOBILE_APP_URL ?? 'http://127.0.0.1:5210').replace(/\/$/, '')
const SKIP_REASON = process.env.TJG_MOBILE_LIVE ? null : '未设置 TJG_MOBILE_LIVE（需可用的本地 homeserver）'
const PW = 'Xmobile!e2e-restore-1'

const registerAccount = async (prefix: string): Promise<{ username: string; password: string }> => {
  let lastError = ''
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const username = `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
    const res = await fetch(`${APP_URL}/_matrix/client/v3/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: PW, auth: { type: 'm.login.dummy' } })
    })
    if (res.ok) return { username, password: PW }
    lastError = `HTTP ${res.status} ${await res.text()}`
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`注册账号失败: ${lastError}`)
}

test.describe('浏览器态会话恢复', () => {
  test.skip(Boolean(SKIP_REASON), SKIP_REASON ?? '')

  test('整页刷新后仍保持登录（localStorage 回退生效）', async ({ page }) => {
    test.setTimeout(240_000)

    const account = await registerAccount('mrestore')

    // 两个关键前置：跳过引导 + 打开 web 会话回退开关（shim 场景必须显式开）
    await page.addInitScript(() => {
      window.localStorage.setItem('guide', JSON.stringify({ isGuideCompleted: true }))
      window.localStorage.setItem('tjg:session:web-fallback', '1')
    })

    await loginOnMobileUi(page, { appUrl: APP_URL, account: account.username, password: account.password })
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toContain('/mobile/')

    // 整页刷新 = 浏览器里「进程重建」的等价物
    await page.reload({ waitUntil: 'domcontentloaded' })
    // 刷新会重跑启动流程，「设置本地解锁密码」门禁会再弹一次
    const skip = page.locator('[data-test="local-unlock-skip"]')
    if (await skip.count()) {
      await skip
        .first()
        .dispatchEvent('click')
        .catch(() => {})
    }

    // 断言 1：没有被打回登录页
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 60_000, message: '刷新后被踢回登录页：会话恢复失败' })
      .not.toContain('/login')

    // 断言 2：确实在登录态（能渲染出登录后才有的话务页面骨架）
    await expect(page.locator('#app')).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => Boolean(window.localStorage.getItem('tjg.matrix.accessToken'))), {
        timeout: 10_000
      })
      .toBe(true)
  })
})
