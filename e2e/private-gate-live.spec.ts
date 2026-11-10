import { expect, type Page, test } from '@playwright/test'
import { WEB_SESSION_FALLBACK_STORAGE_KEY } from '../src/utils/storageKeys'
import { loginOnMobileUi } from './support/androidDevice'
import { dismissLocalUnlockDialog } from './support/localUnlockGate'

/**
 * 私密聊天门禁：**四条入口是否都被拦**（报告 §3-13 的验收项）。
 *
 * 之前只有单测（`secretChatGuard` / `useMobilePrivateRoomGate` 的桩测试），
 * 「点进去真的会拦」没有任何一条跑真后端、真路由的用例。这里补齐：
 *
 * | # | 入口 | 承载路由 | 门禁位置 |
 * | - | --- | --- | --- |
 * | E1 | 私密会话列表页（侧栏入口） | `/secretChat` | `router.beforeEach` → `secretChatGuard` |
 * | E2 | 手输 URL / 深链 / 搜索结果点击 | `/message/:roomId` | 同上 |
 * | E3 | 独立聊天窗口 | `/window/chat/:roomId` | 同上 |
 * | E4 | 移动端通知点击 / 会话点击 | `/mobile/chatRoom/chatMain/:roomId` | `ChatRoomLayout` → `useMobilePrivateRoomGate` |
 *
 * 桌面三条路由只在 desktop 路由表里注册，移动端只在 mobile 表里注册
 * （`router/index.ts` 按平台定型）⇒ 同一个浏览器里分两段平台跑：
 * 先移动端登录（浏览器登录表单只有移动端有），再 `?platform=desktop` 重载跑桌面三条，
 * 最后回 `?platform=mobile` 跑移动入口。重载后仍能保持登录靠 web 会话回退开关
 * （`WEB_SESSION_FALLBACK_STORAGE_KEY`=1，真机默认关闭）。
 *
 * 判据不是「页面没报错」，而是：**路由最终落在 fallback 列表页** + **弹出解锁框**。
 * 再加一条正对照（解锁后同一路由必须放行），否则「一律拦住」也会让用例变绿。
 *
 * 默认不跑（需要可用 homeserver + 会注册临时账号）：`TJG_MOBILE_LIVE=1` 开启。
 */

const APP_URL = (process.env.TJG_MOBILE_APP_URL ?? 'http://127.0.0.1:5210').replace(/\/$/, '')
const SKIP_REASON = process.env.TJG_MOBILE_LIVE ? null : '未设置 TJG_MOBILE_LIVE（需可用的本地 homeserver）'
const SECRET_PW = 'Pg!gate-live-2026'

interface Account {
  userId: string
  accessToken: string
  username: string
  password: string
}

const registerAccount = async (prefix: string): Promise<Account> => {
  const password = `Xpg!${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 10)}`
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

/** B 建 DM 并邀请 A → A 入房 → B 发一条消息（房间有内容，才能验证「内容没被渲染」） */
const seedDirectRoom = async (self: Account, peer: Account, name: string, body: string): Promise<string> => {
  const created = await fetch(`${APP_URL}/_matrix/client/v3/createRoom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${peer.accessToken}` },
    body: JSON.stringify({ preset: 'private_chat', invite: [self.userId], is_direct: true, name })
  })
  if (!created.ok) throw new Error(`建房失败: HTTP ${created.status} ${await created.text()}`)
  const { room_id: roomId } = (await created.json()) as { room_id: string }

  const joined = await fetch(`${APP_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${self.accessToken}` },
    body: '{}'
  })
  if (!joined.ok) throw new Error(`入房失败: HTTP ${joined.status} ${await joined.text()}`)

  await fetch(`${APP_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${Date.now()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${peer.accessToken}` },
    body: JSON.stringify({ msgtype: 'm.text', body })
  })
  return roomId
}

/** 当前路由快照（应用自己的 router：被拦住时 URL 也会变，但路由真相在 router 里） */
type RouterSnapshot = { name?: unknown; path?: string; params?: Record<string, unknown> }

/** 读取当前路由 */
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
    return { name: typeof raw?.name === 'string' ? raw.name : null, path: raw?.path ?? null, params: raw?.params ?? {} }
  })

/** 用应用 router 推一条路由，等重定向收敛后返回最终路由 */
const pushRoute = async (page: Page, target: unknown) => {
  const pushed = await page.evaluate(async (to) => {
    const router = (
      document.querySelector('#app') as
        | (HTMLElement & {
            __vue_app__?: {
              config: { globalProperties: { $router?: { push: (t: unknown) => Promise<unknown> } } }
            }
          })
        | null
    )?.__vue_app__?.config?.globalProperties?.$router
    if (!router) throw new Error('应用 router 实例不可达（$router 未挂载）')
    try {
      await router.push(to)
      return true
    } catch {
      // 重定向/中止都会 reject，路由真相以 currentRoute 为准
      return false
    }
  }, target)
  await page.waitForTimeout(1500)
  return { pushed, ...(await readRoute(page)) }
}

/**
 * 关掉解锁对话框。
 *
 * ⚠️ 桌面与移动是**两个组件**：桌面 `SecretChatUnlockDialog`（naive-ui，`.secret-chat-unlock`），
 * 移动 `MobileSecretChatUnlockDialog`（vant，`.van-dialog`）。两种都处理。
 */
const closeUnlockDialog = async (page: Page): Promise<boolean> => {
  const clicked = await page.evaluate(() => {
    for (const dialog of [document.querySelector('.secret-chat-unlock'), document.querySelector('.van-dialog')]) {
      const btn = [...(dialog?.querySelectorAll('button') ?? [])].find((b) => (b.textContent || '').trim() === '取消')
      if (btn) {
        ;(btn as HTMLElement).click()
        return true
      }
    }
    return false
  })
  await page.waitForTimeout(600)
  return clicked
}

/** 移动端解锁弹窗是否可见（vant dialog 里才有 password 输入框） */
const mobileUnlockVisible = (page: Page): Promise<boolean> =>
  page
    .locator('.van-dialog input[type="password"]')
    .first()
    .isVisible()
    .catch(() => false)

/**
 * 配置私密房：设密码 → 解锁 → 标记私密 → 上锁。
 *
 * 顺序不能反：`markRoomPrivate` 的前置是「已配置且已解锁」（见 `usePrivateRoomActions`）。
 */
const configurePrivateRoom = async (page: Page, roomId: string) =>
  page.evaluate(
    async ({ id, pw }) => {
      const [{ useSettingStore }, registry, session] = await Promise.all([
        import(/* @vite-ignore */ '/src/stores/domains/settings/setting.ts'),
        import(/* @vite-ignore */ '/src/services/matrix/privateChat/privateRoomRegistry.ts'),
        import(/* @vite-ignore */ '/src/stores/domains/settings/secretChatSession.ts')
      ])
      const runtimeWindow = window as Window & { pinia?: unknown }
      const store = useSettingStore(runtimeWindow.pinia)
      await store.setSecretChatPassword(pw)
      const unlocked = await store.unlockSecretChat(pw)
      await registry.ensurePrivateRoomRegistryReady()
      await registry.markRoomPrivate(id)
      session.lockSecretChatSession('pgate-lock')
      return {
        unlocked,
        configured: store.isSecretChatConfigured(),
        isPrivate: registry.isPrivateRoom(id),
        locked: !session.isSecretChatUnlocked()
      }
    },
    { id: roomId, pw: SECRET_PW }
  )

test.describe('私密聊天门禁（四条入口）', () => {
  test.skip(SKIP_REASON !== null, SKIP_REASON ?? '')
  test.setTimeout(360_000)

  test('未解锁时四条入口全部被拦，解锁后放行', async ({ page }) => {
    const self = await registerAccount('pgate')
    const peer = await registerAccount('pgatepeer')
    const roomName = `pgate-${Date.now().toString(36)}`
    const roomId = await seedDirectRoom(self, peer, roomName, `${roomName} 私密房正文`)
    const plainRoom = await seedDirectRoom(self, peer, `pgate-plain-${Date.now().toString(36)}`, 'plain-room-body')

    // 前置：跳过引导 + 打开 web 会话回退（重载后仍保持登录，用来跨平台跑两段）
    await page.addInitScript(
      ({ fallbackKey }) => {
        window.localStorage.setItem('guide', JSON.stringify({ isGuideCompleted: true }))
        window.localStorage.setItem(fallbackKey, '1')
      },
      { fallbackKey: WEB_SESSION_FALLBACK_STORAGE_KEY }
    )

    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toContain('/mobile/')

    // 等房间同步到客户端（登记表 / 标记都依赖 client 已就绪）
    const hasRoom = (id: string) =>
      page.evaluate(async (target) => {
        const { matrixClientService } = (await import(/* @vite-ignore */ '/src/services/matrix/index.ts')) as {
          matrixClientService: { getClient: () => { getRoom?: (r: string) => unknown } | null }
        }
        return Boolean(matrixClientService.getClient()?.getRoom?.(target))
      }, id)
    await expect.poll(() => hasRoom(roomId), { timeout: 60_000 }).toBe(true)
    await expect.poll(() => hasRoom(plainRoom), { timeout: 60_000 }).toBe(true)

    const setup = await configurePrivateRoom(page, roomId)
    expect(setup, `私密配置未就绪: ${JSON.stringify(setup)}`).toMatchObject({
      unlocked: true,
      configured: true,
      isPrivate: true,
      locked: true
    })

    // ── 段 1：移动端入口（E4）
    //
    // 必须用登录后的**同一个页面**：整页重载后 `chatStore.sessionList` 需要重新拉取，
    // 此时进 `chatMain` 会被页面自身弹回列表（与门禁无关），负对照会假红。
    const sessionCount = () =>
      page.evaluate(async () => {
        const { useChatStore } = (await import(/* @vite-ignore */ '/src/stores/domains/chat/chat/index.ts')) as {
          useChatStore: (pinia?: unknown) => { sessionList: Array<{ roomId?: string }> }
        }
        return useChatStore((window as Window & { pinia?: unknown }).pinia).sessionList.length
      })
    await expect.poll(sessionCount, { timeout: 60_000 }).toBeGreaterThan(0)

    // 负对照：普通房必须放行（否则「一律拦」也能让下面那条变绿）
    const plainOk = await pushRoute(page, { name: 'mobileChatMain', params: { roomId: plainRoom } })
    expect(plainOk.path, `普通房 ${plainRoom} 也被拦了（门禁误伤）`).toBe(`/mobile/chatRoom/chatMain/${plainRoom}`)
    await pushRoute(page, '/mobile/message')

    // E4 通知点击 / 会话点击 → 私密房
    //
    // ⚠️ 判据不能只看路由落点：移动端私密房被排除出 `sessionList`，即使门禁放行，
    // `switchSession` 找不到会话也会弹回 `/mobile/message` —— 也就是「拦」和「没拦住但页面
    // 自己退回」路由都一样。所以这条的主判据是**是否弹解锁框**（变异自证：短路
    // `useMobilePrivateRoomGate.assertAccess` 时，只有弹框断言会红）。
    const e4 = await pushRoute(page, { name: 'mobileChatMain', params: { roomId } })
    expect(e4.path, `E4 /mobile/chatRoom/chatMain/${roomId} 未被拦（通知点击可直达私密房）`).toBe('/mobile/message')
    const dialogE4 = await mobileUnlockVisible(page)
    expect(dialogE4, 'E4 被拦但没有弹出解锁框').toBe(true)

    // 关掉对话框：否则下面「解锁后是否还弹框」永远为真（读到的是上一次残留的弹层）
    await closeUnlockDialog(page)

    // 隐私判据：被拦后客户端不得把该房间「激活」成当前会话
    const activated = await page.evaluate(async () => {
      const { useGlobalStore } = await import(/* @vite-ignore */ '/src/stores/domains/widget/global.ts')
      return (useGlobalStore((window as Window & { pinia?: unknown }).pinia) as { currentSessionRoomId: string })
        .currentSessionRoomId
    })
    expect(activated, `私密房被设成当前会话（${activated}）：界面已拦但内存已激活`).not.toBe(roomId)

    // 隐私判据（列表侧）：私密房不得出现在普通会话列表里（否则「标记私密」等于没标）
    const stillListed = await page.evaluate(async (target) => {
      const { useChatStore } = (await import(/* @vite-ignore */ '/src/stores/domains/chat/chat/index.ts')) as {
        useChatStore: (pinia?: unknown) => { sessionList: Array<{ roomId?: string }> }
      }
      return useChatStore((window as Window & { pinia?: unknown }).pinia).sessionList.some((x) => x.roomId === target)
    }, roomId)
    expect(stillListed, '私密房仍留在普通会话列表里（信息泄漏）').toBe(false)

    // 正对照（移动）：解锁后**门禁不再拦**。
    // ⚠️ 注意不能断言「解锁后一定进入房间」：移动端没有 `/secretChat` 路由，
    // 而 `useMessageSessionFilters` 会把私密房从普通列表剔除 ⇒ `switchSession` 找不到会话，
    // 页面自己弹回列表（见报告 §4.6 的 D19）。所以这里的判据是「不再弹解锁框」。
    await page.evaluate(async (pw) => {
      const { useSettingStore } = await import(/* @vite-ignore */ '/src/stores/domains/settings/setting.ts')
      return useSettingStore((window as Window & { pinia?: unknown }).pinia).unlockSecretChat(pw)
    }, SECRET_PW)
    await pushRoute(page, { name: 'mobileChatMain', params: { roomId } })
    const dialogAfterUnlock = await page
      .locator('.secret-chat-unlock')
      .isVisible()
      .catch(() => false)
    expect(dialogAfterUnlock, '解锁后门禁仍在弹解锁框（miss 了 shouldAllow 分支）').toBe(false)

    // 上锁：桌面三条要在「锁定态」下验证（解锁态只存内存，这里显式上锁以免污染）
    const relocked = await page.evaluate(async () => {
      const mod = await import(/* @vite-ignore */ '/src/stores/domains/settings/secretChatSession.ts')
      mod.lockSecretChatSession('probe-relock')
      return !mod.isSecretChatUnlocked()
    })
    expect(relocked).toBe(true)

    // ── 段 2：桌面路由表（`?platform=desktop` 才会注册 /message、/window/chat、/secretChat）
    await page.goto(`${APP_URL}/?platform=desktop`, { waitUntil: 'domcontentloaded' })
    await dismissLocalUnlockDialog(page, 15_000)
    await expect.poll(() => readRoute(page).then((r) => r.name), { timeout: 60_000 }).not.toBe('mobileLogin')
    // 重载后必须仍是锁定态（解锁态只在内存，重载即锁 —— 顺手就是「冷启动」场景）
    const lockedAfterReload = await page.evaluate(async () => {
      const mod = await import(/* @vite-ignore */ '/src/stores/domains/settings/secretChatSession.ts')
      return !mod.isSecretChatUnlocked()
    })
    expect(lockedAfterReload, '重载后仍是解锁态：解锁态不该被持久化').toBe(true)

    // E1 私密会话列表页
    const e1 = await pushRoute(page, { name: 'secretChat' })
    expect(e1.path, `E1 /secretChat 未被拦（最终路由 ${e1.path}）`).toBe('/message')
    const dialogE1 = await page
      .locator('.secret-chat-unlock')
      .isVisible()
      .catch(() => false)
    expect(dialogE1, 'E1 被拦但没有弹出解锁框（用户会看到「点了没反应」）').toBe(true)
    await closeUnlockDialog(page)

    // E2 手输 URL / 深链 / 搜索结果（都汇到 message 的 :roomId）
    const e2 = await pushRoute(page, { name: 'message', params: { roomId } })
    expect(e2.path, `E2 落在了房间页（${e2.path}），私密房被直接渲染`).toBe('/message')

    // E3 独立窗口
    const e3 = await pushRoute(page, { name: 'windowChat', params: { roomId } })
    expect(e3.path, `E3 /window/chat/${roomId} 未被拦`).toBe('/message')

    // 正对照（桌面）：解锁后深链必须放行
    const unlocked = await page.evaluate(async (pw) => {
      const { useSettingStore } = await import(/* @vite-ignore */ '/src/stores/domains/settings/setting.ts')
      return useSettingStore((window as Window & { pinia?: unknown }).pinia).unlockSecretChat(pw)
    }, SECRET_PW)
    expect(unlocked, '解锁失败（密码与设置时不一致？）').toBe(true)
    const e2ok = await pushRoute(page, { name: 'message', params: { roomId } })
    expect(e2ok.path, `解锁后桌面深链仍进不去（${e2ok.path}）`).toBe(`/message/${roomId}`)
  })

  /**
   * D19（2026-11-10 已修）：移动端**没有** `/mobile/secretChat` 时，私密房被普通列表整体过滤
   * ⇒ 标记私密后在该端无处可进。本条钉住修复后的用户可见结果：
   * 1. 锁定态进入私密列表：只显示「已锁定」，**不渲染任何会话名**（名称本身就泄露「和谁私密往来」）；
   * 2. 弹解锁框 → 输密码 → 列表出现该私密房（带 aria-label）；
   * 3. 点行回到 `/mobile/chatRoom/chatMain/<roomId>`。
   */
  test('移动端私密会话有独立入口：锁定态不泄露、解锁后可见可进', async ({ page }) => {
    const self = await registerAccount('pglst')
    const peer = await registerAccount('pglstpeer')
    const roomName = `pglst-${Date.now().toString(36)}`
    const roomId = await seedDirectRoom(self, peer, roomName, `${roomName} body`)

    await page.addInitScript(
      ({ fallbackKey }) => {
        window.localStorage.setItem('guide', JSON.stringify({ isGuideCompleted: true }))
        window.localStorage.setItem(fallbackKey, '1')
      },
      { fallbackKey: WEB_SESSION_FALLBACK_STORAGE_KEY }
    )
    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toContain('/mobile/')

    await expect
      .poll(
        () =>
          page.evaluate(async (target) => {
            const { matrixClientService } = (await import(/* @vite-ignore */ '/src/services/matrix/index.ts')) as {
              matrixClientService: { getClient: () => { getRoom?: (r: string) => unknown } | null }
            }
            return Boolean(matrixClientService.getClient()?.getRoom?.(target))
          }, roomId),
        { timeout: 60_000 }
      )
      .toBe(true)

    await configurePrivateRoom(page, roomId)

    // 1) 锁定态：路由**入口存在但被门禁挡回**（与桌面 `/secretChat` 同语义），同时弹解锁框
    const entered = await pushRoute(page, { name: 'mobileSecretChat' })
    expect(entered.path, `移动端私密入口未被门禁接管（落在 ${entered.path}）`).toBe('/mobile/message')
    const pwd = page.locator('.van-dialog input[type="password"]').first()
    await expect(pwd, '被挡回却没有任何解锁入口（用户会以为功能坏了）').toBeVisible({ timeout: 10_000 })

    // 2) 走 UI 解锁：填密码 → 点「输入密码继续」
    await pwd.fill(SECRET_PW)
    await page
      .evaluate(() => {
        const dialog = document.querySelector('.van-dialog')
        const btns = [...(dialog?.querySelectorAll('button') ?? [])]
        const btn = btns.find((b) => /输入密码继续|确认/.test((b.textContent || '').trim()))
        if (btn) (btn as HTMLElement).click()
        return true
      })
      .catch(() => null)

    // 3) 解锁后再进：列表页出现，且列出该私密房（锁定态不渲染任何会话名）
    const unlockedEntry = await pushRoute(page, { name: 'mobileSecretChat' })
    expect(unlockedEntry.path, `解锁后仍进不去私密列表（${unlockedEntry.path}）`).toBe('/mobile/secretChat')
    const row = page.locator('.van-cell').filter({ hasText: roomName }).first()
    await expect(row, '解锁后私密列表里没有该会话').toBeVisible({ timeout: 20_000 })

    // 4) 点行回到原房间
    await row.click()
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe(`/mobile/chatRoom/chatMain/${roomId}`)
  })
})
