/**
 * 路由集: mobile
 * 依据：只断言移动路由页面（`/mobile/*`）；桌面 dev server（5211）没有这些路由。
 * 校验：`tests/lint/e2e-route-sets.test.ts`（与 `e2e/specRouteSets.ts` 名单逐条比对）。
 */
import { expect, test } from '@playwright/test'
import { MIN_TOUCH_TARGET_PX, scanTouchTargets } from './support/mobileMetrics'
import { bootstrapMobileHarness } from './support/session'

/**
 * G5 触控目标合规门禁（无需后端，PR 必跑）。
 *
 * 与 `my-hub-metrics.spec.ts` 的分工：
 * - 本文件只测 DOM 形态（触控热区），mock 会话即可渲染「我的」页与设置页 ⇒ 可以当强门禁；
 * - 会话恢复 / 首屏渲染（G6）必须有真实 homeserver，放在 live 采集里跑。
 *
 * 判据：`min(width, height) >= 44`（含 `::after/::before` 负 inset 扩大的有效热区），
 * 且不允许「一个都没扫到」—— 选择器失效时 offenders 也是空数组，只看 offenders 会假绿。
 */
const skipUnlessMobileProject = () =>
  test.skip(!test.info().project.name.startsWith('mobile-'), '移动端触控门禁仅在移动项目下运行')

test.describe('移动端触控目标合规（G5）', () => {
  test('「我的」页不存在 <44px 触控目标', async ({ page }) => {
    skipUnlessMobileProject()

    await bootstrapMobileHarness(page)
    await page.goto('/mobile/my')
    await expect(page.locator('.m-quick-actions').first()).toBeVisible({ timeout: 20_000 })

    const report = await scanTouchTargets(page)
    expect(report.total, '「我的」页没扫到任何可点元素（选择器失效？）').toBeGreaterThan(3)
    expect(
      report.offenders,
      `「我的」页存在 ${report.total - report.compliant} 个 <${MIN_TOUCH_TARGET_PX}px 触控目标`
    ).toEqual([])
  })

  test('设置页不存在 <44px 触控目标', async ({ page }) => {
    skipUnlessMobileProject()

    await bootstrapMobileHarness(page)
    await page.goto('/mobile/mobileMy/settings')
    await expect(page.locator('.van-search input').first()).toBeVisible({ timeout: 20_000 })

    const report = await scanTouchTargets(page)
    expect(report.total, '设置页没扫到任何可点元素（选择器失效？）').toBeGreaterThan(10)
    expect(
      report.offenders,
      `设置页存在 ${report.total - report.compliant} 个 <${MIN_TOUCH_TARGET_PX}px 触控目标`
    ).toEqual([])
  })
})
