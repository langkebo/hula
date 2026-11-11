import { readFileSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { E2E_STORAGE_KEYS, WEB_SESSION_FALLBACK_STORAGE_KEY } from '../src/utils/storageKeys'
import { loginOnMobileUi } from './support/androidDevice'
import { autoDismissLocalUnlockGate, dismissLocalUnlockDialog } from './support/localUnlockGate'

/**
 * 「我的」页（`/mobile/my`）的信息架构回归。
 *
 * 钉住 S1 的三条修复，避免回退：
 *
 * 1. **九宫格入口必须真实可达**：原实现 5 个入口里 4 个点击只弹「功能开发中」，
 *    唯一接线的「扫一扫」还错指向「我的二维码」页。这里逐个点击并断言落点。
 * 2. **设备管理 1 跳可达**：原路径是「我的 → 设置 → 安全设置 → 设备管理」四层。
 * 3. **首屏不再放编辑控件与危险操作**：昵称输入框（与 `EditProfile` 重复）和
 *    退出登录按钮已移出首屏，登出改在设置页底部（功能未丢，位置更安全）。
 *
 * 另加一条「版本号单源」断言：设置页底部曾把 `v1.0.0` 写死，与真实版本（3.x）不符。
 *
 * 默认不跑（需要可用 homeserver）：`TJG_MOBILE_LIVE=1` 开启。
 */

const APP_URL = (process.env.TJG_MOBILE_APP_URL ?? 'http://127.0.0.1:5210').replace(/\/$/, '')
const SKIP_REASON = process.env.TJG_MOBILE_LIVE ? null : '未设置 TJG_MOBILE_LIVE（需可用的本地 homeserver）'

const PKG_VERSION = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
).version

interface Account {
  userId: string
  accessToken: string
  username: string
  password: string
}

const registerAccount = async (prefix: string): Promise<Account> => {
  const password = `Xhub!${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 10)}`
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

type RouterSnapshot = { name?: unknown; path?: string }

const readRoute = async (page: Page) =>
  page.evaluate(() => {
    const router = (
      document.querySelector('#app') as
        | (HTMLElement & {
            __vue_app__?: { config: { globalProperties: { $router?: { currentRoute?: { value?: unknown } } } } }
          })
        | null
    )?.__vue_app__?.config?.globalProperties?.$router
    const raw = router?.currentRoute?.value as RouterSnapshot | undefined
    return { name: typeof raw?.name === 'string' ? raw.name : null, path: raw?.path ?? null }
  })

const pushRoute = async (
  page: Page,
  target: unknown,
  attempt = 0
): Promise<{ name: string | null; path: string | null }> => {
  try {
    await page.evaluate(async (to) => {
      const router = (
        document.querySelector('#app') as
          | (HTMLElement & {
              __vue_app__?: { config: { globalProperties: { $router?: { push: (t: unknown) => Promise<unknown> } } } }
            })
          | null
      )?.__vue_app__?.config?.globalProperties?.$router
      if (!router) throw new Error('应用 router 实例不可达（$router 未挂载）')
      try {
        await router.push(to)
      } catch {
        // 重定向/导航中止会 reject，路由真相以 currentRoute 为准
      }
    }, target)
  } catch (error) {
    // 登录后 SPA 重定向尚在进行时，evaluate 会撞上 "Execution context was destroyed"
    if (attempt < 3) {
      await page.waitForTimeout(1500)
      return pushRoute(page, target, attempt + 1)
    }
    throw error
  }
  await page.waitForTimeout(1200)
  return readRoute(page)
}

/**
 * 播 e2e 标记（本套用例只验证「入口可达」，鉴权另有 authGuard 单测）。
 *
 * - `platform=mobile`：整页重载可能丢掉 `?platform=mobile`，此时 `detectAppPlatform()`
 *   会把纯浏览器判成桌面，守卫随之把用户踢到桌面登录页。
 * - `mockAuth`：开发态下 `sessionOrchestrator.hasAuthenticatedSession()` 会偶发读空
 *   （既有缺陷），导致导航被随机甩到登录页 —— 与本轮 UI 改动无关。
 */
const seedE2EStorage = async (page: Page) =>
  page.addInitScript(
    ({ fallbackKey, e2eKeys }) => {
      window.localStorage.setItem('guide', JSON.stringify({ isGuideCompleted: true }))
      window.localStorage.setItem(fallbackKey, '1')
      window.localStorage.setItem(e2eKeys.platform, 'mobile')
      window.localStorage.setItem(e2eKeys.enabled, '1')
      window.localStorage.setItem(e2eKeys.mockAuth, '1')
    },
    {
      fallbackKey: WEB_SESSION_FALLBACK_STORAGE_KEY,
      e2eKeys: E2E_STORAGE_KEYS
    }
  )

/** 回到「我的」首屏并等待快捷入口渲染（客户端未就绪时首屏不渲染，按重试处理） */
const gotoTab = async (page: Page, attempts = 3) => {
  for (let i = 0; i < attempts; i += 1) {
    await pushRoute(page, { name: 'mobileMy' })
    const visible = await page
      .locator('.m-quick-actions')
      .first()
      .isVisible()
      .catch(() => false)
    if (visible) return
    await page.waitForTimeout(2000)
  }
  await expect(page.locator('.m-quick-actions'), '「我的」首屏未渲染九宫格').toBeVisible({ timeout: 15_000 })
}

/** 点击九宫格某一项（按文案匹配），返回落点路由 */
const clickQuickAction = async (page: Page, label: string) => {
  const item = page.locator('.m-quick-item').filter({ hasText: label }).first()
  await expect(item, `九宫格里找不到「${label}」`).toBeVisible({ timeout: 10_000 })
  const before = (await readRoute(page)).path
  await item.click()
  await page.waitForTimeout(1500)
  const after = await readRoute(page)
  // 元素在首屏可视区内，原生 click 已足够；这里保留一次兜底派发，
  // 避免 glass 层的 hit-test 偶发拦截导致假失败。
  if (after.path === before) {
    await item.dispatchEvent('click')
    await page.waitForTimeout(1500)
    return readRoute(page)
  }
  return after
}

test.describe('我的页信息架构（S1）', () => {
  // 登录 + 5 次入口往返 + 设置页，30s 默认超时不够
  test.setTimeout(180_000)
  test.skip(Boolean(SKIP_REASON), SKIP_REASON ?? '')

  test('九宫格全部真实可达、设备管理 1 跳、首屏无编辑控件', async ({ page }) => {
    const self = await registerAccount('myhub')
    // 导航失败时页面通常只在 console 留一句，这里收起来拼进断言，便于定位
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message.slice(0, 200)}`))
    page.on('console', (m) => {
      if (m.type() === 'error') pageErrors.push(`console: ${m.text().slice(0, 200)}`)
    })

    await seedE2EStorage(page)

    // 纯浏览器没有系统密钥库 ⇒ 启动期必然弹「设置本地解锁密码」并阻断路由。
    // 必须装**常驻**的点掉逻辑（只点一次会漏掉 crypto 初始化时的第二次弹层，
    // 表现为登录表单等不到）。
    await autoDismissLocalUnlockGate(page)
    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })
    await dismissLocalUnlockDialog(page, 10_000)
    // 等登录后的 SPA 重定向收敛（`/mobile/login` 也含 `/mobile/`，必须按 `/login` 判）
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 45_000 }).not.toContain('/mobile/login')
    await page.waitForTimeout(1500)

    // 「我的」首屏的昵称/账号来自 client 同步后的 store；客户端没就绪时首屏是空壳。
    // 先等 client 绑定成功，避免把「同步慢」误判成「九宫格坏了」。
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const { matrixClientService } = (await import(/* @vite-ignore */ '/src/services/matrix/index.ts')) as {
              matrixClientService: { getClient: () => { getUserId?: () => string | null } | null }
            }
            return Boolean(matrixClientService.getClient()?.getUserId?.())
          }),
        { timeout: 60_000 }
      )
      .toBe(true)

    await gotoTab(page)

    // ── 1) 首屏不再有输入控件与退出登录（编辑统一在 EditProfile / 设置页底部）
    const inputCount = await page
      .locator('.van-field, input[type="text"], input[type="password"], input[type="search"]')
      .count()
    expect(inputCount, '「我的」首屏仍有输入控件（昵称编辑应已移除）').toBe(0)
    const logoutVisible = await page
      .locator('button')
      .filter({ hasText: /退出登录|Log out|Sign out/i })
      .first()
      .isVisible()
      .catch(() => false)
    expect(logoutVisible, '「我的」首屏仍有退出登录按钮（危险操作应移到设置页）').toBe(false)

    // ── 2) 九宫格逐项可达
    const expected: Array<[string, string]> = [
      ['扫一扫', '/mobile/mobileMy/scanQRCode'],
      ['文件', '/mobile/mobileMy/files'],
      ['相册', '/mobile/mobileMy/myAlbum'],
      ['二维码', '/mobile/myQRCode']
    ]
    for (const [label, path] of expected) {
      await gotoTab(page)
      const landed = await clickQuickAction(page, label)
      expect(
        landed.path,
        `九宫格「${label}」落点错误（应到 ${path}）\n页面错误：${pageErrors.slice(-3).join(' | ') || '（无）'}`
      ).toBe(path)
    }

    // 私密聊天：私密房会被普通列表整体过滤，这个入口是它唯一的可达路径。
    // 未配置密码时门禁可能挡回 /mobile/message，故接受两种落点，但不能停在原地。
    await gotoTab(page)
    const secret = await clickQuickAction(page, '私密聊天')
    expect(
      ['/mobile/secretChat', '/mobile/message'].includes(secret.path ?? ''),
      `九宫格「私密聊天」落点异常（${secret.path}）`
    ).toBe(true)
    expect(secret.path, '「私密聊天」点击后没有任何跳转（入口是死的）').not.toBe('/mobile/my')

    // ── 3) 设备管理：从「我的」1 跳直达（原路径要经设置 → 安全设置，共 3 跳）
    await gotoTab(page)
    const devices = page
      .locator('.van-cell')
      .filter({ hasText: /设备管理|Devices/i })
      .first()
    await expect(devices, '首屏没有设备管理入口').toBeVisible({ timeout: 10_000 })
    await devices.dispatchEvent('click')
    await page.waitForTimeout(1500)
    const landedDevices = await readRoute(page)
    expect(landedDevices.path, `设备管理应 1 跳直达，实际落在 ${landedDevices.path}`).toBe('/mobile/mobileMy/devices')

    // ── 4) 版本号单源：设置页底部显示真实版本，不再是硬编码 v1.0.0
    // 用 path 而不是 name：桌面与移动两份路由表在 dev 下共存过，按 name 跳可能
    // 命中另一份表或匹配不到（实测落 404）。path 是平台内唯一的。
    await pushRoute(page, '/mobile/mobileMy/settings')
    await expect(page.locator('.van-cell-group').first(), '设置页没渲染（可能落在 404）').toBeVisible({
      timeout: 20_000
    })
    const settingsText = await page.evaluate(() => document.body.innerText)
    expect(settingsText, `设置页仍显示硬编码版本 v1.0.0`).not.toContain('v1.0.0')
    expect(settingsText, `设置页没有显示 package.json 的版本 v${PKG_VERSION}`).toContain(`v${PKG_VERSION}`)
  })

  /**
   * S2 的三项：
   * 1. 设置搜索能按文案/别名命中并跳转（此前 16 个一级项 + 20 个二级页只能滚动找）；
   * 2. 加密设置页（477 行）此前**有路由但无人 push**，只能手输 URL —— 现在从设置页一级项可达；
   * 3. 表情包管理（255 行）此前**无路由无入口**，已注册路由并接入。
   */
  test('设置页：搜索命中、加密与表情包入口可达', async ({ page }) => {
    const self = await registerAccount('myset')
    await seedE2EStorage(page)
    await autoDismissLocalUnlockGate(page)
    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })
    await dismissLocalUnlockDialog(page, 10_000)
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 45_000 }).not.toContain('/mobile/login')
    await page.waitForTimeout(1500)

    // push 到同一路由不会重建组件（搜索词会残留并把列表 v-show 隐藏），
    // 所以每次进设置页都走这个 helper：先进入、再把搜索清空。
    const gotoSettings = async () => {
      await pushRoute(page, '/mobile/mobileMy/settings')
      const input = page.locator('.van-search input').first()
      await input.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
      if (await input.isVisible().catch(() => false)) {
        await input.fill('')
        await page.waitForTimeout(300)
      }
    }

    await gotoSettings()
    const searchInput = page.locator('.van-search input').first()
    await expect(searchInput, '设置页没有渲染搜索框').toBeVisible({ timeout: 20_000 })

    // ── 1) 搜索：按文案命中 → 点击跳转
    await searchInput.fill('设备')
    const results = page.locator('.settings-search-results .van-cell')
    await expect(results.first(), '搜「设备」没有任何结果').toBeVisible({ timeout: 10_000 })
    const deviceHit = results.filter({ hasText: /设备管理|Devices/i }).first()
    await expect(deviceHit, '搜「设备」没有命中「设备管理」').toBeVisible()
    await deviceHit.click()
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe('/mobile/mobileMy/devices')

    // 别名也应命中（用户常按「黑名单」找「已忽略用户」）
    await gotoSettings()
    await page.locator('.van-search input').first().fill('黑名单')
    const aliasHit = page.locator('.settings-search-results .van-cell').filter({ hasText: /已忽略用户|Ignored/i })
    await expect(aliasHit.first(), '别名「黑名单」没有命中「已忽略用户」').toBeVisible({ timeout: 10_000 })

    // ── 2) 加密设置入口
    await gotoSettings()
    const encryptionEntry = page
      .locator('.van-cell')
      .filter({ hasText: /加密设置|Encryption/i })
      .first()
    await expect(encryptionEntry, '设置页没有「加密设置」入口').toBeVisible({ timeout: 10_000 })
    await encryptionEntry.click()
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe('/mobile/encryption')

    // ── 3) 气泡样式：切「方角」必须真的写到根元素（render-message.scss 消费该属性）
    await gotoSettings()
    const bubbleCell = page
      .locator('.van-cell')
      .filter({ hasText: /气泡样式|Bubble style/i })
      .first()
    await expect(bubbleCell, '外观组没有「气泡样式」').toBeVisible({ timeout: 10_000 })
    await bubbleCell
      .locator('.van-radio')
      .filter({ hasText: /方角|Square/i })
      .first()
      .click()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-bubble-style')), {
        timeout: 10_000
      })
      .toBe('square')
    // 复原，避免影响其它用例的视觉断言
    await bubbleCell
      .locator('.van-radio')
      .filter({ hasText: /圆角|Rounded/i })
      .first()
      .click()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-bubble-style')), {
        timeout: 10_000
      })
      .toBe('rounded')

    // ── 4) 表情包管理入口
    await gotoSettings()
    const emoticonEntry = page
      .locator('.van-cell')
      .filter({ hasText: /表情包管理|Emoji Packs/i })
      .first()
    await expect(emoticonEntry, '设置页没有「表情包管理」入口').toBeVisible({ timeout: 10_000 })
    await emoticonEntry.click()
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe('/mobile/mobileMy/emoticons')
  })
})
