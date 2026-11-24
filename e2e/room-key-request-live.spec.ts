/**
 * 路由集: desktop
 * 依据：断言桌面 `/settings?tab=encryption` 不再出现密钥请求面板，并在 live 环境守住
 *       「密钥请求只走标准 to-device」这条链路。
 * 校验：`tests/lint/e2e-route-sets.test.ts`（与 `e2e/specRouteSets.ts` 的 DESKTOP_ONLY_SPECS 逐条比对）。
 */
/**
 * 标准 `m.room_key_request` 回归守卫（live）。
 *
 * 历史缺陷（P0-① 假兑现）：
 * 1. 客户端曾调用自建 `POST /room_keys/request`（`DeviceKeysManager.createRoomKeyRequest`）
 *    把请求写进私有请求表；
 * 2. 该私有表里的「兑现」只把 `is_fulfilled` 置 true，并不搬运任何密钥；
 * 3. 加密设置页还提供过「手动兑现」按钮，点击后只会得到空转的成功提示。
 *
 * 现在：请求走标准 `m.room_key_request` to-device 广播（持有方 rust-crypto 回
 * `m.forwarded_room_key`），设置页该面板已删除。本用例守两件事：
 * 1. `/settings?tab=encryption` 不再渲染任何密钥请求条目/兑现按钮；
 * 2. `matrixCryptoService.createRoomKeyRequest` 之后，服务端私有 `/room_keys/request`
 *    表里**没有**该 session 的记录（私有通道没有被悄悄接回来）。
 *
 * 不做的事：不在这里断言「解密成功」——真实 UTD 自愈依赖另一台持有密钥的设备在线，
 * e2e 无法稳定造出该场景；标准 to-device 载荷由 `MatrixCryptoService.createRoomKeyRequest`
 * 的单测覆盖，解密自愈由真机联调覆盖。
 *
 * 环境变量（缺任一必需项时整例 skip）：
 * - `MATRIX_LIVE_E2E=1`
 * - `MATRIX_LIVE_HOMESERVER_URL`
 * - `MATRIX_LIVE_USERNAME` / `MATRIX_LIVE_PASSWORD`
 * - 可选：`MATRIX_LIVE_ROOM_ID`（缺省时回落到账号内第一个已加入房间）
 *
 * 运行：`CI= pnpm playwright test e2e/room-key-request-live.spec.ts --project=desktop-chromium`
 */
import { expect, type Page, test } from '@playwright/test'
import {
  bootstrapMatrixLivePage,
  getMatrixLiveSkipReason,
  loginToMatrixLive,
  readMatrixLiveEnv
} from './support/matrixLive'
import { createRuntimeIssueCollector, expectNoRuntimeIssues } from './support/runtimeIssues'

const matrixLiveEnv = readMatrixLiveEnv()

const CLIENT_MODULE_PATH = '/src/services/matrix/MatrixClientService.ts'
const CRYPTO_MODULE_PATH = '/src/services/matrix/crypto/MatrixCryptoService.ts'
const ROUTER_MODULE_PATH = '/src/router/index.ts'

/**
 * live 登录把 token 只留在内存（`persistTokens: false`），`page.goto` 会直接掉登录，
 * 因此路由切换必须走应用内 router。
 */
const pushDesktopRoute = async (page: Page, path: string): Promise<void> => {
  await page.evaluate(
    async ({ routerPath, target }: { routerPath: string; target: string }) => {
      const routerModule = (await import(/* @vite-ignore */ routerPath)) as {
        default: { push: (location: string) => Promise<unknown> }
      }
      await routerModule.default.push(target)
    },
    { routerPath: ROUTER_MODULE_PATH, target: path }
  )
}

/** 优先使用显式配置的 roomId，否则回落到账号内第一个已加入房间。 */
const resolveJoinedRoomId = (page: Page, preferredRoomId: string): Promise<string> =>
  page.evaluate(
    async ({ clientPath, preferred }: { clientPath: string; preferred: string }) => {
      if (preferred.trim()) {
        return preferred
      }
      const { matrixClientService } = (await import(/* @vite-ignore */ clientPath)) as {
        matrixClientService: {
          getClient: () => {
            getRooms?: () => Array<{ roomId: string; getMyMembership?: () => string }>
          } | null
        }
      }
      const rooms = matrixClientService.getClient()?.getRooms?.() ?? []
      return rooms.find((room) => room.getMyMembership?.() === 'join')?.roomId ?? ''
    },
    { clientPath: CLIENT_MODULE_PATH, preferred: preferredRoomId }
  )

/** 走应用真实入口发起密钥请求（标准 `m.room_key_request` to-device）。 */
const createStandardRoomKeyRequest = (page: Page, roomId: string, sessionId: string): Promise<void> =>
  page.evaluate(
    async ({ cryptoPath, targetRoomId, targetSessionId }) => {
      const { matrixCryptoService } = (await import(/* @vite-ignore */ cryptoPath)) as {
        matrixCryptoService: {
          createRoomKeyRequest: (
            roomId: string,
            sessionId: string,
            algorithm: string,
            senderKey?: string
          ) => Promise<void>
        }
      }
      await matrixCryptoService.createRoomKeyRequest(targetRoomId, targetSessionId, 'm.megolm.v1.aes-sha2')
    },
    { cryptoPath: CRYPTO_MODULE_PATH, targetRoomId: roomId, targetSessionId: sessionId }
  )

/**
 * 读取服务端私有 `/room_keys/request` 表，返回其中的 session_id 集合。
 *
 * `forceRefresh=true` 绕过 SDK 缓存，直接读服务端当前状态。
 */
const readPrivateRoomKeyRequestSessionIds = (page: Page): Promise<string[]> =>
  page.evaluate(async (clientPath: string) => {
    const { matrixClientService } = (await import(/* @vite-ignore */ clientPath)) as {
      matrixClientService: {
        getClient: () => {
          getRoomKeysManager?: () => {
            getRoomKeyRequests: (forceRefresh?: boolean) => Promise<{
              requests?: Array<{
                request_id?: string
                session_id?: string
                body?: { session_id?: string }
              }>
            }>
          }
        } | null
      }
    }
    const manager = matrixClientService.getClient()?.getRoomKeysManager?.()
    if (!manager) {
      return []
    }
    const result = await manager.getRoomKeyRequests(true)
    return (result?.requests ?? []).map((item) => item.body?.session_id ?? item.session_id ?? '')
  }, CLIENT_MODULE_PATH)

/**
 * 发送一条加密消息，并返回它所用的 Megolm `session_id`。
 *
 * 只有发送方自己能在本地 timeline 上立刻读到 `wireContent.session_id`，
 * 因此这条消息后续可以作为「会话标识」在别的设备上定位同一个事件。
 */
const sendEncryptedMessageAndGetSessionId = (page: Page, roomId: string, marker: string): Promise<string> =>
  page.evaluate(
    async ({ clientPath, targetRoomId, text }: { clientPath: string; targetRoomId: string; text: string }) => {
      const { matrixClientService } = (await import(/* @vite-ignore */ clientPath)) as {
        matrixClientService: {
          getClient: () => {
            sendEvent: (
              roomId: string,
              eventType: string,
              content: Record<string, unknown>
            ) => Promise<{ event_id?: string }>
            getRoom: (roomId: string) => {
              getLiveTimeline?: () => {
                getEvents?: () => Array<{
                  getId?: () => string
                  getWireContent?: () => { session_id?: string }
                }>
              }
            } | null
          } | null
        }
      }
      const client = matrixClientService.getClient()
      if (!client) throw new Error('客户端不可用')

      const res = await client.sendEvent(targetRoomId, 'm.room.message', { msgtype: 'm.text', body: text })
      const eventId = res?.event_id ?? ''
      if (!eventId) throw new Error('发送未返回 event_id')

      const deadline = Date.now() + 30_000
      while (Date.now() < deadline) {
        const events = client.getRoom(targetRoomId)?.getLiveTimeline?.().getEvents?.() ?? []
        const event = events.find((ev) => ev.getId?.() === eventId)
        const sessionId = event?.getWireContent?.().session_id
        if (sessionId) return sessionId
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
      throw new Error('30s 内未能从本地 timeline 读到该消息的 session_id')
    },
    { clientPath: CLIENT_MODULE_PATH, targetRoomId: roomId, text: marker }
  )

/**
 * 读取指定 Megolm 会话在本地 timeline 上的解密状态。
 *
 * **判据取自 SDK，不取 DOM 文案**：`event.isDecryptionFailure()` 是解密是否成功的
 * 唯一权威信号；页面是否渲染出「无法解密」取决于组件实现，用它做断言会假绿。
 */
const readSessionDecryptionState = (
  page: Page,
  roomId: string,
  sessionId: string
): Promise<{ found: boolean; decryptionFailure: boolean | null; body: string }> =>
  page.evaluate(
    async ({
      clientPath,
      targetRoomId,
      targetSessionId
    }: {
      clientPath: string
      targetRoomId: string
      targetSessionId: string
    }) => {
      const { matrixClientService } = (await import(/* @vite-ignore */ clientPath)) as {
        matrixClientService: {
          getClient: () => {
            getRoom: (roomId: string) => {
              getLiveTimeline?: () => {
                getEvents?: () => Array<{
                  getWireContent?: () => { session_id?: string }
                  isDecryptionFailure?: () => boolean
                  getContent?: () => { body?: string }
                }>
              }
            } | null
          } | null
        }
      }
      const events = matrixClientService.getClient()?.getRoom(targetRoomId)?.getLiveTimeline?.().getEvents?.() ?? []
      const event = events.find((ev) => ev.getWireContent?.().session_id === targetSessionId)
      if (!event) return { found: false, decryptionFailure: null, body: '' }
      return {
        found: true,
        decryptionFailure: typeof event.isDecryptionFailure === 'function' ? event.isDecryptionFailure() : null,
        body: event.getContent?.().body ?? ''
      }
    },
    { clientPath: CLIENT_MODULE_PATH, targetRoomId: roomId, targetSessionId: sessionId }
  )

test.describe('密钥请求只走标准 to-device（live 守卫）', () => {
  test.setTimeout(180_000)

  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', '该用例仅在桌面 Chromium 项目下运行')

    const skipReason = getMatrixLiveSkipReason(matrixLiveEnv)
    test.skip(Boolean(skipReason), skipReason ?? '')

    await bootstrapMatrixLivePage(page, matrixLiveEnv)
  })

  test('发起标准密钥请求后：设置页无兑现入口，私有请求表无记录', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)

    await loginToMatrixLive(page, matrixLiveEnv)

    const roomId = await resolveJoinedRoomId(page, matrixLiveEnv.roomId)
    test.skip(!roomId, '需要至少一个已加入房间（配置 MATRIX_LIVE_ROOM_ID，或账号内存在已加入房间）')

    const sessionId = `__e2e_room_key_request__${Date.now()}`
    await createStandardRoomKeyRequest(page, roomId, sessionId)

    // 1. 设置页不再有密钥请求面板（手动兑现入口已删除）
    await pushDesktopRoute(page, '/settings?tab=encryption')
    await expect(
      page.locator('[data-testid="room-key-request"]'),
      '加密设置页不应再渲染密钥请求条目（手动兑现入口已删除）'
    ).toHaveCount(0)

    // 2. 私有请求表里不应出现本次 session：一旦出现，说明有人把私有通道接回来了
    const privateSessionIds = await readPrivateRoomKeyRequestSessionIds(page)
    expect(privateSessionIds, '标准 to-device 请求不应写入私有 /room_keys/request 表').not.toContain(sessionId)

    expectNoRuntimeIssues(issues)
  })
})

test.describe('密钥请求兑现后消息实际解密（live，需真实双设备）', () => {
  test.setTimeout(300_000)

  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', '该用例仅在桌面 Chromium 项目下运行')

    const skipReason = getMatrixLiveSkipReason(matrixLiveEnv)
    test.skip(Boolean(skipReason), skipReason ?? '')

    await bootstrapMatrixLivePage(page, matrixLiveEnv)
  })

  /**
   * 端到端自愈链路（这才是「兑现」的真正验收标准）：
   *
   *   1. 发送方设备 S 发加密消息 M（S 持有 Megolm 出站会话）
   *   2. 同账号**新设备** N 收到 M 时无法解密（会话从未共享给 N）
   *   3. N 发标准 `m.room_key_request`（to-device）
   *   4. S 的 rust-crypto 收到后自动回 `m.forwarded_room_key`
   *   5. N 上同一事件从「解密失败」变为可解密，正文与原文一致
   *
   * 判据全部取自 SDK（`isDecryptionFailure()` / `getContent().body`），
   * 不取 DOM 文案 —— 否则组件换个措辞就会假绿或假红。
   */
  test('新设备 UTD 后经标准密钥请求自愈，消息正文变为可读', async ({ page, browser }) => {
    const issues = createRuntimeIssueCollector(page)

    await loginToMatrixLive(page, matrixLiveEnv)
    const roomId = await resolveJoinedRoomId(page, matrixLiveEnv.roomId)
    test.skip(!roomId, '需要至少一个已加入房间（配置 MATRIX_LIVE_ROOM_ID）')

    const marker = `__e2e_selfheal_${Date.now()}__`
    const sessionId = await sendEncryptedMessageAndGetSessionId(page, roomId, marker)
    expect(sessionId, '发送方应能从本地 timeline 读到该消息的 Megolm session_id').not.toBe('')

    const secondContext = await browser.newContext()
    const secondPage = await secondContext.newPage()
    try {
      await bootstrapMatrixLivePage(secondPage, matrixLiveEnv)
      await loginToMatrixLive(secondPage, matrixLiveEnv)

      // 1. 前置条件：新设备必须**先**是「无法解密」。
      //    若这里直接就是可解密，说明没构造出 UTD，后面的「自愈」断言毫无意义。
      await expect
        .poll(() => readSessionDecryptionState(secondPage, roomId, sessionId), {
          timeout: 90_000,
          message: '新设备应 sync 到该消息，且此时处于解密失败状态'
        })
        .toMatchObject({ found: true, decryptionFailure: true })

      // 2. 走应用真实入口发起标准密钥请求
      await createStandardRoomKeyRequest(secondPage, roomId, sessionId)

      // 3. 等待自愈：持有会话的设备自动回传后，同一事件不再解密失败
      await expect
        .poll(() => readSessionDecryptionState(secondPage, roomId, sessionId), {
          timeout: 180_000,
          message: '密钥请求应被兑现，该事件不应再处于解密失败状态'
        })
        .toMatchObject({ found: true, decryptionFailure: false })

      const state = await readSessionDecryptionState(secondPage, roomId, sessionId)
      expect(state.body, '解密后的正文必须与发送内容一致').toContain(marker)

      expectNoRuntimeIssues(issues)
    } finally {
      await secondContext.close()
    }
  })
})
