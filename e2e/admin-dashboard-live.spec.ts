/**
 * 路由集: desktop
 * 依据：管理后台（`/admin/*`）只在桌面路由集装配（`src/router/routes/desktop.ts`），
 *       移动端按 R2 硬性约束不引用 admin store，5210 下必然 404。
 * 校验：`tests/lint/e2e-route-sets.test.ts`（与 `e2e/specRouteSets.ts` 的 DESKTOP_ONLY_SPECS 逐条比对）。
 */
/**
 * 管理后台端到端（真后端）：逐页门控 + 提权后面板运行态（报告 §13.11 第 1 项）。
 *
 * 覆盖全部 30 个 `/admin/*` 页面，两类判据：
 * 1. **普通账号逐页进后台必须被拒**（`authGuard` 对 `requiresAdmin` 返回 `'/'`）——
 *    自注册普通账号即可，不需要 MFA。
 * 2. **提权后逐页可见真实面板**（`.admin-layout` 可见、无 `.admin-state-panel`、
 *    `.admin-content` 有实际子节点、URL 命中目标 path）——
 *    后端 `security.admin_mfa_required=true` 时管理员登录要 6 位 TOTP，
 *    脚本从部署侧 `ADMIN_MFA_SHARED_SECRET` 现算 `mfa_code` 换 token，
 *    再以 `restore-token` 策略注入页面（app 内置密码登录不带 `mfa_code`）。
 *
 * 提权生效链路：`is_admin` 不是 JWT claim，而是 `user:admin:{userId}` 缓存
 * （`ADMIN_CACHE_TTL_SECS=60`，进程内 L1 + Redis）。改库后必须 `DEL` 该键，
 * 进程内 L1 只能等 TTL 过期，因此下面用轮询而不是硬 sleep。
 *
 * 运行（桌面 dev server 必须是 5211；5210 是移动路由集）：
 *   MATRIX_LIVE_E2E=1 MATRIX_LIVE_HOMESERVER_URL=http://127.0.0.1:8008 \
 *   MATRIX_LIVE_APP_URL=http://127.0.0.1:5211 \
 *   CI= npx playwright test e2e/admin-dashboard-live.spec.ts --project=desktop-chromium
 */
import { expect, type Page, test } from '@playwright/test'
import {
  buildLiveEnv,
  generateTotpCode,
  getLiveAccountSkipReason,
  loginLiveAccount,
  readAdminMfaSecret,
  readLiveAppUrl,
  readLiveHomeserverUrl,
  registerLiveAccount,
  setLiveAdminFlag
} from './support/liveAccount'
import { bootstrapMatrixLivePage, loginToMatrixLive, type MatrixLiveEnv } from './support/matrixLive'
import { createRuntimeIssueCollector, expectNoRuntimeIssues } from './support/runtimeIssues'

const ROUTER_MODULE_PATH = '/src/router/index.ts'
const CLIENT_MODULE_PATH = '/src/services/matrix/MatrixClientService.ts'
const ADMIN_STORE_PATH = '/src/stores/domains/admin/admin.ts'

/** 与 `src/router/routes/desktop.ts` 的 `/admin` 子路由逐条对应。 */
const ADMIN_ROUTES: readonly string[] = [
  '/admin/dashboard',
  '/admin/users',
  '/admin/rooms',
  '/admin/federation',
  '/admin/notices',
  '/admin/registration-tokens',
  '/admin/security',
  '/admin/audit',
  '/admin/retention',
  '/admin/server-logs',
  '/admin/federation-monitor',
  '/admin/saml',
  '/admin/maintenance',
  '/admin/server-config',
  '/admin/guests',
  '/admin/spaces',
  '/admin/notifications',
  '/admin/app-services',
  '/admin/telemetry',
  '/admin/background-updates',
  '/admin/media',
  '/admin/moderation',
  '/admin/account-policy',
  '/admin/modules',
  '/admin/external-services',
  '/admin/callbacks',
  '/admin/push',
  '/admin/cleanup',
  '/admin/invite-policy',
  '/admin/cas'
]

const readUserId = (page: Page): Promise<string> =>
  page.evaluate(async (clientPath: string) => {
    const { matrixClientService } = (await import(/* @vite-ignore */ clientPath)) as {
      matrixClientService: { getClient: () => { getUserId?: () => string | null } | null }
    }
    return matrixClientService.getClient()?.getUserId?.() ?? ''
  }, CLIENT_MODULE_PATH)

/** 清 admin store 的 5 分钟缓存 + 真跑一次身份判定（失败时给可读诊断） */
const readAdminStatus = (page: Page): Promise<{ isAdmin: boolean; availability: string | null }> =>
  page.evaluate(async (storePath: string) => {
    const { useAdminStore } = (await import(/* @vite-ignore */ storePath)) as {
      useAdminStore: () => {
        clearAdminState: () => void
        checkAdminStatus: () => Promise<boolean>
        isAdmin: boolean
        apiAvailability: { status?: string } | null
      }
    }
    const store = useAdminStore()
    store.clearAdminState()
    const result = await store.checkAdminStatus()
    return {
      isAdmin: Boolean(result ?? store.isAdmin),
      availability: store.apiAvailability?.status ?? null
    }
  }, ADMIN_STORE_PATH)

/** 路由切换必须走应用内 router（live 登录的 token 只在内存，`goto` 会掉登录） */
const pushDesktopRoute = async (page: Page, path: string): Promise<void> => {
  // 给当前视图打标记，用于判定「切换后是否真的换了页面」。
  // 只断言 `.admin-content` 有子节点不够：渲染期异常会让 Vue 停在旧页面上，
  // 此时子节点仍然存在（实测 `/admin/audit` 崩溃后 30 页全部停在审计日志）。
  // 必须用 page.evaluate 而非 locator（后者对不存在的元素会白等 30s action timeout）。
  await page.evaluate(() => {
    const container = document.querySelector('.admin-content')
    for (const child of Array.from(container?.children ?? [])) {
      child.setAttribute('data-e2e-visited', '1')
    }
  })
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

const resolveDesktopAppUrl = (): string => readLiveAppUrl(test.info().project.use.baseURL ?? undefined)

const openLivePage = async (page: Page, env: MatrixLiveEnv): Promise<void> => {
  await bootstrapMatrixLivePage(page, env)
  await loginToMatrixLive(page, env)
}

/**
 * 断言当前渲染的管理页处于「就绪且非空」状态。
 *
 * 只依赖 `AdminLayout` 的稳定锚点，避免逐页维护 30 个业务 marker：
 * `.admin-state-panel` 存在即表示导航/可用性探测未就绪；
 * 视图必须出现**未被打上 data-e2e-visited 标记的新节点**，否则说明还停在上一页。
 */
const expectAdminPageReady = async (page: Page, path: string): Promise<void> => {
  await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.admin-state-panel')).toHaveCount(0)
  await expect(page.locator('.admin-content > :not([data-e2e-visited])')).not.toHaveCount(0)
  await expect(page.locator('.admin-page-title')).not.toHaveText('')
  expect(new URL(page.url()).pathname, `路由应停在 ${path}`).toBe(path)
}

test.describe('管理后台（真后端）', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop-chromium', '管理后台只在桌面路由集装配')
    const skipReason = getLiveAccountSkipReason()
    test.skip(Boolean(skipReason), skipReason ?? '')
  })

  test('普通账号逐页进后台被重定向回首页', async ({ page }) => {
    test.setTimeout(180_000)
    const issues = createRuntimeIssueCollector(page)
    const homeserverUrl = readLiveHomeserverUrl()
    const account = await registerLiveAccount(homeserverUrl, { prefix: 'e2eadmin' })
    const env = buildLiveEnv({ account, appUrl: resolveDesktopAppUrl(), homeserverUrl })

    await openLivePage(page, env)

    const userId = await readUserId(page)
    expect(userId, '登录后应拿到 userId').not.toBe('')
    const status = await readAdminStatus(page)
    expect(status.isAdmin, `非管理员身份判定应为 false（诊断：${JSON.stringify(status)}）`).toBe(false)

    for (const route of ADMIN_ROUTES) {
      await pushDesktopRoute(page, route)
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 30_000, message: `${route} 应被门控拦截` })
        .not.toMatch(/^\/admin/)
      await expect(page.locator('.admin-layout'), `${route} 不应渲染后台布局`).toHaveCount(0)
      await expect(page.locator('.admin-nav-item'), `${route} 不应出现后台导航`).toHaveCount(0)
    }

    expectNoRuntimeIssues(issues)
  })

  test('提权后逐页可见后台面板与真实数据', async ({ page }) => {
    test.setTimeout(300_000)
    const issues = createRuntimeIssueCollector(page)
    const homeserverUrl = readLiveHomeserverUrl()
    const account = await registerLiveAccount(homeserverUrl, { prefix: 'e2eops' })

    const mfaSecret = readAdminMfaSecret()
    test.skip(!mfaSecret, '未取到 ADMIN_MFA_SHARED_SECRET，无法完成管理员 TOTP 登录')

    setLiveAdminFlag(account.username, true)

    // app 内置密码登录不带 mfa_code ⇒ 先服务端换 token，再以 restore-token 注入页面
    let adminSession: Awaited<ReturnType<typeof loginLiveAccount>>
    try {
      adminSession = await loginLiveAccount(homeserverUrl, {
        username: account.username,
        password: account.password,
        mfaCode: () => generateTotpCode(mfaSecret)
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      test.skip(true, `管理员登录失败（后端 admin_mfa_required 或 TOTP 密钥不匹配）：${message.slice(0, 200)}`)
      throw error
    }

    const env = buildLiveEnv({
      account: adminSession,
      appUrl: resolveDesktopAppUrl(),
      homeserverUrl,
      authStrategy: 'restore-token'
    })
    await openLivePage(page, env)

    const userId = await readUserId(page)
    expect(userId, '提权账号登录后应拿到 userId').toBe(account.userId)

    await expect
      .poll(async () => (await readAdminStatus(page)).isAdmin, {
        timeout: 100_000,
        intervals: [2_000],
        message: '等待服务端 user:admin 缓存过期后重新读库判定为 true'
      })
      .toBe(true)

    for (const route of ADMIN_ROUTES) {
      await pushDesktopRoute(page, route)
      await expectAdminPageReady(page, route)
    }

    // 菜单门控：就绪态应渲染出可选导航项，且全部指向 `/admin/*`
    const navItems = page.locator('.admin-nav-item')
    expect(await navItems.count(), '后台导航项应可见').toBeGreaterThan(0)
    const hrefs = await navItems.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''))
    for (const href of hrefs) {
      expect(href.startsWith('/admin/'), `导航项应指向后台路由，实际：${href}`).toBe(true)
    }

    // 用户列表读的是服务端真实数据（列表里应出现当前账号）
    await pushDesktopRoute(page, '/admin/users')
    const usersPage = page.locator('.admin-users')
    try {
      await expect(usersPage).toBeVisible({ timeout: 30_000 })
    } catch (error) {
      const content = await page
        .locator('.admin-content')
        .innerText()
        .catch(() => '<无 .admin-content>')
      const statePanel = await page
        .locator('.admin-state-panel')
        .innerText()
        .catch(() => '<无 .admin-state-panel>')
      throw new Error(
        `用户列表页未渲染：url=${page.url()}\nstatePanel=${statePanel.slice(0, 300)}\ncontent=${content.slice(0, 600)}\n原始错误：${error instanceof Error ? error.message.slice(0, 300) : String(error)}`
      )
    }
    await expect.poll(async () => page.locator('body').innerText(), { timeout: 30_000 }).toContain(userId)

    expectNoRuntimeIssues(issues)
  })
})
