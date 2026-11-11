/**
 * §20.3 KPI #2 scenario #23 — Settings save + persist across relaunch.
 *
 * 「重启」用 `context.storageState()` 模拟：pinia-plugin-persistedstate 把设置写入
 * localStorage，因此把第一个 context 的存储快照注入一个全新的 context，等价于
 * 关闭应用后重新启动（进程内状态全部丢弃，只剩持久化数据）。
 *
 * 选主题作为被测设置：它是唯一同时具备 UI 控件（`[data-test="theme-option"]`）、
 * 持久化状态（setting store `persist: true`）和可观测副作用（`html[data-theme]`）
 * 的设置项，任一环断裂都会让断言失败。
 */
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import { bootstrapDesktopHarness, markCapabilitiesLoaded } from './support/session'

const APPEARANCE_PATH = '/settings?tab=appearance'
const DARK_OPTION = '[data-test="theme-option"][data-value="dark"]'

const openAppearanceSettings = async (page: Page): Promise<void> => {
  await page.goto(APPEARANCE_PATH)
  await page.waitForLoadState('networkidle')
  await markCapabilitiesLoaded(page)
  await expect(page.locator(DARK_OPTION)).toBeVisible()
}

const openFreshContext = async (context: BrowserContext): Promise<Page> => {
  const page = await context.newPage()
  await bootstrapDesktopHarness(page)
  return page
}

test.describe('§20.3 #23 Settings save + persist across relaunch', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', '仅在桌面 chromium 项目下运行')

  test('persists modified theme across relaunch', async ({ browser }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', '设置持久化仅在桌面项目下运行')

    // 第一次启动：切到深色主题
    const firstContext = await browser.newContext()
    const firstPage = await openFreshContext(firstContext)
    await openAppearanceSettings(firstPage)

    await expect(firstPage.locator(DARK_OPTION)).toHaveAttribute('aria-pressed', 'false')
    await firstPage.locator(DARK_OPTION).click()
    await expect(firstPage.locator(DARK_OPTION)).toHaveAttribute('aria-pressed', 'true')
    await expect(firstPage.locator('html')).toHaveAttribute('data-theme', 'dark')

    // 保存持久化快照后关闭「应用」
    const storageState = await firstContext.storageState()
    expect(storageState.origins.length).toBeGreaterThan(0)
    await firstContext.close()

    // 第二次启动：注入上一轮存储快照，主题应被恢复
    const secondContext = await browser.newContext({ storageState })
    const secondPage = await openFreshContext(secondContext)
    await openAppearanceSettings(secondPage)

    await expect(secondPage.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(secondPage.locator(DARK_OPTION)).toHaveAttribute('aria-pressed', 'true')

    await secondContext.close()
  })
})
