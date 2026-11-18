/**
 * 路由集: mobile
 * 依据：断言 `/mobile/*` 的安全区 / 键盘抬升布局与底部 TabBar；桌面 dev server（5211）没有这些路由。
 * 校验：`tests/lint/e2e-route-sets.test.ts`（与 `e2e/specRouteSets.ts` 名单逐条比对）。
 */
import { expect, type Page, test } from '@playwright/test'
import { loginOnMobileUi } from './support/androidDevice'

/**
 * 安全区与键盘弹起回归（方案 §5 阶段 C3）。
 *
 * 真机截图对比需要硬件，但下列链路都可以在 mobile-chromium 视口下复跑：
 * 1. 竖屏：底部 TabBar 贴住视口底边、高度 >= 62、`padding-bottom` 与
 *    `--safe-area-inset-bottom` 解析值一致、无横向溢出、tab 壳内没有多余的底部安全区元素；
 * 2. 横屏：TabBar 切为 72px 垂直侧栏，且不继承底部安全区 padding（底部改由 padding-left 承担）；
 * 3. 键盘：`meta.bottomInput` 页面（聊天）随 `visualViewport` 抬升，输入坞不被键盘遮挡，
 *    同时隐藏底部安全区；无 `bottomInput` 的会话列表页保持 0 抬升（负对照）。
 *
 * 键盘部分用可变 `visualViewport` 替身驱动：`useViewportInset` 只在组件挂载时读一次
 * `window.visualViewport`，所以替身必须在应用启动前注入（addInitScript），
 * 之后改高度并派发 `resize` 即可复现 IME 遮挡。
 *
 * 默认不跑（需可用 homeserver + 真实账号）：`TJG_MOBILE_LIVE=1` 开启。
 * 账号默认取验收环境提供的 `testuser1 / Test@123`，可用
 * `TJG_MOBILE_ACCOUNT` / `TJG_MOBILE_PASSWORD` 覆盖。
 */

const APP_URL = (process.env.TJG_MOBILE_APP_URL ?? 'http://127.0.0.1:5210').replace(/\/$/, '')
const SKIP_REASON = process.env.TJG_MOBILE_LIVE ? null : '未设置 TJG_MOBILE_LIVE（需可用的本地 homeserver）'
const LOGIN_ACCOUNT = process.env.TJG_MOBILE_ACCOUNT ?? 'testuser1'
const LOGIN_PASSWORD = process.env.TJG_MOBILE_PASSWORD ?? 'Test@123'

interface Account {
  userId: string
  accessToken: string
  username: string
  password: string
}

/** 用真实账号走登录 API，仅用于建房播种（页面登录仍走 UI 表单）。 */
const loginViaApi = async (username: string, password: string): Promise<Account> => {
  const res = await fetch(`${APP_URL}/_matrix/client/v3/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: username },
      password
    })
  })
  if (!res.ok) throw new Error(`账号 ${username} 登录失败: HTTP ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { user_id: string; access_token: string }
  return { userId: data.user_id, accessToken: data.access_token, username, password }
}

const registerAccount = async (prefix: string): Promise<Account> => {
  const password = `Xsafezone!${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 10)}`
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

/** 建房 + 自建号 join（保证房间在自建号侧可见、可作聊天落点）。 */
const seedDirectRoom = async (self: Account, peer: Account, roomName: string): Promise<string> => {
  const createRes = await fetch(`${APP_URL}/_matrix/client/v3/createRoom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${peer.accessToken}` },
    body: JSON.stringify({ preset: 'private_chat', invite: [self.userId], is_direct: true, name: roomName })
  })
  if (!createRes.ok) throw new Error(`建房失败: HTTP ${createRes.status} ${await createRes.text()}`)
  const { room_id: roomId } = (await createRes.json()) as { room_id: string }
  await fetch(`${APP_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${self.accessToken}` },
    body: '{}'
  })
  return roomId
}

/** SPA 导航：浏览器态 token 只在内存，整页 `goto` 会掉登录。 */
const pushRoute = async (page: Page, to: unknown): Promise<void> => {
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

/**
 * 注入可变的 `visualViewport` 替身。
 *
 * 关键点：`useViewportInset` 在 `onMounted` 里抓 `window.visualViewport` 并订阅 `resize`，
 * 挂载后再替换对象不会生效。因此替身必须在首个文档加载前就位，
 * `__setKeyboardInset(n)` 改高度后对已订阅的监听器派发事件即可。
 */
const installFakeVisualViewport = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const win = window as Window & { __setKeyboardInset?: (px: number) => void }
    const listeners = new Set<(event: Event) => void>()
    const fake = {
      width: window.innerWidth,
      height: window.innerHeight,
      offsetTop: 0,
      offsetLeft: 0,
      pageTop: 0,
      pageLeft: 0,
      scale: 1,
      addEventListener(type: string, listener: (event: Event) => void) {
        if (type === 'resize' || type === 'scroll') listeners.add(listener)
      },
      removeEventListener(type: string, listener: (event: Event) => void) {
        if (type === 'resize' || type === 'scroll') listeners.delete(listener)
      },
      dispatchEvent() {
        return true
      }
    }
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => fake })
    win.__setKeyboardInset = (px: number) => {
      fake.height = window.innerHeight - px
      for (const listener of listeners) listener(new Event('resize'))
    }
  })
}

const setKeyboardInset = async (page: Page, px: number): Promise<void> => {
  await page.evaluate((value) => {
    const setter = (window as Window & { __setKeyboardInset?: (px: number) => void }).__setKeyboardInset
    if (!setter) throw new Error('fake visualViewport 未安装')
    setter(value)
  }, px)
}

/** 读 MobileLayout 根节点的底部内边距与底部安全区元素数量。 */
const readLayoutState = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector('#app .van-config-provider > div.tjg-aurora') as HTMLElement | null
    const form = document.querySelector('#message-form') as HTMLElement | null
    return {
      rootPaddingBottom: root ? getComputedStyle(root).paddingBottom : null,
      safeAreaBottomCount: document.querySelectorAll('.safe-area-bottom').length,
      inputBottom: form ? Math.round(form.getBoundingClientRect().bottom) : null,
      innerHeight: window.innerHeight
    }
  })

const skipGuide = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.localStorage.setItem('guide', JSON.stringify({ isGuideCompleted: true }))
  })
}

test.describe('移动端安全区与键盘弹起', () => {
  test.skip(Boolean(SKIP_REASON), SKIP_REASON ?? '')

  test('竖屏 TabBar 安全区贴底、横屏侧栏不继承底部 inset', async ({ page }) => {
    test.setTimeout(240_000)

    await skipGuide(page)
    await loginOnMobileUi(page, { appUrl: APP_URL, account: LOGIN_ACCOUNT, password: LOGIN_PASSWORD })
    await pushRoute(page, { name: 'mobileMessage' })
    await expect(page.locator('.tab-bar-wrap')).toBeVisible({ timeout: 30_000 })

    // 移动端样式是异步 import 的：等 token 落地再量，避免把「样式还没加载」误判成缺陷。
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom').trim()
          ),
        { timeout: 15_000, message: '--safe-area-inset-bottom 未定义（mobile.scss 未加载？）' }
      )
      .not.toBe('')

    const portrait = await page.evaluate(() => {
      const doc = document.documentElement
      const wrap = document.querySelector('.tab-bar-wrap') as HTMLElement | null
      const bar = document.querySelector('.tab-bar') as HTMLElement | null
      const probe = document.createElement('div')
      probe.style.paddingBottom = 'var(--safe-area-inset-bottom)'
      document.body.appendChild(probe)
      const resolvedToken = getComputedStyle(probe).paddingBottom
      probe.remove()
      return {
        innerHeight: window.innerHeight,
        wrapBottom: wrap ? Math.round(wrap.getBoundingClientRect().bottom) : null,
        barHeight: bar ? Math.round(bar.getBoundingClientRect().height) : null,
        barPaddingBottom: bar ? getComputedStyle(bar).paddingBottom : null,
        resolvedToken,
        horizontalOverflow: doc.scrollWidth - doc.clientWidth,
        safeAreaBottomCount: document.querySelectorAll('.safe-area-bottom').length,
        verticalSidebar: Boolean(document.querySelector('.tab-bar-wrap--vertical'))
      }
    })

    expect(portrait.verticalSidebar, '竖屏却渲染了垂直侧栏 TabBar').toBe(false)
    expect(portrait.wrapBottom, 'TabBar 未拿到布局').not.toBeNull()
    // 贴底：允许 1px 的 sub-pixel 取整误差
    expect(Math.abs((portrait.wrapBottom ?? 0) - portrait.innerHeight)).toBeLessThanOrEqual(1)
    expect(portrait.barHeight ?? 0).toBeGreaterThanOrEqual(62)
    // 底部安全区只由 .tab-bar 承担，且消费 token（浏览器 env() 解析为 0px）
    expect(portrait.barPaddingBottom).toBe(portrait.resolvedToken)
    expect(portrait.horizontalOverflow).toBeLessThanOrEqual(0)
    expect(portrait.safeAreaBottomCount, 'tab 壳内出现了底部安全区元素（应由 TabBar 独占）').toBe(0)

    // 横屏：TabBar 变 72px 垂直侧栏，底部安全区改由 padding-left 承担，不再叠加底部 inset
    await page.setViewportSize({ width: 915, height: 412 })
    await expect(page.locator('.tab-bar-wrap--vertical')).toBeVisible({ timeout: 15_000 })

    const landscape = await page.evaluate(() => {
      const wrap = document.querySelector('.tab-bar-wrap--vertical') as HTMLElement
      const bar = wrap.querySelector('.tab-bar') as HTMLElement
      return {
        wrapWidth: Math.round(wrap.getBoundingClientRect().width),
        wrapPaddingBottom: getComputedStyle(wrap).paddingBottom,
        barPaddingBottom: getComputedStyle(bar).paddingBottom,
        safeAreaBottomCount: document.querySelectorAll('.safe-area-bottom').length
      }
    })

    expect(landscape.wrapWidth).toBe(72)
    expect(landscape.wrapPaddingBottom).toBe('0px')
    expect(landscape.barPaddingBottom, '横屏侧栏继承了底部安全区 padding').toBe('0px')
    expect(landscape.safeAreaBottomCount).toBe(0)
  })

  test('聊天页随键盘抬升且不叠加底部安全区，会话列表不抬升（负对照）', async ({ page }) => {
    test.setTimeout(240_000)

    const self = await loginViaApi(LOGIN_ACCOUNT, LOGIN_PASSWORD)
    const peer = await registerAccount('mssafe')
    const roomId = await seedDirectRoom(self, peer, `safe-${Date.now().toString(36)}`)

    await skipGuide(page)
    await installFakeVisualViewport(page)
    await loginOnMobileUi(page, { appUrl: APP_URL, account: LOGIN_ACCOUNT, password: LOGIN_PASSWORD })
    await pushRoute(page, { name: 'mobileChatMain', params: { roomId } })
    await expect(page.locator('#message-form')).toBeVisible({ timeout: 30_000 })

    // 键盘弹起 320px：带底部输入栏的页面整体抬升，输入坞落在键盘上沿（不被遮挡）
    await setKeyboardInset(page, 320)
    await expect
      .poll(async () => (await readLayoutState(page)).rootPaddingBottom, {
        timeout: 10_000,
        message: '键盘弹出后 MobileLayout 没有按 keyboardInset 抬升'
      })
      .toBe('320px')

    const lifted = await readLayoutState(page)
    expect(lifted.safeAreaBottomCount, '键盘弹出时仍叠加了底部安全区').toBe(0)
    expect(lifted.inputBottom).not.toBeNull()
    expect(lifted.inputBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(lifted.innerHeight - 320 + 2)

    // 键盘收起：抬升归零，底部安全区元素恢复
    await setKeyboardInset(page, 0)
    await expect.poll(async () => (await readLayoutState(page)).rootPaddingBottom, { timeout: 10_000 }).toBe('0px')
    await expect.poll(async () => (await readLayoutState(page)).safeAreaBottomCount, { timeout: 10_000 }).toBe(1)

    // 负对照：`mobileMessage` 没有 meta.bottomInput，键盘弹起不应压缩页面（X-5）
    await pushRoute(page, { name: 'mobileMessage' })
    await expect(page.locator('.tab-bar-wrap')).toBeVisible({ timeout: 30_000 })
    await setKeyboardInset(page, 320)
    await page.waitForTimeout(200)
    const messagePage = await readLayoutState(page)
    expect(messagePage.rootPaddingBottom, '非输入页被键盘整体抬升了（X-5 回归）').toBe('0px')
    expect(messagePage.safeAreaBottomCount).toBe(0)
  })
})
