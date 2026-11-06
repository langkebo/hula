import { expect, test } from '@playwright/test'
import { loginOnMobileUi } from './support/androidDevice'

/**
 * 移动端好友列表与好友卡片（真实后端 + 真实登录）。
 *
 * 这条用例存在的背景：`/mobile/friends` 曾经**永远停在「加载中」**——
 * 页面的 `initialLoading` 来自 `useFriends()`，只在 `initialize()` 里被置 false，
 * 而 `onMounted` 只调了 `contactStore.getContactList()`。于是 `.van-loading` 常驻、
 * 分组与好友行一个都不渲染，看起来像「好友卡片 0 行」。
 *
 * 断言口径：
 * 1) 加载态必须退出（没有常驻 `.van-loading`）；
 * 2) 好友行真的渲染出来（`.van-swipe-cell` 命中对方）；
 * 3) 点行能进好友卡片（URL 带 uid，且卡片上能看到对方标识）。
 *
 * 默认不跑：`TJG_MOBILE_LIVE=1` 开启（会注册临时账号）。
 */

const APP_URL = (process.env.TJG_MOBILE_APP_URL ?? 'http://127.0.0.1:5210').replace(/\/$/, '')
const SKIP_REASON = process.env.TJG_MOBILE_LIVE ? null : '未设置 TJG_MOBILE_LIVE（需可用的本地 homeserver）'

interface Account {
  userId: string
  accessToken: string
  username: string
  password: string
}

const registerAccount = async (prefix: string): Promise<Account> => {
  const password = `Xmobile!${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 10)}`
  let lastError = ''
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const username = `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
    const res = await fetch(`${APP_URL}/_matrix/client/v3/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, auth: { type: 'm.login.dummy' } })
    })
    if (res.ok) {
      const data = (await res.json()) as { user_id: string; access_token: string }
      return { userId: data.user_id, accessToken: data.access_token, username, password }
    }
    lastError = `HTTP ${res.status} ${await res.text()}`
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`注册账号失败: ${lastError}`)
}

/** 建好友关系：peer 发请求 → self 接受 */
const seedFriendship = async (self: Account, peer: Account): Promise<void> => {
  const req = await fetch(`${APP_URL}/_matrix/vendor/v1/friends/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${peer.accessToken}` },
    body: JSON.stringify({ user_id: self.userId, message: 'e2e' })
  })
  if (!req.ok) throw new Error(`好友请求失败: HTTP ${req.status} ${await req.text()}`)
  const acc = await fetch(`${APP_URL}/_matrix/vendor/v1/friends/request/${encodeURIComponent(peer.userId)}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${self.accessToken}` }
  })
  if (!acc.ok) throw new Error(`接受好友失败: HTTP ${acc.status} ${await acc.text()}`)
}

/** SPA 导航：浏览器态 token 只在内存，整页 `goto` 会掉登录 */
const pushRoute = async (page: import('@playwright/test').Page, to: unknown): Promise<void> => {
  await page.evaluate(async (target) => {
    const appRoot = document.querySelector('#app') as
      | (HTMLElement & {
          __vue_app__?: { config: { globalProperties: { $router?: { push: (to: unknown) => Promise<unknown> } } } }
        })
      | null
    const router = appRoot?.__vue_app__?.config?.globalProperties?.$router
    if (!router) throw new Error('应用 $router 不可达')
    await router.push(target)
  }, to)
}

test.describe('移动端好友列表与好友卡片', () => {
  test.skip(Boolean(SKIP_REASON), SKIP_REASON ?? '')

  test('加载态能退出、好友行可见、点开好友卡片', async ({ page }) => {
    test.setTimeout(240_000)

    const self = await registerAccount('mfriend')
    const peer = await registerAccount('mfriendpeer')
    await seedFriendship(self, peer)

    // 跳过 driver.js 引导
    await page.addInitScript(() => {
      window.localStorage.setItem('guide', JSON.stringify({ isGuideCompleted: true }))
    })

    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })
    await pushRoute(page, { name: 'mobileFriends' })

    // 1) 加载态必须退出（历史缺陷：常驻 van-loading，页面只剩骨架）
    await expect(page.locator('.van-loading'), '好友页停在「加载中」：initialLoading 没被清').toHaveCount(0, {
      timeout: 30_000
    })

    // 2) 好友行真的渲染出来（对方默认显示名是 localpart）
    const row = page.locator('.van-swipe-cell').filter({ hasText: peer.username }).first()
    await expect(row, '好友列表没有渲染出任何行').toBeVisible({ timeout: 30_000 })

    // 3) 点行 → 好友卡片
    await row.locator('.item-box').first().click({ force: true })
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toContain('/mobile/mobileFriends/friendInfo/')
    await expect(page.locator('body')).toContainText(peer.username, { timeout: 20_000 })
  })
})
