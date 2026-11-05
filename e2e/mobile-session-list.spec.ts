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
        const [{ useGlobalStore }, routerModule] = await Promise.all([
          import(/* @vite-ignore */ '/src/stores/domains/widget/global.ts') as Promise<{
            useGlobalStore: (pinia?: unknown) => { updateCurrentSessionRoomId: (id: string) => void }
          }>,
          import(/* @vite-ignore */ '/src/router/index.ts') as Promise<{
            default: { push: (to: unknown) => Promise<unknown> }
          }>
        ])
        useGlobalStore(runtimeWindow.pinia).updateCurrentSessionRoomId('')
        await routerModule.default.push('/mobile/message')
        await routerModule.default.push({ name: 'mobileChatMain', params: { roomId: targetRoomId } })
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
})
