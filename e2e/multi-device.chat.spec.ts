import { expect, type Page, test } from '@playwright/test'
import {
  connectAndroidDevice,
  dismissLocalUnlockDialog,
  loginOnMobileUi,
  readLoggedInUserId,
  readTimelineBodies,
  sendTextFromDevice
} from './support/androidDevice'
import {
  bootstrapMatrixLivePage,
  loginToMatrixLive,
  readMatrixLiveEnv,
  sendTextMessageToRoom
} from './support/matrixLive'

/**
 * 跨设备双向收发：Android 模拟器（真 Chrome + 移动 UI） ↔ 本机桌面（本机 Chromium + 桌面 UI）。
 *
 * 与 `multi-device.android.spec.ts` 的区别：那条只验「设备能加载页面、两端打同一后端」；
 * 这条让两端**各自真实登录**，并由**客户端自己**建房/入房、互相收发一条消息。
 *
 * ## 前置（见 docs/TJG-前端启动与联调环境指南.md §五之二）
 * ```bash
 * TAURI_ENV_PLATFORM=android pnpm dev
 * ~/Library/Android/sdk/emulator/emulator -avd Medium_Phone -no-snapshot-save -no-boot-anim -no-audio &
 * adb reverse tcp:5210 tcp:5210
 * adb forward tcp:9222 localabstract:chrome_devtools_remote
 * TJG_ANDROID_CDP=http://127.0.0.1:9222 pnpm test:e2e:cross-device
 * ```
 *
 * ## 这条用例同时是三个回归的守门人
 *
 * 1. **滑窗 `rooms` 必须是扁平 map**（后端 NEW-17 曾按 /sync v2 分组成 `{join,invite,leave}`）：
 *    分组后客户端会把桶名当房间 id、伪房间没有 `initial` ⇒ `SlidingSyncSdk` 直接丢弃 ⇒ 零房间。
 * 2. **建房/入房必须先订阅**：增量同步里新房间是 `initial: false`，客户端不订阅就永远拿不到；
 *    订阅后服务端 `force_initial` 才会下发全量状态（`MatrixClientRoom` 的 `waitForRoom` 依赖它）。
 * 3. **SDK-1**：渲染层不得残留裸 `mxc://`（跨设备同样成立）。
 *
 * 注意：房间必须**未加密**（模拟器是纯浏览器，没有 Tauri 密钥库 ⇒ 解锁门禁只能选「稍后」
 * ⇒ 本次会话 E2EE fail-closed）。用例建的是普通私密房，不写 `m.room.encryption`。
 */

const CDP_URL = process.env.TJG_ANDROID_CDP?.trim() ?? ''
const APP_URL = (process.env.TJG_ANDROID_APP_URL ?? 'http://127.0.0.1:5210').replace(/\/$/, '')
/** 浏览器侧统一走 vite 代理（同源），避免自签证书与 CORS 干扰 */
const API_BASE = APP_URL

const SKIP_REASON = CDP_URL
  ? null
  : '未设置 TJG_ANDROID_CDP（需 adb forward tcp:9222 localabstract:chrome_devtools_remote）'

interface Account {
  userId: string
  accessToken: string
  username: string
  password: string
}

const registerAccount = async (prefix: string): Promise<Account> => {
  const username = `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
  // 后端密码策略要求含数字：随机串可能全字母，必须显式补一位
  const password = `Xdev!${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 10)}`
  const res = await fetch(`${API_BASE}/_matrix/client/v3/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, auth: { type: 'm.login.dummy' } })
  })
  if (!res.ok) throw new Error(`注册账号失败: HTTP ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { user_id: string; access_token: string }
  return { userId: data.user_id, accessToken: data.access_token, username, password }
}

/**
 * 用页面内的客户端建房（走 `MatrixClientRoom.createRoom`，含 5s `waitForRoom`）。
 *
 * 这条路径本身就是被测对象：它依赖「先订阅 → 服务端 force_initial → 房间进 store」。
 * 同时也断言房间未被加密（否则设备端 crypto fail-closed 解不开，用例前提不成立）。
 */
const createRoomOnPage = async (page: Page, name: string, invite: string[]): Promise<string> =>
  page.evaluate(
    async ({ roomName, invitees }) => {
      const modulePath = '/src/services/matrix/MatrixClientService.ts'
      const { matrixClientService } = (await import(/* @vite-ignore */ modulePath)) as {
        matrixClientService: {
          createRoom: (options: Record<string, unknown>) => Promise<{ roomId: string; isEncrypted?: () => boolean }>
        }
      }
      const room = await matrixClientService.createRoom({
        name: roomName,
        preset: 'private_chat',
        visibility: 'private',
        invite: invitees
      })
      if (room.isEncrypted?.()) {
        throw new Error('用例要求未加密房间，但服务端给该房间加了 m.room.encryption')
      }
      return room.roomId
    },
    { roomName: name, invitees: invite }
  )

/** 用页面内的客户端入房（走 `MatrixClientRoom.joinRoom`，同样依赖订阅 + waitForRoom） */
const joinRoomOnPage = async (page: Page, roomId: string): Promise<void> => {
  await page.evaluate(
    async ({ targetRoomId }) => {
      const modulePath = '/src/services/matrix/MatrixClientService.ts'
      const { matrixClientService } = (await import(/* @vite-ignore */ modulePath)) as {
        matrixClientService: { joinRoom: (id: string) => Promise<unknown> }
      }
      await matrixClientService.joinRoom(targetRoomId)
    },
    { targetRoomId: roomId }
  )
}

test.describe('跨设备消息互通（Android 模拟器 ↔ 本机桌面）', () => {
  test.skip(SKIP_REASON !== null, SKIP_REASON ?? '')

  test('两端各自登录后能双向收发（写 + 收）', async ({ page }) => {
    test.setTimeout(600_000)

    // 1) 两个独立账号：每台设备一个 session
    const desktopAccount = await registerAccount('xddesk')
    const deviceAccount = await registerAccount('xddev')

    // 2) 桌面端：本机 Chromium + 桌面 UI，真实密码登录
    const env = {
      ...readMatrixLiveEnv(),
      enabled: true,
      homeserverUrl: API_BASE,
      appUrl: APP_URL,
      username: desktopAccount.username,
      password: desktopAccount.password,
      userId: desktopAccount.userId,
      accessToken: desktopAccount.accessToken,
      displayName: desktopAccount.username,
      roomId: '',
      roomName: ''
    }
    // 解锁门禁已由 bootstrap 统一处理（F-10）
    await bootstrapMatrixLivePage(page, env)
    await loginToMatrixLive(page, env, 'password-api')
    await dismissLocalUnlockDialog(page) // 登录后 crypto 初始化可能再问一次

    // 不做整页导航：浏览器态 token 只在内存里（Tauri IPC 取 token 不可用），重载即掉登录。
    // 本用例验的是「这台客户端能否收发」，与页面壳是否渲染无关。
    expect(await readLoggedInUserId(page), '桌面端登录用户应为桌面账号').toBe(desktopAccount.userId)

    // 3) 设备端：真机 Chrome + 移动 UI，走页面表单登录
    const device = await connectAndroidDevice(CDP_URL, APP_URL)
    const devicePage = device.page
    const consoleErrors: string[] = []
    devicePage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200))
    })

    try {
      await loginOnMobileUi(devicePage, {
        appUrl: APP_URL,
        account: deviceAccount.username,
        password: deviceAccount.password
      })
      expect(await readLoggedInUserId(devicePage), '设备端登录用户应为移动端账号').toBe(deviceAccount.userId)

      const shape = await devicePage.evaluate(() => ({
        ua: navigator.userAgent,
        width: window.innerWidth,
        path: window.location.pathname
      }))
      expect(shape.ua).toContain('Android')
      expect(shape.width).toBeLessThan(600)
      expect(shape.path).toMatch(/^\/mobile\//)

      // 4) 设备端建房并邀请桌面端 —— 走客户端 createRoom（内部先订阅再等 store）
      const roomId = await createRoomOnPage(devicePage, 'xd-cross-device', [desktopAccount.userId])
      expect(roomId).toMatch(/^!/)

      // 5) 桌面端用自己的客户端入房（同样先订阅）
      await joinRoomOnPage(page, roomId)

      // 6) 桌面 → 设备
      const desktopText = `[cross-device desktop] ${new Date().toISOString()}`
      expect(await sendTextMessageToRoom(page, roomId, desktopText), '桌面端发送应返回 event_id').toMatch(/^\$/)

      await expect
        .poll(() => readTimelineBodies(devicePage, roomId), {
          timeout: 120_000,
          message: '等待设备端 timeline 收到桌面消息'
        })
        .toContain(desktopText)

      // 7) 设备 → 桌面
      const deviceText = `[cross-device device] ${new Date().toISOString()}`
      expect(await sendTextFromDevice(devicePage, roomId, deviceText), '设备端发送应返回 event_id').toMatch(/^\$/)

      await expect
        .poll(() => readTimelineBodies(page, roomId), {
          timeout: 120_000,
          message: '等待桌面端 timeline 收到设备消息'
        })
        .toContain(deviceText)

      // 8) 两端都不得把裸 mxc:// 塞进 DOM（SDK-1 回归）
      expect(await devicePage.locator('img[src^="mxc://"]').count()).toBe(0)
      expect(await page.locator('img[src^="mxc://"]').count()).toBe(0)

      // 关键模块加载失败会掩盖真实断链，单列断言
      const fatal = consoleErrors.filter((line) =>
        /Failed to fetch dynamically imported module|is not a function|is not defined/i.test(line)
      )
      expect(fatal, `设备端出现致命控制台错误：${fatal.join(' | ')}`).toEqual([])
    } finally {
      await device.close()
    }
  })
})
