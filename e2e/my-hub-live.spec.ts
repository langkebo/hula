import { readFileSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { loginOnMobileUi } from './support/androidDevice'
import { autoDismissLocalUnlockGate, dismissLocalUnlockDialog } from './support/localUnlockGate'
import {
  MOBILE_APP_URL,
  pushMobileRoute,
  readMobileRoute,
  registerMobileAccount,
  seedE2EStorage
} from './support/mobileHub'

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

const APP_URL = MOBILE_APP_URL
const SKIP_REASON = process.env.TJG_MOBILE_LIVE ? null : '未设置 TJG_MOBILE_LIVE（需可用的本地 homeserver）'

const PKG_VERSION = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
).version

/** 回到「我的」首屏并等待快捷入口渲染（客户端未就绪时首屏不渲染，按重试处理） */
const gotoTab = async (page: Page, attempts = 3) => {
  for (let i = 0; i < attempts; i += 1) {
    await pushMobileRoute(page, { name: 'mobileMy' })
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
  const before = (await readMobileRoute(page)).path
  await item.click()
  await page.waitForTimeout(1500)
  const after = await readMobileRoute(page)
  // 元素在首屏可视区内，原生 click 已足够；这里保留一次兜底派发，
  // 避免 glass 层的 hit-test 偶发拦截导致假失败。
  if (after.path === before) {
    await item.dispatchEvent('click')
    await page.waitForTimeout(1500)
    return readMobileRoute(page)
  }
  return after
}

test.describe('我的页信息架构（S1）', () => {
  // 登录 + 5 次入口往返 + 设置页，30s 默认超时不够
  test.setTimeout(180_000)
  test.skip(Boolean(SKIP_REASON), SKIP_REASON ?? '')

  test('九宫格全部真实可达、设备管理 1 跳、首屏无编辑控件', async ({ page }) => {
    const self = await registerMobileAccount('myhub')
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
    const landedDevices = await readMobileRoute(page)
    expect(landedDevices.path, `设备管理应 1 跳直达，实际落在 ${landedDevices.path}`).toBe('/mobile/mobileMy/devices')

    // ── 4) 版本号单源：设置页底部显示真实版本，不再是硬编码 v1.0.0
    // 用 path 而不是 name：桌面与移动两份路由表在 dev 下共存过，按 name 跳可能
    // 命中另一份表或匹配不到（实测落 404）。path 是平台内唯一的。
    await pushMobileRoute(page, '/mobile/mobileMy/settings')
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
    const self = await registerMobileAccount('myset')
    await seedE2EStorage(page)
    await autoDismissLocalUnlockGate(page)
    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })
    await dismissLocalUnlockDialog(page, 10_000)
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 45_000 }).not.toContain('/mobile/login')
    await page.waitForTimeout(1500)

    // push 到同一路由不会重建组件（搜索词会残留并把列表 v-show 隐藏），
    // 所以每次进设置页都走这个 helper：先进入、再把搜索清空。
    const gotoSettings = async () => {
      await pushMobileRoute(page, '/mobile/mobileMy/settings')
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

  /**
   * M5：通知相关两项此前移动端完全没有 ——
   * 1. **免打扰时段**：桌面有起止时间，移动端只能全局关通知（粒度粗糙）；
   * 2. **通知历史**：后端 `/notifications` 已能产出记录，移动端是唯一看不到的地方。
   *
   * 断言口径：DND 打开后必须出现起止时间行；历史页必须真实渲染（空态或列表行都算），
   * 不能是白屏 —— 白屏说明路由到了但组件没跑起来。
   */
  test('推送设置：免打扰时段与通知历史可用', async ({ page }) => {
    const self = await registerMobileAccount('mypush')
    await seedE2EStorage(page)
    await autoDismissLocalUnlockGate(page)
    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })
    await dismissLocalUnlockDialog(page, 10_000)
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 45_000 }).not.toContain('/mobile/login')
    await page.waitForTimeout(1500)

    await pushMobileRoute(page, '/mobile/mobileMy/pushSettings')
    const dndSwitch = page.locator('[data-testid="dnd-switch"]')
    await expect(dndSwitch, '推送设置页没有免打扰开关').toBeVisible({ timeout: 20_000 })

    // 关闭态不应显示时间行；打开后必须出现
    expect(await page.locator('[data-testid="dnd-start"]').count(), '关闭态不该有时间行').toBe(0)
    await dndSwitch.click()
    await expect(page.locator('[data-testid="dnd-start"]'), '打开免打扰后没有起始时间').toBeVisible({
      timeout: 10_000
    })
    await expect(page.locator('[data-testid="dnd-end"]'), '打开免打扰后没有结束时间').toBeVisible()

    // 时间行有值（默认 22:00 / 08:00），不是 --:--
    const startText = await page.locator('[data-testid="dnd-start"]').innerText()
    expect(startText, `起始时间没有默认值：${startText}`).toMatch(/\d{2}:\d{2}/)

    // 通知历史入口 → 真实页面（不是白屏）
    await page.locator('[data-testid="notification-history-entry"]').click()
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe('/mobile/mobileMy/notificationHistory')
    await expect(
      page.locator('[data-testid="notification-empty"], [data-testid="notification-row"]').first(),
      '通知历史页白屏（既没有空态也没有列表）'
    ).toBeVisible({ timeout: 20_000 })
  })
})
