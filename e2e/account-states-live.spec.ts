/**
 * 路由集: desktop
 * 依据：四态取证锚点都在桌面工作区（`/message` 的 `RoomSessionList`），
 *       移动 dev server（5210）装配 `/mobile/*`，没有这套 DOM。
 * 校验：`tests/lint/e2e-route-sets.test.ts`（与 `e2e/specRouteSets.ts` 名单逐条比对）。
 *
 * 四态穷举（报告 §19.57「空态 / 加载 / 错误 / 有数据」）——全部用真后端账号：
 * 1. **空态**：新注册账号没有任何房间 ⇒ `.n-empty`；
 * 2. **加载态**：会话列表加载是内存态（sync 后毫秒级完成），自然窗口不可稳定观测，
 *    因此显式注入 store（`sessionList=[]` + `sessionOptions.isLoading=true`）验证骨架屏分支；
 * 3. **错误态**：`networkBanner` 的唯一真源是 `useNetworkStatus()` 的
 *    `browserOnline` + `matrixStore.connectionState`（≈ WebSocket 连接状态）。
 *    Playwright 的 `context.setOffline(true)` 只会让 `navigator.onLine=false`，而 SDK 在
 *    ping 超时前仍报 `CONNECTED`，横幅条件不成立；因此直接把连接状态机置为
 *    `DISCONNECTED`（`isInitialized=true`）⇒ `.room-session-list__network-banner`
 *    （WS 断开文案 + 重试按钮）；
 * 4. **有数据**：建房 + 种子消息 ⇒ `role=list` 会话项 + 时间线消息真实渲染。
 *
 * 已知边界：错误态断言的是横幅分支本身（组件真源注入），不覆盖「浏览器 offline 事件
 * 到 SDK 断连」这段底层链路；该链路属于 SDK 连接状态机，另由 matrix-live 用例覆盖。
 */
import { expect, test } from '@playwright/test'
import {
  buildLiveEnv,
  createLiveRoom,
  getLiveAccountSkipReason,
  readLiveAppUrl,
  readLiveHomeserverUrl,
  registerLiveAccount,
  sendLiveRoomMessage
} from './support/liveAccount'
import {
  bootstrapMatrixLivePage,
  loginToMatrixLive,
  openMessageWorkspace,
  waitForLiveSessions
} from './support/matrixLive'
import { createRuntimeIssueCollector, expectNoRuntimeIssues } from './support/runtimeIssues'

const SESSION_STORE_PATH = '/src/stores/domains/chat/chat/session.ts'
const MATRIX_STORE_PATH = '/src/stores/domains/chat/matrix.ts'

const resolveDesktopAppUrl = (): string => readLiveAppUrl(test.info().project.use.baseURL ?? undefined)

test.describe('账号内会话列表四态（真后端）', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop-chromium', '四态取证仅在桌面项目运行')
    const skipReason = getLiveAccountSkipReason()
    test.skip(Boolean(skipReason), skipReason ?? '')
  })

  test('空态：新账号无房间显示空状态', async ({ page }) => {
    test.setTimeout(120_000)
    const issues = createRuntimeIssueCollector(page)
    const homeserverUrl = readLiveHomeserverUrl()
    const account = await registerLiveAccount(homeserverUrl, { prefix: 'e2eempty' })

    const env = buildLiveEnv({ account, appUrl: resolveDesktopAppUrl(), homeserverUrl })
    await bootstrapMatrixLivePage(page, env)
    await loginToMatrixLive(page, env)
    await openMessageWorkspace(page)

    await expect(page.locator('.n-empty'), '无房间账号应渲染空状态').toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.room-session-list__body[role="list"]')).toHaveCount(0)
    await expect(page.locator('.room-session-list__skeleton')).toHaveCount(0)

    expectNoRuntimeIssues(issues)
  })

  test('加载态：会话列表骨架屏分支', async ({ page }) => {
    test.setTimeout(120_000)
    const issues = createRuntimeIssueCollector(page)
    const homeserverUrl = readLiveHomeserverUrl()
    const account = await registerLiveAccount(homeserverUrl, { prefix: 'e2eload' })

    const env = buildLiveEnv({ account, appUrl: resolveDesktopAppUrl(), homeserverUrl })
    await bootstrapMatrixLivePage(page, env)
    await loginToMatrixLive(page, env)
    await openMessageWorkspace(page)
    await expect(page.locator('.n-empty')).toBeVisible({ timeout: 30_000 })

    // 内存态加载：清空列表并置 isLoading，验证 `v-else-if="sessionLoading"` 分支
    await page.evaluate(async (storePath: string) => {
      const module = (await import(/* @vite-ignore */ storePath)) as {
        useSessionStore: () => {
          sessionList: unknown[]
          sessionOptions: { isLoading: boolean }
        }
      }
      const store = module.useSessionStore()
      store.sessionList = []
      store.sessionOptions.isLoading = true
    }, SESSION_STORE_PATH)

    await expect(page.locator('.room-session-list__skeleton')).toHaveCount(5, { timeout: 15_000 })
    await expect(page.locator('.n-empty')).toHaveCount(0)

    // 复位，避免影响同文件其他用例的共享 store 状态
    await page.evaluate(async (storePath: string) => {
      const module = (await import(/* @vite-ignore */ storePath)) as {
        useSessionStore: () => { sessionOptions: { isLoading: boolean } }
      }
      module.useSessionStore().sessionOptions.isLoading = false
    }, SESSION_STORE_PATH)

    expectNoRuntimeIssues(issues)
  })

  test('错误态：连接断开时展示网络横幅与重试入口', async ({ page }) => {
    test.setTimeout(120_000)
    const issues = createRuntimeIssueCollector(page)
    const homeserverUrl = readLiveHomeserverUrl()
    const account = await registerLiveAccount(homeserverUrl, { prefix: 'e2eoffline' })

    const env = buildLiveEnv({ account, appUrl: resolveDesktopAppUrl(), homeserverUrl })
    await bootstrapMatrixLivePage(page, env)
    await loginToMatrixLive(page, env)
    await openMessageWorkspace(page)
    await expect(page.locator('.n-empty')).toBeVisible({ timeout: 30_000 })

    // 注入连接状态机真源：isInitialized=true 才能把 DISCONNECTED 解释为「已知断开」，
    // 否则 useNetworkStatus 返回 unknown（null），横幅不出现。
    await page.evaluate(async (storePath: string) => {
      const module = (await import(/* @vite-ignore */ storePath)) as {
        useMatrixStore: () => { connectionState: string; isInitialized: boolean }
      }
      const store = module.useMatrixStore()
      store.isInitialized = true
      store.connectionState = 'DISCONNECTED'
    }, MATRIX_STORE_PATH)

    const banner = page.locator('.room-session-list__network-banner')
    await expect(banner, '连接断开应展示网络横幅').toBeVisible({ timeout: 15_000 })
    await expect(banner).toContainText(/.+/)
    await expect(banner.locator('[data-test="network-retry"]'), 'WS 断开横幅应带重试按钮').toBeVisible()

    // 复位连接状态，避免共享 store 影响后续用例
    await page.evaluate(async (storePath: string) => {
      const module = (await import(/* @vite-ignore */ storePath)) as {
        useMatrixStore: () => { connectionState: string }
      }
      module.useMatrixStore().connectionState = 'CONNECTED'
    }, MATRIX_STORE_PATH)
    await expect(banner).toHaveCount(0)

    expectNoRuntimeIssues(issues)
  })

  test('有数据：会话项与时间线消息真实渲染', async ({ page }) => {
    test.setTimeout(150_000)
    const issues = createRuntimeIssueCollector(page)
    const homeserverUrl = readLiveHomeserverUrl()
    const account = await registerLiveAccount(homeserverUrl, { prefix: 'e2edata' })
    const stamp = Date.now().toString(36)
    const roomId = await createLiveRoom(homeserverUrl, account.accessToken, { name: `四态-${stamp}` })
    const seedText = `四态种子-${stamp}`
    await sendLiveRoomMessage(homeserverUrl, account.accessToken, roomId, seedText)

    const env = buildLiveEnv({ account, appUrl: resolveDesktopAppUrl(), homeserverUrl, roomId })
    await bootstrapMatrixLivePage(page, env)
    await loginToMatrixLive(page, env)
    await openMessageWorkspace(page)
    await waitForLiveSessions(page)

    const item = page.locator(`[data-test="session-item-${roomId}"]`)
    await expect(item).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.room-session-list__body[role="list"]')).toBeVisible()
    await expect(page.locator('.n-empty')).toHaveCount(0)

    await item.focus()
    await page.keyboard.press('Enter')
    await expect(item).toHaveAttribute('aria-current', 'true', { timeout: 15_000 })
    await expect(page.getByText(seedText).first(), '时间线应渲染真实消息').toBeVisible({ timeout: 30_000 })

    expectNoRuntimeIssues(issues)
  })
})
