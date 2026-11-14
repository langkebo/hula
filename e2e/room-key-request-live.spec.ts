/**
 * 路由集: desktop
 * 依据：断言桌面设置页 `/settings?tab=encryption` 内的密钥请求面板（`RoomKeyRequestsSection`）；
 *       移动端不装配该设置路由与面板，在 5210 下必然假红。
 * 校验：`tests/lint/e2e-route-sets.test.ts`（与 `e2e/specRouteSets.ts` 的 DESKTOP_ONLY_SPECS 逐条比对）。
 */
/**
 * S1-UI 双设备端到端：同一账号 A 设备发起房间密钥请求，B 设备在加密设置页兑现。
 *
 * 覆盖点：
 * 1. A、B 是同一账号下的两个不同 device（`password-api` 登录不传 device_id，服务端各自发号）；
 * 2. B 设备打开 `/settings?tab=encryption` 能看到 A 发起的**待处理**请求；
 * 3. 点击「兑现」后条目立即移出列表，且刷新列表不会“复活”（依赖是否只渲染 pending 的过滤）；
 * 4. 服务端记录 `status=fulfilled` 且 `fulfilled_by_device` 是 B 的 deviceId。
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
  openMessageWorkspace,
  readMatrixLiveEnv,
  waitForLiveSessions
} from './support/matrixLive'
import { createRuntimeIssueCollector, expectNoRuntimeIssues } from './support/runtimeIssues'

const matrixLiveEnv = readMatrixLiveEnv()

const CLIENT_MODULE_PATH = '/src/services/matrix/MatrixClientService.ts'
const ROUTER_MODULE_PATH = '/src/router/index.ts'

interface RoomKeyRequestSummary {
  request_id?: string
  status?: string
  fulfilled_by_device?: string | null
}

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

const readDeviceId = (page: Page): Promise<string> =>
  page.evaluate(async (clientPath: string) => {
    const { matrixClientService } = (await import(/* @vite-ignore */ clientPath)) as {
      matrixClientService: { getClient: () => { getDeviceId?: () => string | null } | null }
    }
    return matrixClientService.getClient()?.getDeviceId?.() ?? ''
  }, CLIENT_MODULE_PATH)

const readUserId = (page: Page): Promise<string> =>
  page.evaluate(async (clientPath: string) => {
    const { matrixClientService } = (await import(/* @vite-ignore */ clientPath)) as {
      matrixClientService: { getClient: () => { getUserId?: () => string | null } | null }
    }
    return matrixClientService.getClient()?.getUserId?.() ?? ''
  }, CLIENT_MODULE_PATH)

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

const createRoomKeyRequest = (page: Page, roomId: string, sessionId: string): Promise<string> =>
  page.evaluate(
    async ({ clientPath, roomId: targetRoomId, sessionId: targetSessionId }) => {
      const { matrixClientService } = (await import(/* @vite-ignore */ clientPath)) as {
        matrixClientService: {
          getClient: () => {
            getRoomKeysManager?: () => {
              createRoomKeyRequest: (request: {
                algorithm: string
                room_id: string
                session_id: string
              }) => Promise<{ request_id?: string }>
            }
          } | null
        }
      }
      const manager = matrixClientService.getClient()?.getRoomKeysManager?.()
      if (!manager) {
        throw new Error('Matrix client 未就绪，无法发起密钥请求')
      }
      const result = await manager.createRoomKeyRequest({
        algorithm: 'm.megolm.v1.aes-sha2',
        room_id: targetRoomId,
        session_id: targetSessionId
      })
      return result?.request_id ?? ''
    },
    { clientPath: CLIENT_MODULE_PATH, roomId, sessionId }
  )

/** `forceRefresh=true` 绕过 SDK 的 5 分钟缓存，直接读服务端当前状态。 */
const readRoomKeyRequest = (page: Page, requestId: string): Promise<RoomKeyRequestSummary | null> =>
  page.evaluate(
    async ({ clientPath, targetRequestId }: { clientPath: string; targetRequestId: string }) => {
      const { matrixClientService } = (await import(/* @vite-ignore */ clientPath)) as {
        matrixClientService: {
          getClient: () => {
            getRoomKeysManager?: () => {
              getRoomKeyRequests: (forceRefresh?: boolean) => Promise<{ requests?: RoomKeyRequestSummary[] }>
            }
          } | null
        }
      }
      const manager = matrixClientService.getClient()?.getRoomKeysManager?.()
      if (!manager) {
        return null
      }
      const result = await manager.getRoomKeyRequests(true)
      return (result?.requests ?? []).find((item) => item.request_id === targetRequestId) ?? null
    },
    { clientPath: CLIENT_MODULE_PATH, targetRequestId: requestId }
  )

const deleteRoomKeyRequest = (page: Page, requestId: string): Promise<void> =>
  page.evaluate(
    async ({ clientPath, targetRequestId }: { clientPath: string; targetRequestId: string }) => {
      const { matrixClientService } = (await import(/* @vite-ignore */ clientPath)) as {
        matrixClientService: {
          getClient: () => {
            getRoomKeysManager?: () => {
              deleteRoomKeyRequest: (requestId: string) => Promise<unknown>
            }
          } | null
        }
      }
      const manager = matrixClientService.getClient()?.getRoomKeysManager?.()
      if (!manager) {
        return
      }
      await manager.deleteRoomKeyRequest(targetRequestId)
    },
    { clientPath: CLIENT_MODULE_PATH, targetRequestId: requestId }
  )

test.describe('S1-UI 密钥请求兑现（双设备 live）', () => {
  test.setTimeout(300_000)

  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', '该用例仅在桌面 Chromium 项目下运行')

    const skipReason = getMatrixLiveSkipReason(matrixLiveEnv)
    test.skip(Boolean(skipReason), skipReason ?? '')

    // restore-token 模式下两个 context 共用同一 access_token，拿不到两个独立 device，
    // 也就无法覆盖“A 发起、B 兑现”的跨设备语义。
    test.skip(
      matrixLiveEnv.authStrategy === 'restore-token',
      'restore-token 模式两台“设备”共用同一 token，无法覆盖跨设备兑现'
    )

    await bootstrapMatrixLivePage(page, matrixLiveEnv)
  })

  test('A 设备发起密钥请求，B 设备在加密设置页兑现后条目不再出现', async ({ page, browser }) => {
    const issuesA = createRuntimeIssueCollector(page)
    const secondContext = await browser.newContext()
    const pageB = await secondContext.newPage()
    const issuesB = createRuntimeIssueCollector(pageB)
    let requestId = ''

    try {
      await bootstrapMatrixLivePage(pageB, matrixLiveEnv)
      await loginToMatrixLive(page, matrixLiveEnv)
      await loginToMatrixLive(pageB, matrixLiveEnv)

      const deviceIdA = await readDeviceId(page)
      const deviceIdB = await readDeviceId(pageB)
      expect(deviceIdA, 'A 设备未拿到 deviceId').not.toBe('')
      expect(deviceIdB, 'B 设备未拿到 deviceId').not.toBe('')
      expect(deviceIdA, '两台“设备”必须是同一账号下的不同 device').not.toBe(deviceIdB)
      expect(await readUserId(page), 'A、B 必须登录同一账号').toBe(await readUserId(pageB))

      await openMessageWorkspace(page)
      await waitForLiveSessions(page)
      const roomId = await resolveJoinedRoomId(page, matrixLiveEnv.roomId)
      test.skip(!roomId, '需要至少一个已加入房间（配置 MATRIX_LIVE_ROOM_ID，或账号内存在已加入房间）')

      requestId = await createRoomKeyRequest(page, roomId, `__e2e_room_key_request__${Date.now()}`)
      expect(requestId, '发起密钥请求未返回 request_id').not.toBe('')

      await pushDesktopRoute(pageB, '/settings?tab=encryption')
      const row = pageB.locator(`[data-testid="room-key-request"][data-request-id="${requestId}"]`)
      await expect(row, 'B 设备应能看到 A 设备发起的待处理密钥请求').toBeVisible({ timeout: 60_000 })

      await row.locator('[data-testid="room-key-request-fulfill"]').click()
      await expect(row, '兑现后该请求应从未处理列表移出').toHaveCount(0, { timeout: 60_000 })

      // 刷新列表不得把已兑现的请求重新渲染出来（依赖 only-pending 过滤）
      await pageB.locator('[data-testid="room-key-requests-refresh"]').click()
      await expect(row, '刷新后已兑现的请求不应“复活”').toHaveCount(0, { timeout: 60_000 })

      const fulfilled = await readRoomKeyRequest(pageB, requestId)
      expect(fulfilled, '服务端应保留该请求记录').not.toBeNull()
      expect(fulfilled?.status, '服务端状态应为 fulfilled').toBe('fulfilled')
      expect(fulfilled?.fulfilled_by_device, '兑现方必须记录为 B 的 deviceId').toBe(deviceIdB)

      expectNoRuntimeIssues(issuesA)
      expectNoRuntimeIssues(issuesB)
    } finally {
      if (requestId) {
        try {
          await deleteRoomKeyRequest(pageB, requestId)
        } catch {
          // 清理失败不影响断言结论
        }
      }
      await secondContext.close()
    }
  })
})
