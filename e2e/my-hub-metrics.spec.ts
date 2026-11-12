import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { loginOnMobileUi } from './support/androidDevice'
import { autoDismissLocalUnlockGate, dismissLocalUnlockDialog } from './support/localUnlockGate'
import { MOBILE_APP_URL, pushMobileRoute, registerMobileAccount, seedE2EStorage } from './support/mobileHub'
import {
  countDomNodes,
  FIRST_SCREEN_RENDER_BUDGET_MS,
  SESSION_RESTORE_BUDGET_MS,
  scanOneHand,
  scanTouchTargets
} from './support/mobileMetrics'

/**
 * 「我的」页体验门禁（方案 §十 的指标落地，G5 + G6）。
 *
 * 判据与采集口径见 `e2e/support/mobileMetrics.ts` —— 与无后端的
 * `mobile-touch-targets.spec.ts` 共用同一份扫描逻辑，避免两处口径漂移后
 * 门禁变成自欺欺人。
 *
 * - **G5 触控合规**：`min(width, height) >= 44`，两个页面都不允许有不合格项
 * - **G6 会话恢复**：reload → `MatrixClient` 建成 ≤ 1500ms
 * - **G6 首屏渲染**：会话恢复完成 → `「我的」九宫格可见` ≤ 800ms（TTI 由此二者相加得出）
 *
 * 拿不到（`null`）一律判红：没测到不等于达标。
 *
 * 需要可用 homeserver（会注册临时账号）：`TJG_METRICS=1` 开启（`pnpm test:metrics`）。
 */

const SKIP_REASON = process.env.TJG_METRICS ? null : '未设置 TJG_METRICS（需可用 homeserver，会注册临时账号）'
const OUTPUT_PATH = 'test-results/mobile-metrics.json'

test.describe('「我的」页体验门禁', () => {
  test.setTimeout(240_000)
  test.skip(Boolean(SKIP_REASON), SKIP_REASON ?? '')

  test('采集触控热区、单手可达、首屏 TTI 与 DOM 规模', async ({ page }) => {
    const self = await registerMobileAccount('mymetrics')
    await seedE2EStorage(page)
    await autoDismissLocalUnlockGate(page)
    await loginOnMobileUi(page, { appUrl: MOBILE_APP_URL, account: self.username, password: self.password })
    await dismissLocalUnlockDialog(page, 10_000)
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 45_000 }).not.toContain('/mobile/login')
    await page.waitForTimeout(1500)

    const viewport = page.viewportSize()

    // ── 冷启 TTI：拆成两段，避免把两件事混成一个数。
    //
    // ⚠️ 旧实现是「reload 后等 `.m-quick-actions` 可见」，而 reload 的落点是**消息页**
    // （路由不持久化），该元素根本不在首屏 ⇒ 必然等满超时记 null。它一直是 n/a
    // 不是会话慢，是判据写错了。
    const ttiStart = Date.now()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await dismissLocalUnlockDialog(page, 15_000)

    // 第 1 段：冷启动后「会话恢复完成」（client 建起来）——D12 的判据
    let sessionRestoreMs: number | null = null
    try {
      await expect
        .poll(
          () =>
            page.evaluate(async () => {
              const { matrixClientService } = (await import(/* @vite-ignore */ '/src/services/matrix/index.ts')) as {
                matrixClientService: { getClient: () => unknown | null }
              }
              return Boolean(matrixClientService.getClient())
            }),
          { timeout: 60_000 }
        )
        .toBe(true)
      sessionRestoreMs = Date.now() - ttiStart
    } catch {
      sessionRestoreMs = null
    }

    // 第 2 段：从「会话恢复完成」到「我的页九宫格可见」——纯首屏渲染 + 一次 SPA 导航。
    // 目标 ≤800ms（P75，中端安卓）。会话恢复与首屏渲染分别设预算，
    // 避免把「同步慢」和「渲染慢」混成一个 TTI 数字后无法定位。
    let firstScreenRenderMs: number | null = null
    let ttiMs: number | null = null
    if (sessionRestoreMs !== null) {
      const renderStart = Date.now()
      try {
        await pushMobileRoute(page, { name: 'mobileMy' })
        await page.locator('.m-quick-actions').first().waitFor({ state: 'visible', timeout: 30_000 })
        firstScreenRenderMs = Date.now() - renderStart
        ttiMs = Date.now() - ttiStart
      } catch {
        firstScreenRenderMs = null // 会话/接口抖动时如实记 null，不编数字
      }
    }

    // ── SPA 导航耗时：消息页 → 我的页，到九宫格可见。
    // 冷启 TTI 常因会话读取抖动拿不到（见 ttiMs 为 null 的情况），这个数字是稳定可回归的替代口径。
    await pushMobileRoute(page, { name: 'mobileMessage' })
    await page.waitForTimeout(600)
    const spaStart = Date.now()
    await page.evaluate(async () => {
      const router = (
        document.querySelector('#app') as
          | (HTMLElement & {
              __vue_app__?: { config: { globalProperties: { $router?: { push: (t: unknown) => Promise<unknown> } } } }
            })
          | null
      )?.__vue_app__?.config?.globalProperties?.$router
      await router?.push({ name: 'mobileMy' })
    })
    await expect(page.locator('.m-quick-actions').first()).toBeVisible({ timeout: 20_000 })
    const spaNavMs = Date.now() - spaStart

    const myHub = {
      // 两项分别与预算比较；null（拿不到）一律记 false，避免「没测到」被当成达标
      sessionRestoreMs,
      sessionRestorePass: sessionRestoreMs !== null && sessionRestoreMs <= SESSION_RESTORE_BUDGET_MS,
      firstScreenRenderMs,
      firstScreenRenderPass: firstScreenRenderMs !== null && firstScreenRenderMs <= FIRST_SCREEN_RENDER_BUDGET_MS,
      ttiMs,
      spaNavMs,
      domNodes: await countDomNodes(page),
      touchTargets: await scanTouchTargets(page),
      oneHand: await scanOneHand(page)
    }

    // ── 设置页：搜索框 + 20 个二级页入口，是触控问题最集中的地方（单选组行高小）
    await pushMobileRoute(page, '/mobile/mobileMy/settings')
    await expect(page.locator('.van-search input').first()).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(600)

    const settings = {
      domNodes: await countDomNodes(page),
      touchTargets: await scanTouchTargets(page),
      oneHand: await scanOneHand(page)
    }

    const report = {
      collectedAt: new Date().toISOString(),
      appUrl: MOBILE_APP_URL,
      viewport,
      myHub,
      settings
    }

    mkdirSync('test-results', { recursive: true })
    writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

    // 摘要打到 stdout，便于 CI 日志直接看
    console.log('[metrics]', JSON.stringify(report, null, 2))
    console.log(
      `[metrics] 会话恢复=${sessionRestoreMs ?? 'n/a'}ms（目标≤${SESSION_RESTORE_BUDGET_MS}，${myHub.sessionRestorePass ? 'PASS' : 'FAIL'}）` +
        ` · 首屏渲染=${firstScreenRenderMs ?? 'n/a'}ms（目标≤${FIRST_SCREEN_RENDER_BUDGET_MS}，${myHub.firstScreenRenderPass ? 'PASS' : 'FAIL'}）` +
        ` · TTI=${ttiMs ?? 'n/a'}ms` +
        ` · SPA 导航=${spaNavMs}ms · 触控合规 ${myHub.touchTargets.compliant}/${myHub.touchTargets.total}` +
        ` · 单手可达 ${myHub.oneHand.reachable}/${myHub.oneHand.total}` +
        ` · 设置页触控合规 ${settings.touchTargets.compliant}/${settings.touchTargets.total}` +
        ` · 写入 ${OUTPUT_PATH}`
    )

    // ── 门禁断言：以下任何一条不满足即红（不再是「只记录」）。
    //
    // 先断言「扫到了东西」：选择器失效/页面没渲染时 total 为 0，此时
    // offenders 也是空数组 —— 若只看 offenders 就会把「没测到」判成满分。
    expect(myHub.touchTargets.total, '首屏没扫到任何可点元素（选择器失效？）').toBeGreaterThan(3)
    expect(settings.touchTargets.total, '设置页没扫到任何可点元素（选择器失效？）').toBeGreaterThan(10)

    // G5：目标 0 个 <44px 的触控目标（不含「有效热区」为负 inset 扩大的元素）
    expect(myHub.touchTargets.offenders, '「我的」页存在 <44px 触控目标').toEqual([])
    expect(settings.touchTargets.offenders, '设置页存在 <44px 触控目标').toEqual([])

    // G6：两段预算都必须拿到数并达标；null 由 pass 布尔值统一判红
    expect(
      myHub.sessionRestorePass,
      `会话恢复超预算（实测 ${sessionRestoreMs ?? 'n/a'}ms，目标 ≤${SESSION_RESTORE_BUDGET_MS}ms）`
    ).toBe(true)
    expect(
      myHub.firstScreenRenderPass,
      `首屏渲染超预算（实测 ${firstScreenRenderMs ?? 'n/a'}ms，目标 ≤${FIRST_SCREEN_RENDER_BUDGET_MS}ms）`
    ).toBe(true)
  })
})
