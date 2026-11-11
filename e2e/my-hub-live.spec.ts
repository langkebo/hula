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

/**
 * 进设置页并清空搜索。
 *
 * push 到同一路由不会重建组件（搜索词会残留并把列表 `v-show` 隐藏），
 * 所以每次进入都要显式清空，否则后续断言会命中隐藏元素。
 */
const openSettings = async (page: Page) => {
  await pushMobileRoute(page, '/mobile/mobileMy/settings')
  const input = page.locator('.van-search input').first()
  await input.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
  if (await input.isVisible().catch(() => false)) {
    await input.fill('')
    await page.waitForTimeout(300)
  }
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
      ['二维码', '/mobile/mobileMy/myQRCode']
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

    await openSettings(page)
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
    await openSettings(page)
    await page.locator('.van-search input').first().fill('黑名单')
    const aliasHit = page.locator('.settings-search-results .van-cell').filter({ hasText: /已忽略用户|Ignored/i })
    await expect(aliasHit.first(), '别名「黑名单」没有命中「已忽略用户」').toBeVisible({ timeout: 10_000 })

    // ── 2) 加密设置入口
    await openSettings(page)
    const encryptionEntry = page
      .locator('.van-cell')
      .filter({ hasText: /加密设置|Encryption/i })
      .first()
    await expect(encryptionEntry, '设置页没有「加密设置」入口').toBeVisible({ timeout: 10_000 })
    await encryptionEntry.click()
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe('/mobile/mobileMy/encryption')

    // ── 3) 气泡样式：切「方角」必须真的写到根元素（render-message.scss 消费该属性）
    await openSettings(page)
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
    await openSettings(page)
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

  /**
   * M6：好友请求三项（是否接收 / 自动接受 / 需附言）。
   *
   * 桌面 `FriendsSettings` 早就有这三项，移动端只有「陌生人私聊 + 名单」，
   * 等于手机上只能管「谁能私聊我」、管不了「谁能加我好友」。
   *
   * 注意：这三项的**消费方是 synapse-rust 后端**（读同一份 `im.hula.invite_policy`
   * account data），所以本用例只能验证「UI 能写、互斥关系正确」，
   * 无法在客户端证明「服务端真的按它裁决」——这一点必须写在文档里而不是假装验证过。
   */
  test('好友隐私：好友请求三项可配、互斥关系正确', async ({ page }) => {
    const self = await registerMobileAccount('myfriend')
    await seedE2EStorage(page)
    await autoDismissLocalUnlockGate(page)
    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })
    await dismissLocalUnlockDialog(page, 10_000)
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 45_000 }).not.toContain('/mobile/login')
    await page.waitForTimeout(1500)

    // 用搜索直达：入口本身在「安全设置」里（3 层），搜索是唯一 2 跳路径
    await openSettings(page)
    await page.locator('.van-search input').first().fill('好友请求')
    const hit = page
      .locator('.settings-search-results .van-cell')
      .filter({ hasText: /邀请权限|Invite/i })
      .first()
    await expect(hit, '搜「好友请求」没有命中「邀请权限」').toBeVisible({ timeout: 10_000 })
    await hit.click()
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe('/mobile/mobileMy/invitePermission')

    const allowSwitch = page.locator('[data-testid="allow-friend-requests"]')
    const autoSwitch = page.locator('[data-testid="auto-accept-friends"]')
    const messageSwitch = page.locator('[data-testid="require-friend-request-message"]')

    await expect(allowSwitch, '邀请权限页没有「允许接收好友请求」').toBeVisible({ timeout: 20_000 })
    await expect(autoSwitch).toBeVisible()
    await expect(messageSwitch).toBeVisible()

    // 关掉「允许接收」→ 另两项失去意义，必须禁用（渐进披露，避免配了也不生效）
    await allowSwitch.click()
    await expect(autoSwitch, '关闭接收后「自动接受」仍可点').toHaveClass(/disabled/, { timeout: 10_000 })
    await expect(messageSwitch, '关闭接收后「需要附言」仍可点').toHaveClass(/disabled/)

    // 打开回来 → 恢复可配
    await allowSwitch.click()
    await expect(autoSwitch).not.toHaveClass(/disabled/, { timeout: 10_000 })
  })

  /**
   * M9：存储管理从「只读配额」变成「可解释 + 可清理」。
   *
   * 关键判据不是「点了有 toast」，而是**数据真的被删**：seed 3 条索引 → 页面显示 3 →
   * 点清空 → 直接读 IndexedDB 必须为 0。历史上这里的「清理缓存」是 no-op 却弹「清理成功」，
   * 只有查库才能区分真假。
   */
  test('存储管理：明细真实、清空搜索索引真的删数据', async ({ page }) => {
    const self = await registerMobileAccount('mystore')
    await seedE2EStorage(page)
    await autoDismissLocalUnlockGate(page)
    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })
    await dismissLocalUnlockDialog(page, 10_000)
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 45_000 }).not.toContain('/mobile/login')
    await page.waitForTimeout(1500)

    /**
     * 重进存储页。
     *
     * 两件事同时要满足：① push 同一路由不会重建组件，`onMounted` 不会重跑；
     * ② 连续两次 push（设置 → 存储）时第二次会被前一次的导航收尾打断，落点仍是设置页。
     * 所以经消息页中转：既换了路由（保证重挂载），又不连击同一层级。
     */
    const openStorage = async () => {
      await pushMobileRoute(page, '/mobile/message')
      await pushMobileRoute(page, '/mobile/mobileMy/storage')
      await expect(page.locator('[data-testid="search-index-cell"]')).toBeVisible({ timeout: 20_000 })
    }

    await openStorage()

    // 明细必须有真实值：登录后 localStorage 一定非空
    const localText = await page.locator('[data-testid="local-storage-cell"]').innerText()
    expect(localText, `「本地设置与缓存」没有真实字节数：${localText}`).toMatch(/\d/)
    await expect(page.locator('[data-testid="other-data-cell"]')).toBeVisible()

    // 全新账号索引为空 ⇒ 按钮必须禁用（旧实现无条件「清理成功」）
    const clearButton = page.locator('[data-testid="clear-search-index-button"]')
    await expect(clearButton, '没有可清理内容时按钮仍可点').toBeDisabled()

    // 造 3 条索引记录（与 worker 同一库同一 schema）→ 重进页面应看到 3
    const seeded = await seedSearchIndex(page, 3)
    expect(seeded).toBe(3)
    await openStorage()
    await expect(page.locator('[data-testid="search-index-cell"]'), '页面没读到刚写入的索引条数').toContainText('3', {
      timeout: 20_000
    })
    await expect(clearButton).toBeEnabled()

    // 清空：确认框 → 点「清空搜索索引」
    await clearButton.click()
    const dialog = page
      .locator('.van-dialog')
      .filter({ hasText: /清空搜索索引|Clear search index/ })
      .first()
    await expect(dialog, '点清空没有弹确认框').toBeVisible({ timeout: 10_000 })
    await dialog
      .locator('button')
      .filter({ hasText: /清空搜索索引|Clear search index/ })
      .first()
      .click()

    // 真删：直接读库
    await expect.poll(() => readSearchIndexCount(page), { timeout: 20_000 }).toBe(0)
    // UI 同步归零 + 按钮回到禁用（不是「清完了还能再点一次」）
    await expect(page.locator('[data-testid="search-index-cell"]')).toContainText('0', { timeout: 15_000 })
    await expect(clearButton).toBeDisabled()
  })

  /**
   * M8 补充：本机设备可改名。
   *
   * 原实现把「当前设备」的所有操作都封了（注释写「方案 3.1：当前设备固定顶部，不可删除」），
   * 但**不可删除 ≠ 不可改名**：单设备用户在移动端永远改不了自己这台的名字，
   * 而桌面端一直允许（`SessionSettings` 的 `showRenameDialog(currentDevice)`）。
   *
   * 判据取服务端事实：`GET /devices` 的 `display_name` 真的变了，不只是 UI 上写了个值。
   */
  test('设备管理：本机可改名，且写入服务端', async ({ page }) => {
    const self = await registerMobileAccount('mydev')
    await seedE2EStorage(page)
    await autoDismissLocalUnlockGate(page)
    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })
    await dismissLocalUnlockDialog(page, 10_000)
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 45_000 }).not.toContain('/mobile/login')
    await page.waitForTimeout(1500)

    const readServerDevices = async () => {
      const res = await fetch(`${APP_URL}/_matrix/client/v3/devices`, {
        headers: { Authorization: `Bearer ${self.accessToken}` }
      })
      expect(res.status).toBe(200)
      const data = (await res.json()) as { devices: Array<{ device_id: string; display_name?: string }> }
      return data.devices
    }
    expect((await readServerDevices()).length, '登录后服务端应至少有一台设备').toBeGreaterThan(0)

    await pushMobileRoute(page, '/mobile/mobileMy/devices')
    const currentRow = page
      .locator('.van-cell')
      .filter({ hasText: /当前设备|Current device/ })
      .first()
    await expect(currentRow, '设备列表里没有「本机」行').toBeVisible({ timeout: 20_000 })
    await currentRow.click()

    const renameItem = page
      .locator('.van-action-sheet__item')
      .filter({ hasText: /重命名设备|Rename device/ })
      .first()
    await expect(renameItem, '本机设备没有「重命名设备」入口（单设备用户不可达）').toBeVisible({ timeout: 10_000 })
    await renameItem.click()

    const newName = `MyPhone-${Date.now().toString(36).slice(-5)}`
    const dialog = page
      .locator('.van-dialog')
      .filter({ hasText: /重命名设备|Rename device/ })
      .first()
    await expect(dialog, '点「重命名设备」没有弹输入框').toBeVisible({ timeout: 10_000 })
    await dialog.locator('input').first().fill(newName)
    await dialog
      .locator('button')
      .filter({ hasText: /确认|Confirm/ })
      .first()
      .click()

    // 服务端事实：display_name 必须变成新名字
    await expect
      .poll(async () => (await readServerDevices()).some((d) => d.display_name === newName), { timeout: 20_000 })
      .toBe(true)
    // UI 同步刷新
    await expect(page.locator('.van-cell').filter({ hasText: newName }).first()).toBeVisible({ timeout: 15_000 })
  })
})

/**
 * 往搜索索引库写入 N 条事件（+1 个会话）。
 *
 * 用的是 worker 的同一库名与 schema（`tjg-worker-cache`），所以页面读到的就是它。
 * 不经过 worker 消息：本用例要验证的是「页面读库 → 清库」这条链路，
 * 造数据绕开 worker 反而更纯粹（也不依赖 worker 是否已启动）。
 */
const seedSearchIndex = (page: Page, count: number) =>
  page.evaluate(async (n) => {
    const openDb = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('tjg-worker-cache', 1)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('search-rooms')) {
            db.createObjectStore('search-rooms', { keyPath: 'roomId' })
          }
          if (!db.objectStoreNames.contains('search-events')) {
            const store = db.createObjectStore('search-events', { keyPath: 'eventId' })
            store.createIndex('by_room', 'roomId', { unique: false })
          }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['search-rooms', 'search-events'], 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore('search-rooms').put({ roomId: '!seed:localhost', name: 'seed-room' })
      const events = tx.objectStore('search-events')
      for (let i = 0; i < n; i++) {
        events.put({ eventId: `$seed-${i}:localhost`, roomId: '!seed:localhost', enc: 'v1:seed' })
      }
    })
    db.close()
    return n
  }, count)

/** 直接读库计数：绕过页面与 worker，验证「真的删了」 */
const readSearchIndexCount = (page: Page) =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('tjg-worker-cache', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const count = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction('search-events', 'readonly')
      const req = tx.objectStore('search-events').count()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return count
  })
