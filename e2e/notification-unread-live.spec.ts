/**
 * 路由集: desktop
 * 依据：断言桌面设置页 `/settings?tab=notifications` 的通知历史列表（`PushNotificationHistory`）；
 *       移动端不装配该设置路由，在 5210 下必然假红。
 * 校验：`tests/lint/e2e-route-sets.test.ts`（与 `e2e/specRouteSets.ts` 的 DESKTOP_ONLY_SPECS 逐条比对）。
 */
/**
 * 通知未读双设备端到端：peer 发消息 -> primary 收到未读通知 -> 通知历史只渲染未读 -> ack 后移出。
 *
 * 覆盖点：
 * 1. 房间内他人消息会在服务端为接收方落一条**未读**通知行（`read=false`）；
 * 2. 通知历史页只渲染未读项（`filterUnreadNotifications`）：已读的条目不可见；
 * 3. 点击「确认」后条目立即移出，服务端 `read` 变 true；
 * 4. 切走再切回（不 reload，live token 只在内存里）不会让已确认条目“回潮”。
 *
 * 环境变量（缺任一必需项时整例 skip）：
 * - `MATRIX_LIVE_E2E=1`
 * - `MATRIX_LIVE_HOMESERVER_URL`
 * - `MATRIX_LIVE_USERNAME` / `MATRIX_LIVE_PASSWORD`
 * - `MATRIX_LIVE_PEER_USERNAME` / `MATRIX_LIVE_PEER_PASSWORD`
 * - `MATRIX_LIVE_ROOM_ID` 或 `MATRIX_LIVE_ROOM_NAME`（peer 必须在该房间里）
 *
 * 运行：`CI= pnpm playwright test e2e/notification-unread-live.spec.ts --project=desktop-chromium`
 */
import { expect, type Page, test } from '@playwright/test'
import {
  bootstrapMatrixLivePage,
  createLiveProbeMessage,
  getMatrixLivePeerSkipReason,
  getMatrixLiveSkipReason,
  loginToMatrixLive,
  openConfiguredRoom,
  openMessageWorkspace,
  readMatrixLiveEnv,
  sendTextMessageToRoom,
  waitForLiveSessions
} from './support/matrixLive'
import { createRuntimeIssueCollector, expectNoRuntimeIssues } from './support/runtimeIssues'

const matrixLiveEnv = readMatrixLiveEnv()

const NOTIFICATION_MODULE_PATH = '/src/services/matrix/notifications/MatrixNotificationService.ts'
const ROUTER_MODULE_PATH = '/src/router/index.ts'

interface LiveNotificationRow {
  eventId: string
  notificationId: string
  read: boolean
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

/** 直接读服务端通知列表（每次都是 HTTP GET，无前端缓存）。 */
const readNotifications = (page: Page): Promise<LiveNotificationRow[]> =>
  page.evaluate(async (modulePath: string) => {
    const { matrixNotificationService } = (await import(/* @vite-ignore */ modulePath)) as {
      matrixNotificationService: {
        getNotifications: (from?: string, limit?: number) => Promise<{ notifications?: Array<Record<string, unknown>> }>
      }
    }
    const result = await matrixNotificationService.getNotifications(undefined, 100)
    return (result?.notifications ?? []).map((row) => ({
      eventId: typeof row.event_id === 'string' ? row.event_id : '',
      notificationId:
        row.notification_id === undefined || row.notification_id === null ? '' : String(row.notification_id),
      read: row.read === true
    }))
  }, NOTIFICATION_MODULE_PATH)

const ackNotification = (page: Page, notificationId: string): Promise<boolean> =>
  page.evaluate(
    async ({ modulePath, targetNotificationId }: { modulePath: string; targetNotificationId: string }) => {
      const { matrixNotificationService } = (await import(/* @vite-ignore */ modulePath)) as {
        matrixNotificationService: { ackNotification: (notificationId: string) => Promise<boolean> }
      }
      return matrixNotificationService.ackNotification(targetNotificationId)
    },
    { modulePath: NOTIFICATION_MODULE_PATH, targetNotificationId: notificationId }
  )

const findNotification = async (page: Page, eventId: string): Promise<LiveNotificationRow | undefined> => {
  const rows = await readNotifications(page)
  return rows.find((row) => row.eventId === eventId)
}

test.describe('通知未读渲染（双设备 live）', () => {
  test.setTimeout(300_000)

  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', '该用例仅在桌面 Chromium 项目下运行')

    const skipReason = getMatrixLiveSkipReason(matrixLiveEnv) ?? getMatrixLivePeerSkipReason(matrixLiveEnv)
    test.skip(Boolean(skipReason), skipReason ?? '')

    // restore-token 模式下 peer 与 primary 共用同一份内存态，无法开第二台设备
    test.skip(matrixLiveEnv.authStrategy === 'restore-token', 'restore-token 模式无法开启 peer 的第二台设备')

    await bootstrapMatrixLivePage(page, matrixLiveEnv)
  })

  test('他人消息产生的未读通知只渲染未读，确认后移出且不回潮', async ({ page, browser }) => {
    const issuesPrimary = createRuntimeIssueCollector(page)
    const peerContext = await browser.newContext()
    const peerPage = await peerContext.newPage()
    const issuesPeer = createRuntimeIssueCollector(peerPage)

    try {
      await bootstrapMatrixLivePage(peerPage, matrixLiveEnv)
      await loginToMatrixLive(page, matrixLiveEnv)
      await loginToMatrixLive(peerPage, matrixLiveEnv, 'peer')

      await openMessageWorkspace(page)
      await waitForLiveSessions(page)
      await openMessageWorkspace(peerPage)
      await waitForLiveSessions(peerPage)

      const roomId = await openConfiguredRoom(peerPage, matrixLiveEnv)

      const marker = createLiveProbeMessage(matrixLiveEnv)
      const pendingEventId = await sendTextMessageToRoom(peerPage, roomId, `${marker} unread-pending`)
      const readEventId = await sendTextMessageToRoom(peerPage, roomId, `${marker} unread-already-read`)

      await expect
        .poll(
          async () => {
            const rows = await readNotifications(page)
            return [pendingEventId, readEventId].filter((eventId) => rows.some((row) => row.eventId === eventId)).length
          },
          { timeout: 120_000, message: '等待服务端为 peer 的消息落未读通知行' }
        )
        .toBe(2)

      const pendingNotification = await findNotification(page, pendingEventId)
      const readNotification = await findNotification(page, readEventId)
      expect(pendingNotification?.notificationId, '未读通知缺少 notification_id').toBeTruthy()
      expect(readNotification?.notificationId, '待预读通知缺少 notification_id').toBeTruthy()
      expect(pendingNotification?.read, '新消息通知初始应为未读').toBe(false)
      expect(readNotification?.read, '新消息通知初始应为未读').toBe(false)

      // 先用 API 确认掉第二条，构造“列表里同时存在已读与未读”的场景
      expect(await ackNotification(page, readNotification?.notificationId ?? ''), '服务端 ack 应成功').toBe(true)
      await expect
        .poll(async () => (await findNotification(page, readEventId))?.read ?? false, {
          timeout: 30_000,
          message: '等待服务端把预读通知标记为已读'
        })
        .toBe(true)

      await pushDesktopRoute(page, '/settings?tab=notifications')

      const pendingRow = page.locator(
        `[data-testid="notification-row"][data-notification-id="${pendingNotification?.notificationId}"]`
      )
      const alreadyReadRow = page.locator(
        `[data-testid="notification-row"][data-notification-id="${readNotification?.notificationId}"]`
      )

      await expect(pendingRow, '未读通知应出现在通知历史列表').toBeVisible({ timeout: 60_000 })
      await expect(alreadyReadRow, '已读通知不应被通知历史渲染').toHaveCount(0)

      await pendingRow.locator('[data-testid="notification-ack"]').click()
      await expect(pendingRow, '确认后该条目应立即移出列表').toHaveCount(0, { timeout: 30_000 })

      await expect
        .poll(async () => (await findNotification(page, pendingEventId))?.read ?? false, {
          timeout: 30_000,
          message: '等待服务端把页面内确认的通知标记为已读'
        })
        .toBe(true)

      // 切走再切回（不能 reload），已确认条目不得回潮
      await pushDesktopRoute(page, '/message')
      await pushDesktopRoute(page, '/settings?tab=notifications')
      await expect(
        page.locator(`[data-testid="notification-row"][data-notification-id="${pendingNotification?.notificationId}"]`),
        '切回通知历史后已确认条目不应回潮'
      ).toHaveCount(0, { timeout: 60_000 })
      await expect(
        page.locator(`[data-testid="notification-row"][data-notification-id="${readNotification?.notificationId}"]`),
        '切回通知历史后已读条目仍不应渲染'
      ).toHaveCount(0)

      expectNoRuntimeIssues(issuesPrimary)
      expectNoRuntimeIssues(issuesPeer)
    } finally {
      await peerContext.close()
    }
  })
})
