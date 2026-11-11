/**
 * §20.3 KPI #2 scenario #30 — Capability missing → fallback UI.
 *
 * 覆盖设置页能力降级链路（`useSettingsShell.matchesCapability`）：
 *   - 能力表为空（服务端不声明 voip / friend-list / admin-api / burn-after-read）
 *     ⇒ 依赖这些能力的页签从导航中消失，而不是渲染成可点但报错的假入口。
 *   - `encryption` 页签声明了 `capabilityFallback: 'readonly'`，能力缺失时保留，
 *     内容降级为只读并挂出 `[data-testid="e2ee-unsupported"]` 提示。
 *   - 能力恢复（`m.voice: { enabled: true }`）后 voiceVideo 页签重新出现。
 *
 * 能力探测在 mock 会话下不会发生（没有 matrix client），
 * 因此用 `markCapabilitiesLoaded` 直接写入 capability store，见 support/session.ts。
 */
import { expect, test } from '@playwright/test'
import { bootstrapDesktopHarness, markCapabilitiesLoaded } from './support/session'

const PREFERENCES_PATH = '/settings?tab=preferences'

test.describe('§20.3 #30 Capability missing → fallback UI', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', '能力降级链路仅在桌面项目下运行')
    await bootstrapDesktopHarness(page)
  })

  test('hides capability-gated tabs and keeps encryption as read-only fallback', async ({ page }) => {
    await page.goto(PREFERENCES_PATH)
    await page.waitForLoadState('networkidle')
    // E2EE 的可用性语义是「未显式关闭即视为可用」（见 MatrixCapabilityService.canUseE2EE），
    // 因此只有服务端声明 `m.room.encryption: { enabled: false }` 才触发只读降级。
    await markCapabilitiesLoaded(page, { capabilities: { 'm.room.encryption': { enabled: false } } })

    // 无能力依赖的页签正常渲染，侧栏不再停留在骨架屏
    await expect(page.locator('#settings-tab-preferences')).toBeVisible()
    await expect(page.locator('[data-testid="settings-sidebar-skeleton"]')).toHaveCount(0)

    // 依赖 voip / friend-list / admin-api / burn-after-read 的页签全部隐藏
    await expect(page.locator('#settings-tab-voiceVideo')).toHaveCount(0)
    await expect(page.locator('#settings-tab-friends')).toHaveCount(0)
    await expect(page.locator('#settings-tab-mjolnir')).toHaveCount(0)
    await expect(page.locator('#settings-tab-burnAfterRead')).toHaveCount(0)

    // encryption 声明 capabilityFallback='readonly'：页签保留，内容只读兜底
    await expect(page.locator('#settings-tab-encryption')).toBeVisible()
    await page.locator('#settings-tab-encryption').click()
    await expect(page).toHaveURL(/tab=encryption/)
    await expect(page.locator('[data-testid="e2ee-unsupported"]')).toBeVisible()
  })

  test('restores capability-gated tab once the server declares m.voice', async ({ page }) => {
    await page.goto(PREFERENCES_PATH)
    await page.waitForLoadState('networkidle')
    await markCapabilitiesLoaded(page, { capabilities: { 'm.voice': { enabled: true } } })

    await expect(page.locator('#settings-tab-voiceVideo')).toBeVisible()
    // 未被声明为可用的能力仍然按缺失处理
    await expect(page.locator('#settings-tab-friends')).toHaveCount(0)

    await page.locator('#settings-tab-voiceVideo').click()
    await expect(page).toHaveURL(/tab=voiceVideo/)
    await expect(page.locator('#settings-tab-voiceVideo')).toHaveAttribute('aria-selected', 'true')
  })
})
