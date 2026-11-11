import { expect, test } from '@playwright/test'
import { WEB_SESSION_FALLBACK_STORAGE_KEY } from '../src/utils/storageKeys'
import { loginOnMobileUi } from './support/androidDevice'
import { autoDismissLocalUnlockGate, dismissLocalUnlockDialog } from './support/localUnlockGate'

/**
 * 浏览器态「刷新后仍在登录态」。
 *
 * 背景：`hasTauriRuntime()` 为真不代表 Rust 侧能存取凭证 —— e2e 的 Tauri shim 会伪造
 * `__TAURI_INTERNALS__`，`GET_USER_TOKENS` 拿不到 token，刷新必掉登录，于是
 * 「进程重建后恢复」在浏览器里永远测不了。
 *
 * 现在 `SessionRestoreService.getStoredTokens()` 在 Rust 侧无令牌时回退到浏览器
 * at-rest token（`tjg.matrix.accessToken`）；是否允许这么用由显式开关
 * `${WEB_SESSION_FALLBACK_STORAGE_KEY}=1` 控制（真机默认关闭，凭证只由 Rust 保管）。
 *
 * 这条用例就是该回退的端到端证明：登录 → 整页 reload → 仍在登录态。
 *
 * 默认不跑：`TJG_MOBILE_LIVE=1` 开启。
 */

const APP_URL = (process.env.TJG_MOBILE_APP_URL ?? 'http://127.0.0.1:5210').replace(/\/$/, '')
const SKIP_REASON = process.env.TJG_MOBILE_LIVE ? null : '未设置 TJG_MOBILE_LIVE（需可用的本地 homeserver）'
const PW = 'Xmobile!e2e-restore-1'

const registerAccount = async (prefix: string): Promise<{ username: string; password: string; userId: string }> => {
  let lastError = ''
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const username = `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
    const res = await fetch(`${APP_URL}/_matrix/client/v3/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: PW, auth: { type: 'm.login.dummy' } })
    })
    if (res.ok) {
      const data = (await res.json()) as { user_id?: string }
      return { username, password: PW, userId: data.user_id ?? '' }
    }
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
    await page.addInitScript((fallbackKey) => {
      window.localStorage.setItem('guide', JSON.stringify({ isGuideCompleted: true }))
      window.localStorage.setItem(fallbackKey, '1')
    }, WEB_SESSION_FALLBACK_STORAGE_KEY)

    // 常驻自动跳过「设置本地解锁密码」：它在 App.vue 里 **先于** bootstrap 被 await，
    // 不跳过则启动流程整体卡住，后面的会话恢复（D12）根本不会执行。
    // 必须用常驻版本：reload 与 `?platform=desktop` 的整页导航都会重新弹一次，
    // 且桌面弹窗与移动弹窗的触发时机不同（手点一次的写法会漏）。
    await autoDismissLocalUnlockGate(page)

    await loginOnMobileUi(page, { appUrl: APP_URL, account: account.username, password: account.password })
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toContain('/mobile/')

    // 整页刷新 = 浏览器里「进程重建」的等价物
    await page.reload({ waitUntil: 'domcontentloaded' })
    // 刷新会重跑启动流程，「设置本地解锁密码」门禁会再弹一次
    await dismissLocalUnlockDialog(page, 10_000)

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

    // 断言 3~5：D12 的真正判据 —— 「还在登录态」不等于「client 建起来了」。
    // 历史现象：路由放行、页面正常，但 getClient() 恒为 null，sync / crypto 都没启动。
    await expectClientRestored(page, account.userId)

    // 断言 6：桌面 home 窗口同样要能冷启动恢复。
    // 此前 app 级恢复只挂在 `isMobilePlatform`，桌面窗口整页 reload 后没有任何人调
    // `ensureClientReady`（只有进设置窗口才触发），于是 getClient() 恒 null。
    await page.goto(`${APP_URL}/?platform=desktop`, { waitUntil: 'domcontentloaded' })
    await dismissLocalUnlockDialog(page, 10_000)
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).not.toContain('/login')
    await expectClientRestored(page, account.userId, { label: '桌面窗口冷启动' })
  })
})

/**
 * 断言「client 真的建起来了」：非 null + userId 正确 + sync 进入 PREPARED/SYNCING。
 *
 * 只断言「没被踢回登录页」是不够的 —— D12 的表现正是页面正常但 client 为 null。
 */
const expectClientRestored = async (
  page: import('@playwright/test').Page,
  expectedUserId: string,
  options: { label?: string } = {}
) => {
  const label = options.label ?? '移动端冷启动'
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const { matrixClientService } = (await import(/* @vite-ignore */ '/src/services/matrix/index.ts')) as {
            matrixClientService: {
              getClient: () => { getUserId?: () => string | null; getSyncState?: () => string | null } | null
            }
          }
          const client = matrixClientService.getClient()
          return { hasClient: Boolean(client), userId: client?.getUserId?.() ?? null }
        }),
      { timeout: 90_000, message: `${label}：client 未建立（D12）` }
    )
    .toEqual({ hasClient: true, userId: expectedUserId })

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const { matrixClientService } = (await import(/* @vite-ignore */ '/src/services/matrix/index.ts')) as {
            matrixClientService: { getClient: () => { getSyncState?: () => string | null } | null }
          }
          return matrixClientService.getClient()?.getSyncState?.() ?? null
        }),
      { timeout: 90_000, message: `${label}：sync 未进入 PREPARED/SYNCING（client 建了但没同步）` }
    )
    .toMatch(/PREPARED|SYNCING/)
}
