/**
 * 路由集: desktop
 * 依据：管理后台（`/admin/*`）只在桌面路由集装配（`src/router/routes/desktop.ts`），
 *       移动端按 R2 硬性约束不引用 admin store，5210 下必然 404。
 * 校验：`tests/lint/e2e-route-sets.test.ts`（与 `e2e/specRouteSets.ts` 的 DESKTOP_ONLY_SPECS 逐条比对）。
 */
/**
 * 管理后台端到端（真后端）：把「admin e2e 命中 0」变成可复跑的主链路。
 *
 * 两条判据分开，因为它们的环境依赖不同：
 * 1. **普通账号进 `/admin/dashboard` 必须被拒**（`authGuard` 对 `requiresAdmin` 返回 `'/'`）——
 *    只要有一个能登录的普通账号就能跑，不依赖 MFA。
 * 2. **提权后可见真实面板与用户列表** —— 需要后端允许管理员登录：
 *    后端 `admin_auth.rs::enforce_admin_login_mfa_impl` 在 `security.admin_mfa_required=true` 时
 *    要求管理员登录带 6 位 TOTP（`mfa_code`），本机未配置 TOTP ⇒ 这一条 skip 并给出原因。
 *
 * 为什么不能用「旧 token + 改库」绕过：`authorize_admin_from_services` 判权限用的是
 * `auth_service.validate_token()` 返回的 `is_admin`，它随 token 签发/缓存，
 * 改库只影响**新签发**的 token。
 *
 * 环境变量（缺任一必需项时整例 skip）：
 * - `MATRIX_LIVE_E2E=1`、`MATRIX_LIVE_HOMESERVER_URL`、`MATRIX_LIVE_USERNAME` / `MATRIX_LIVE_PASSWORD`
 * - `MATRIX_LIVE_APP_URL` 必须是**桌面** dev server（默认 5210 是移动路由集，`/admin` 会落到 catch-all 404）
 * - 可选：`SYNAPSE_DB_CONTAINER`（默认 `synapse-postgres`）
 *
 * 运行：
 *   MATRIX_LIVE_E2E=1 MATRIX_LIVE_HOMESERVER_URL=http://127.0.0.1:8008 \
 *   MATRIX_LIVE_APP_URL=http://127.0.0.1:5211 \
 *   MATRIX_LIVE_USERNAME=... MATRIX_LIVE_PASSWORD=... \
 *   CI= npx playwright test e2e/admin-dashboard-live.spec.ts --project=desktop-chromium
 */
import { execFileSync } from 'node:child_process'
import { expect, type Page, test } from '@playwright/test'
import {
  bootstrapMatrixLivePage,
  getMatrixLiveSkipReason,
  loginToMatrixLive,
  readMatrixLiveEnv
} from './support/matrixLive'
import { createRuntimeIssueCollector, expectNoRuntimeIssues } from './support/runtimeIssues'

const matrixLiveEnv = readMatrixLiveEnv()
const DB_CONTAINER = process.env.SYNAPSE_DB_CONTAINER ?? 'synapse-postgres'
const ROUTER_MODULE_PATH = '/src/router/index.ts'
const CLIENT_MODULE_PATH = '/src/services/matrix/MatrixClientService.ts'
const ADMIN_STORE_PATH = '/src/stores/domains/admin/admin.ts'

/**
 * 按 username 改 `is_admin`。
 *
 * 为什么用 username 而不是 userId：登录本身会被 `admin_mfa_required` 拦（admin 登录要 TOTP），
 * 所以**必须在登录前**把账号降级 —— 那时还拿不到 userId，只能按 username 定位。
 */
const setAdminFlag = (username: string, value: boolean): void => {
  const escaped = username.replace(/'/g, "''")
  execFileSync(
    'docker',
    [
      'exec',
      DB_CONTAINER,
      'psql',
      '-U',
      'synapse',
      '-d',
      'synapse',
      '-tAc',
      `update users set is_admin = ${value ? 'true' : 'false'} where username = '${escaped}'`
    ],
    { encoding: 'utf8', timeout: 20_000 }
  )
}

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

test.describe('管理后台（真后端）', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', '管理后台只在桌面路由集装配')
    const skipReason = getMatrixLiveSkipReason(matrixLiveEnv)
    test.skip(Boolean(skipReason), skipReason ?? '')
    // 登录前先降级：admin 账号登录会被 `admin_mfa_required` 拦（需要 TOTP），
    // 上一次跑若在提权中途失败，残留的 true 会让本轮所有用例连登录都过不去。
    if (matrixLiveEnv.username) setAdminFlag(matrixLiveEnv.username, false)
    await bootstrapMatrixLivePage(page, matrixLiveEnv)
    await loginToMatrixLive(page, matrixLiveEnv)
  })

  test('普通账号进后台被重定向回首页', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)
    const userId = await readUserId(page)
    expect(userId, '登录后应拿到 userId').not.toBe('')

    const status = await readAdminStatus(page)
    expect(status.isAdmin, `非管理员身份判定应为 false（诊断：${JSON.stringify(status)}）`).toBe(false)

    await pushDesktopRoute(page, '/admin/dashboard')
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).not.toContain('/admin')
    await expect(page.locator('.admin-dashboard')).toHaveCount(0)

    expectNoRuntimeIssues(issues)
  })

  test('提权后可见后台面板与真实用户列表（需管理员可登录）', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)
    const username = matrixLiveEnv.username
    expect(username, '需要 MATRIX_LIVE_USERNAME 才能提权').not.toBe('')

    setAdminFlag(username, true)
    let restored = false
    const restore = () => {
      if (!restored) {
        setAdminFlag(username, false)
        restored = true
      }
    }

    try {
      // 提权只影响新签发的 token ⇒ 必须重新登录（`page.reload` 会掉内存里的 live token）
      await page.reload()
      try {
        await loginToMatrixLive(page, matrixLiveEnv)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (/MFA/i.test(message)) {
          restore()
          test.skip(
            true,
            `后端 admin_mfa_required=true：管理员登录要求 6 位 TOTP（mfa_code），本机未配置；` +
              `如需跑这条，请在部署配置里关闭该开关或提供 TOTP。原始报错：${message.slice(0, 120)}`
          )
        }
        throw error
      }

      const status = await readAdminStatus(page)
      expect(status.isAdmin, `提权 + 重登后身份判定应为 true（诊断：${JSON.stringify(status)}）`).toBe(true)

      await pushDesktopRoute(page, '/admin/dashboard')
      await expect(page.locator('.admin-dashboard')).toBeVisible({ timeout: 30_000 })
      await expect(page.locator('.admin-state-panel')).toHaveCount(0)

      // 用户列表读的是服务端真实数据（列表里应出现当前账号）
      await pushDesktopRoute(page, '/admin/users')
      await expect(page.locator('.admin-users')).toBeVisible({ timeout: 30_000 })
      await expect.poll(async () => page.locator('body').innerText(), { timeout: 30_000 }).toContain(userId)

      expectNoRuntimeIssues(issues)
    } finally {
      restore()
    }
  })
})
