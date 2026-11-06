import { expect, test } from '@playwright/test'
import { loginOnMobileUi } from './support/androidDevice'

/**
 * 移动端「消息列表 → 进入会话」闭环（真实后端 + 真实登录）。
 *
 * 覆盖三条此前全断的链路：
 * 1. 会话列表能渲染出来 —— 曾经的 `chatStore.sessionList` 是 Pinia setup store 里的
 *    对象字面量 getter（初始化即快照），而 `getSessionList()` 是**整体替换**数组，
 *    于是移动端列表 computed 永远读旧值 ⇒ 恒显示「暂无会话」。
 * 2. 点击进会话 —— 路由参数从对端 uid 改为 roomId；此前群聊/非好友时
 *    `detailId` 为空会 push 一个不带参数的 `mobileChatMain`，只靠内存态侥幸可用。
 * 3. 刷新/深链可恢复 —— 旧实现聊天页根本不用路由参数，整页重载后房间丢失即空白。
 *
 * 默认不跑（需要可用 homeserver + 会注册临时账号）：`TJG_MOBILE_LIVE=1` 开启。
 * 断言全部基于真实服务端回声，不做 UI 空转。
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
  // 后端偶发 500 M_UNKNOWN（瞬时），重试三次而不是让用例红
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

/** 对方建 DM 并邀请自己 → 自己入房 → 对方发一条消息（制造 lastMsg 与活跃时间） */
const seedDirectRoom = async (self: Account, peer: Account, roomName: string): Promise<string> => {
  const createRes = await fetch(`${APP_URL}/_matrix/client/v3/createRoom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${peer.accessToken}` },
    body: JSON.stringify({
      preset: 'private_chat',
      invite: [self.userId],
      is_direct: true,
      name: roomName
    })
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

/** 服务端未读计数（MSC2654，后端已实现）：用于验证「未读清零」的真源 */
const fetchUnreadCount = async (account: Account, roomId: string): Promise<number> => {
  // 注意前缀：未读计数走 vendor 扩展（/_matrix/vendor/v1），不是 client/v3
  const res = await fetch(`${APP_URL}/_matrix/vendor/v1/rooms/${encodeURIComponent(roomId)}/unread_count`, {
    headers: { Authorization: `Bearer ${account.accessToken}` }
  })
  if (!res.ok) throw new Error(`查询未读失败: HTTP ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { notification_count?: number }
  return Math.max(0, data.notification_count ?? 0)
}

/** 用 REST 建一个「有名字」的房间：name 事件会让它不被 dead-room 过滤（1 人房也保留） */
const createNamedRoom = async (account: Account, name: string): Promise<string> => {
  const res = await fetch(`${APP_URL}/_matrix/client/v3/createRoom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${account.accessToken}` },
    body: JSON.stringify({ name, preset: 'private_chat', visibility: 'private' })
  })
  if (!res.ok) throw new Error(`建房失败: HTTP ${res.status} ${await res.text()}`)
  const { room_id: roomId } = (await res.json()) as { room_id: string }
  return roomId
}

test.describe('移动端消息列表与会话进入', () => {
  test.skip(SKIP_REASON !== null, SKIP_REASON ?? '')
  test.setTimeout(240_000)

  test('列表能渲染真实会话，点击进入聊天并可深链恢复', async ({ page }) => {
    const self = await registerAccount('mmob')
    const peer = await registerAccount('mmobpeer')
    const roomName = `mobile-${Date.now().toString(36)}`
    const roomId = await seedDirectRoom(self, peer, roomName)

    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })

    // 1) 列表必须有真实会话（此前因 Pinia 快照恒显示「暂无会话」）
    const row = page.locator('.van-swipe-cell').filter({ hasText: roomName }).first()
    await expect(row, '会话列表未渲染出服务端存在的房间').toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.van-empty')).toHaveCount(0)

    // 2) 点击进入：路由必须带 roomId（对端 uid 在群聊里根本不存在）
    await page.evaluate(() => {
      const target = document.querySelector('.van-swipe-cell .grid') as HTMLElement | null
      target?.click()
    })
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe(`/mobile/chatRoom/chatMain/${roomId}`)
    await expect(page.getByText(`echo-${roomName}`).first()).toBeVisible({ timeout: 30_000 })

    // 3) 模拟「App 被系统回收后再从通知进入同一个房间」：
    //    把内存里的 currentSessionRoomId 清空、退回列表，再只带路由参数进入 ——
    //    这正是旧实现做不到的一条（聊天页根本不读路由参数，房间只存在内存里）。
    //
    //    不用 `page.reload()`：浏览器态 token 只在内存（getStoredTokens 走 Tauri IPC 拿不到），
    //    整页重载必然掉登录，属已知遗留（F-8 记录），真机 Tauri 才有意义。
    await page.evaluate(
      async ({ targetRoomId }) => {
        const runtimeWindow = window as Window & { pinia?: unknown }
        const { useGlobalStore } = (await import(/* @vite-ignore */ '/src/stores/domains/widget/global.ts')) as {
          useGlobalStore: (pinia?: unknown) => { updateCurrentSessionRoomId: (id: string) => void }
        }
        useGlobalStore(runtimeWindow.pinia).updateCurrentSessionRoomId('')

        // 必须用**应用自己的 router 实例**：`/src/router/index.ts` 的路由表在模块加载时
        // 按平台定型，dev server 复用模块后会被此前跑过的桌面用例污染成 desktop 表，
        // 此时再 `import('/src/router/index.ts')` 会拿到一个没有 mobileChatMain 的实例。
        const appRoot = document.querySelector('#app') as
          | (HTMLElement & {
              __vue_app__?: { config: { globalProperties: { $router?: { push: (to: unknown) => Promise<unknown> } } } }
            })
          | null
        const appRouter = appRoot?.__vue_app__?.config?.globalProperties?.$router
        if (!appRouter) throw new Error('应用 router 实例不可达（$router 未挂载）')

        await appRouter.push('/mobile/message')
        await appRouter.push({ name: 'mobileChatMain', params: { roomId: targetRoomId } })
      },
      { targetRoomId: roomId }
    )
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe(`/mobile/chatRoom/chatMain/${roomId}`)
    await expect(page.getByText(`echo-${roomName}`).first(), '清空内存态后仅靠路由参数未能恢复到该会话').toBeVisible({
      timeout: 30_000
    })
  })

  /**
   * 返回列表恢复滚动位置（P3-b）。
   *
   * `/mobile/message` 在 tab 布局、聊天页在 chat 布局，进会话时 tab 布局整体卸载
   * ⇒ 列表被重建、滚动归零。微信式体感是「返回还在原来位置」。
   * 造 12 个有名字的房间把列表撑到可滚动（有 m.room.name ⇒ 不会被 dead-room 过滤）。
   */
  test('返回列表时恢复滚动位置', async ({ page }) => {
    const self = await registerAccount('mmobscroll')
    const stamp = Date.now().toString(36)
    for (let i = 0; i < 12; i += 1) {
      await createNamedRoom(self, `scroll-${stamp}-${i}`)
    }

    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })
    const container = page.locator('.mobile-session-list')
    await expect(container).toBeVisible({ timeout: 30_000 })

    // 拉到中间位置（回读实际值，虚拟列表/容器高度会 clamp）
    const scrolledTo = await page.evaluate(() => {
      const el = document.querySelector('.mobile-session-list') as HTMLElement | null
      if (!el) return 0
      el.scrollTop = 300
      el.dispatchEvent(new Event('scroll'))
      return el.scrollTop
    })
    expect(scrolledTo, '房间数不足以让列表滚动，用例前提不成立').toBeGreaterThan(0)

    // 进会话 → 返回
    await page.evaluate(() => {
      const row = document.querySelector('.van-swipe-cell .grid') as HTMLElement | null
      row?.click()
    })
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toContain('/mobile/chatRoom/chatMain/')

    await page.goBack()
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe('/mobile/message')

    // 恢复位置发生在「数据首次非空之后」，用 poll 等它落定
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const el = document.querySelector('.mobile-session-list') as HTMLElement | null
            return el?.scrollTop ?? -1
          }),
        { timeout: 20_000 }
      )
      .toBeGreaterThan(scrolledTo - 5)
  })

  /**
   * P4 验收（用户要求的完整闭环）：
   * 注册两账号 → 建房发消息 → loginOnMobileUi 登录 → 列表出现该会话 →
   * 点击进入聊天看到消息 → 返回列表仍在 → 未读清零。
   *
   * 「未读」用**服务端真源**（GET /rooms/{id}/unread_count）核对，而不是只看角标：
   * 客户端角标会被本地账本折算，单看 UI 无法区分「真的清零」和「压根没算过」。
   */
  test('P4 验收：列表可见 → 进入会话 → 返回列表（未读清零）', async ({ page }) => {
    const self = await registerAccount('mmobp4')
    const peer = await registerAccount('mmobp4peer')
    const roomName = `p4-${Date.now().toString(36)}`
    // peer 建房 + 邀请 self → self join → peer 发消息（此时 self 已在房，形成未读）
    const roomId = await seedDirectRoom(self, peer, roomName)

    const unreadBefore = await fetchUnreadCount(self, roomId)
    expect(unreadBefore, '用例前提：进入会话前服务端应记有未读').toBeGreaterThan(0)

    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })

    // 1) 列表出现该会话
    const row = page.locator('.van-swipe-cell').filter({ hasText: roomName }).first()
    await expect(row).toBeVisible({ timeout: 30_000 })

    // 2) 点击进入，聊天区能看到对方那条消息
    await page.evaluate(() => {
      const target = document.querySelector('.van-swipe-cell .grid') as HTMLElement | null
      target?.click()
    })
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe(`/mobile/chatRoom/chatMain/${roomId}`)
    await expect(page.getByText(`echo-${roomName}`).first()).toBeVisible({ timeout: 30_000 })

    // 3) 返回列表：会话仍在
    await page.goBack()
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe('/mobile/message')
    await expect(row).toBeVisible({ timeout: 20_000 })

    // 4) 未读清零（服务端真源；客户端进入会话时发 m.read，轮询等待回执生效）
    await expect
      .poll(() => fetchUnreadCount(self, roomId), { timeout: 30_000, message: '进入会话后服务端未读应清零' })
      .toBe(0)
  })
})
