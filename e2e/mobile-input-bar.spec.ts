import { expect, test } from '@playwright/test'
import { loginOnMobileUi } from './support/androidDevice'

/**
 * 移动端输入栏（语音 / 表情 / `+` 更多 → 附件选择器）在浏览器态的可测性。
 *
 * 这条用例存在的原因：`MsgInput` 的移动输入栏是 `v-if="isMobileRef"`，而
 * `isMobileRef` 来自 `PlatformDetector`——它此前在「无 Tauri runtime」时把
 * `_platformType` 硬编码成 `desktop`，且不看 `?platform=` / `tjg:e2e:platform`。
 * 于是浏览器里出现「页面是移动端、输入栏是桌面端」的混合态：
 * `+` 按钮不存在 → More 面板不挂载 → `van-uploader` 一个都没有，附件选择器**无法被 e2e 覆盖**。
 *
 * 现在 `PlatformDetector.initialize()` 优先认显式平台覆盖（与路由层同口径），
 * 本用例就是那条覆盖的**端到端证明**：真登录 + 真房间 + 真选文件 + 服务端真的出现 `m.image`。
 *
 * 默认不跑（需可用 homeserver + 会注册临时账号）：`TJG_MOBILE_LIVE=1` 开启。
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

/** 建房 + 自建号 join + 对端发一条消息（保证房间在列表与 timeline 里都有内容） */
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
  await fetch(`${APP_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${Date.now()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${peer.accessToken}` },
    body: JSON.stringify({ msgtype: 'm.text', body: `echo-${roomName}` })
  })
  return roomId
}

/** 房间最近消息里某种类型的条数（服务端真源） */
/**
 * 房间最近消息里某个 `msgtype` 的条数（服务端真源）。
 *
 * 注意：图片消息的事件类型仍是 `m.room.message`，区别在 `content.msgtype` ——
 * 按 `e.type === 'm.image'` 找永远是 0（第一版就是这么写错的，白等 60s）。
 */
const countMessagesOfType = async (account: Account, roomId: string, msgtype: string): Promise<number> => {
  const res = await fetch(`${APP_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=30`, {
    headers: { Authorization: `Bearer ${account.accessToken}` }
  })
  if (!res.ok) return 0
  const body = (await res.json()) as { chunk?: Array<{ type?: string; content?: { msgtype?: string } }> }
  return (body.chunk ?? []).filter((e) => e.type === 'm.room.message' && e.content?.msgtype === msgtype).length
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

/** 1×1 透明 PNG */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64'
)

test.describe('移动端输入栏与附件选择器', () => {
  test.skip(Boolean(SKIP_REASON), SKIP_REASON ?? '')

  test('平台覆盖生效：移动输入栏渲染，图片入口选完能真的发出去', async ({ page }) => {
    test.setTimeout(240_000)

    const self = await registerAccount('minput')
    const peer = await registerAccount('minputpeer')
    const roomName = `input-${Date.now().toString(36)}`
    const roomId = await seedDirectRoom(self, peer, roomName)

    // 跳过 driver.js 引导（否则首次进入会被引导层挡住点击）
    await page.addInitScript(() => {
      window.localStorage.setItem('guide', JSON.stringify({ isGuideCompleted: true }))
    })

    // loginOnMobileUi 会导航到 `/mobile/login?platform=mobile`：平台覆盖在启动时被读取
    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })
    await pushRoute(page, { name: 'mobileChatMain', params: { roomId } })

    // 1) 移动输入栏确实渲染了（这条是 PlatformDetector 覆盖分支的回归护栏）
    const plus = page.locator('svg:has(use[href="#add-one"])').first()
    await expect(plus, '移动输入栏未渲染：`+` 更多按钮不存在（平台覆盖未生效？）').toBeVisible({ timeout: 30_000 })
    await expect(page.locator('svg:has(use[href="#voice"])').first()).toBeVisible()

    // 2) 打开 More 面板 → 两个 van-uploader（发送文件 / 发送图片）
    //    注：面板里还有位置/链接预览/通话等共 6 个 `.more-item`，只锁与附件相关的两个 uploader
    await plus.click({ force: true })
    await expect(page.locator('.van-uploader')).toHaveCount(2, { timeout: 15_000 })
    await expect(page.locator('.more-item[aria-label="文件"]')).toHaveCount(1)
    await expect(page.locator('.more-item[aria-label="图片"]')).toHaveCount(1)

    // 3) 图片入口：DOM 顺序＝options 顺序（[图片, 文件]），nth(0) 才是「图片」。
    //    第一版误用 nth(1) 把 PNG 交给 accept="*/*" 的「文件」入口，
    //    被 afterReadFile 的 imageTypes 过滤 ⇒ 什么都不发，看起来像链路坏了（实际是测试选错了入口）。
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 20_000 }),
      page.locator('.van-uploader input[type="file"]').nth(0).click({ force: true })
    ])
    await chooser.setFiles({ name: 'e2e.png', mimeType: 'image/png', buffer: TINY_PNG })

    // 4) 房间里能看到建房时预置的消息（证明「确实在目标房间、timeline 已就绪」）
    await expect.poll(() => countMessagesOfType(self, roomId, 'm.text'), { timeout: 30_000 }).toBeGreaterThan(0)

    // 5) 关键一跳：服务端必须真的出现消息（选完 → 上传 → 发消息全通）
    //    注意当前实现把「+ 图片」也按 `m.file` 发出（sendFilesDirect 固定走 FILE 策略），
    //    所以这里断言 m.file；「图片应发成 m.image」是另一条 UX 缺口，记在报告的
    //    §4.2（不在本用例的修复范围里，避免用一个断言掩盖两个问题）。
    await expect
      .poll(() => countMessagesOfType(self, roomId, 'm.file'), {
        timeout: 60_000,
        message: '选完图片后服务端没有消息（上传或发送链路断了）'
      })
      .toBeGreaterThan(0)
  })

  test('文件入口选完能真的发出去（m.file）', async ({ page }) => {
    test.setTimeout(240_000)

    const self = await registerAccount('mfile')
    const peer = await registerAccount('mfilepeer')
    const roomName = `file-${Date.now().toString(36)}`
    const roomId = await seedDirectRoom(self, peer, roomName)

    await page.addInitScript(() => {
      window.localStorage.setItem('guide', JSON.stringify({ isGuideCompleted: true }))
    })
    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })
    await pushRoute(page, { name: 'mobileChatMain', params: { roomId } })

    const plus = page.locator('svg:has(use[href="#add-one"])').first()
    await expect(plus, '移动输入栏未渲染').toBeVisible({ timeout: 30_000 })
    await plus.click({ force: true })
    await expect(page.locator('.van-uploader')).toHaveCount(2, { timeout: 15_000 })

    // nth(1) = 文件入口（accept="*/*"），用非图片文件走 afterReadFile
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 20_000 }),
      page.locator('.van-uploader input[type="file"]').nth(1).click({ force: true })
    ])
    await chooser.setFiles({ name: 'e2e-note.txt', mimeType: 'text/plain', buffer: Buffer.from('hello from e2e') })

    await expect
      .poll(() => countMessagesOfType(self, roomId, 'm.file'), {
        timeout: 60_000,
        message: '选完文件后服务端没有 m.file 消息'
      })
      .toBeGreaterThan(0)
  })
})
