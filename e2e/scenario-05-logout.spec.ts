/**
 * 路由集: desktop
 * 依据：只断言桌面路由 DOM（`.login-box` / `/settings` / `/message` …）；移动 dev server（5210）没有这些路由。
 * 校验：`tests/lint/e2e-route-sets.test.ts`（与 `e2e/specRouteSets.ts` 名单逐条比对）。
 */
/**
 * §20.3 KPI #2 scenario #5 — Logout cleans tokens + caches.
 *
 * 为什么不用「原生 desktop-Tauri project」：
 * Playwright 只能驱动 Chromium / WebKit / Firefox，无法 attach 到 Tauri 原生 WebView
 * （Linux 是 WebKitGTK、macOS 是 WKWebView，都没有 CDP；tauri-driver 走 WebDriver 且
 * 在 macOS 上不可用，CI 又是 ubuntu）。因此这里采用本 spec 早先登记的备选方案：
 * 在 `desktop-chromium` 项目（5211 ⇒ 桌面路由集）里，用页面态 Tauri mock 驱动**真实的**
 * `sessionOrchestrator.logoutCurrentSession()`，断言的仍是产品代码路径，而非另写一份 stub。
 *
 * 覆盖点：
 *   1. 登出后 `localStorage` 不再持有 `user` / `TOKEN` / `REFRESH_TOKEN` / `sessionUnread`；
 *   2. 会话快照（userId / deviceId / homeserverUrl）被清空；
 *   3. 移除 mock-auth 旁路后，路由守卫把用户送回 `/login`。
 */
import { expect, test } from '@playwright/test'
import { bootstrapDesktopHarness, clearMockSession } from './support/session'

const SESSION_KEYS = ['user', 'TOKEN', 'REFRESH_TOKEN', 'sessionUnread'] as const

test.describe('§20.3 #5 Logout cleans tokens + caches', () => {
  test('logout clears session keys and redirects to /login', async ({ page, context }) => {
    await bootstrapDesktopHarness(page)

    // 播种「已登录」现场：mock 会话本身不带凭证，需显式写入真实登出要清理的键。
    await page.addInitScript(() => {
      window.localStorage.setItem('user', JSON.stringify({ uid: '@stub:matrix.test' }))
      window.localStorage.setItem('TOKEN', 'stub-access-token')
      window.localStorage.setItem('REFRESH_TOKEN', 'stub-refresh-token')
      window.localStorage.setItem('sessionUnread', JSON.stringify({ '@stub:matrix.test': 3 }))
    })

    // `resetLocalSessionState` 会走 `remove_tokens`（Rust 侧安全存储）。浏览器里没有
    // 原生 IPC，`invokeWithErrorHandler` 在 `__TAURI_INTERNALS__.invoke` 缺失时会直接抛错、
    // 中断登出流程。这里只把登出真正会碰到的那几条命令打桩成 resolve，
    // 其余命令保持「reject」语义，避免应用误以为拿到了真实数据。
    await page.addInitScript(() => {
      const internals = ((
        window as unknown as { __TAURI_INTERNALS__?: Record<string, unknown> }
      ).__TAURI_INTERNALS__ ??= {}) as { invoke?: (cmd: string) => Promise<unknown> }
      internals.invoke = async (cmd: string) => {
        if (cmd === 'remove_tokens' || cmd === 'plugin:event|emit') return null
        if (cmd === 'plugin:webview|get_all_webviews') return []
        if (cmd === 'plugin:window|primary_monitor') {
          return { name: 'e2e', size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 }, scaleFactor: 1 }
        }
        throw new Error(`[e2e] unhandled tauri command: ${cmd}`)
      }
    })

    await page.goto('/message')
    await page.waitForFunction(
      () => (window as Window & { __TJG_PINIA_READY__?: boolean }).__TJG_PINIA_READY__ === true,
      undefined,
      { timeout: 20_000 }
    )

    // 驱动真实登出路径（页面内动态 import 命中的就是应用正在使用的单例）。
    const result = await page.evaluate(async () => {
      const orchestratorPath = '/src/services/matrix/auth/SessionOrchestrator.ts'
      const sessionStatePath = '/src/services/matrix/matrixSessionState.ts'
      const { sessionOrchestrator } = (await import(/* @vite-ignore */ orchestratorPath)) as {
        sessionOrchestrator: { logoutCurrentSession: () => Promise<void> }
      }
      const { getMatrixSessionSnapshot } = (await import(/* @vite-ignore */ sessionStatePath)) as {
        getMatrixSessionSnapshot: () => { userId: string | null; deviceId: string | null; homeserverUrl: string | null }
      }

      let error: string | null = null
      try {
        await sessionOrchestrator.logoutCurrentSession()
      } catch (err) {
        error = err instanceof Error ? err.message : String(err)
      }

      const keys = ['user', 'TOKEN', 'REFRESH_TOKEN', 'sessionUnread'] as const
      const storage = Object.fromEntries(keys.map((key) => [key, window.localStorage.getItem(key)]))

      return { error, storage, snapshot: getMatrixSessionSnapshot() }
    })

    expect(result.error, `登出链路不应抛错：${result.error}`).toBeNull()
    for (const key of SESSION_KEYS) {
      expect(result.storage[key], `${key} 应被登出清理`).toBeNull()
    }
    expect(result.snapshot.userId, '会话快照 userId 应被清空').toBeNull()
    expect(result.snapshot.deviceId, '会话快照 deviceId 应被清空').toBeNull()
    expect(result.snapshot.homeserverUrl, '会话快照 homeserverUrl 应被清空').toBeNull()

    // 移除 mock-auth 旁路后，用一个不带 Tauri mock 的新页签重新加载 ⇒ 走真实鉴权守卫。
    const guardedPage = await context.newPage()
    await clearMockSession(guardedPage)
    await guardedPage.goto('/')

    await expect(guardedPage).toHaveURL(/\/login(?:\?.*)?$/)
    await guardedPage.close()
  })
})
