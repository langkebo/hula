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
 * 为什么改库后还要清缓存：`authorize_admin_from_services` 判权限用的是
 * `auth_service.validate_token()` 返回的 `is_admin`，它不是 JWT claim，而是
 * `user:admin:{userId}` 缓存（`ADMIN_CACHE_TTL_SECS=60`）里的库内值。
 * 只改库会被旧缓存覆盖到 TTL 过期，必须同时 `DEL` 该键（Redis 不可用时退化为等 TTL）。
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
  readMatrixLiveEnv,
  settleLocalUnlockGate
} from './support/matrixLive'
import { createRuntimeIssueCollector, expectNoRuntimeIssues } from './support/runtimeIssues'

const matrixLiveEnv = readMatrixLiveEnv()
const DB_CONTAINER = process.env.SYNAPSE_DB_CONTAINER ?? 'synapse-postgres'
const REDIS_CONTAINER = process.env.SYNAPSE_REDIS_CONTAINER ?? 'synapse-redis'
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
  // `validate_token` 的 is_admin 走 `user:admin:{userId}` 缓存（ADMIN_CACHE_TTL_SECS=60），
  // 只改库会被旧值覆盖到 TTL 过期；不清理会稳定复现「库里已提权、管理 API 仍 403」。
  const serverName = process.env.MATRIX_LIVE_SERVER_NAME ?? 'matrix.test'
  try {
    execFileSync('docker', ['exec', REDIS_CONTAINER, 'redis-cli', 'DEL', `user:admin:@${username}:${serverName}`], {
      encoding: 'utf8',
      timeout: 20_000
    })
  } catch {
    // Redis 不可用时退化为等 TTL（最多 60s），不阻断用例
  }
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
    const userId = await readUserId(page)

    // 幂等提权：库内 is_admin=true + 清掉 `user:admin:` 缓存键。
    // 服务端仍可能持有进程内旧值（TTL 60s，命中不续期），所以下面用轮询等它自然过期，
    // 不硬 sleep——这条链路的唯一异步源就是这个缓存。
    setAdminFlag(username, true)

    // 提权只影响后续校验 ⇒ 重新登录（`page.reload` 会掉内存里的 live token）
    await page.reload()
    // reload 后 F-10 本地解锁门禁会再次阻断启动，必须先放行再登录
    await settleLocalUnlockGate(page, matrixLiveEnv)
    try {
      await loginToMatrixLive(page, matrixLiveEnv)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/MFA/i.test(message)) {
        test.skip(
          true,
          `后端 admin_mfa_required=true：管理员登录要求 6 位 TOTP（mfa_code），本机未配置；` +
            `如需跑这条，请在部署配置里关闭该开关或提供 TOTP。原始报错：${message.slice(0, 120)}`
        )
      }
      throw error
    }

    await expect
      .poll(async () => (await readAdminStatus(page)).isAdmin, {
        timeout: 100_000,
        intervals: [2_000],
        message: '等待服务端 user:admin 缓存过期后重新读库判定为 true'
      })
      .toBe(true)

    await pushDesktopRoute(page, '/admin/dashboard')
    await expect(page.locator('.admin-dashboard')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.admin-state-panel')).toHaveCount(0)

    // 用户列表读的是服务端真实数据（列表里应出现当前账号）
    await pushDesktopRoute(page, '/admin/users')
    await expect(page.locator('.admin-users')).toBeVisible({ timeout: 30_000 })
    await expect.poll(async () => page.locator('body').innerText(), { timeout: 30_000 }).toContain(userId)

    expectNoRuntimeIssues(issues)
  })
})
