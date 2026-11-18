/**
 * 路由集: desktop
 * 依据：键盘主流程断言的是桌面工作区（`/home` 会话列表 + 右键菜单）与桌面设置页
 * （`/settings` 侧栏 tablist）。移动 dev server（5210）只有 `/mobile/*`，没有这些 DOM。
 * 校验：`tests/lint/e2e-route-sets.test.ts`（与 `e2e/specRouteSets.ts` 名单逐条比对）。
 *
 * 覆盖范围（§13.11「键盘可完成全部主流程」的离线可验证子集）：
 * 1. Tab 焦点链：连续 Tab 依次落到不同控件，不丢失焦点；
 * 2. Enter 激活：会话项（`tabindex=0`）回车后选中并进入消息路由；
 * 3. Escape 关闭浮层：右键菜单打开后容器拿到焦点、方向键定位、Escape 关闭并把焦点还给触发元素；
 * 4. 设置页 tablist：roving tabindex + 方向键切换并同步 `aria-selected`。
 *
 * 边界：mock 会话 + 桌面 Chromium，**不覆盖**真机（iOS/Android 软键盘与焦点链）
 * 与真实 homeserver 下的键盘路径。
 */
import { expect, type Page, test } from '@playwright/test'
import { createRuntimeIssueCollector, expectNoRuntimeIssues } from './support/runtimeIssues'
import { bootstrapDesktopHarness, E2E_MOCK_ROOM_ID, markCapabilitiesLoaded, seedMockRoom } from './support/session'

const SESSION_ITEM = `[data-test="session-item-${E2E_MOCK_ROOM_ID}"]`
const CONTEXT_MENU = '.context-menu[role="menu"]'
// 冷启动遮罩会拦截指针事件，等它自行卸载后再做右键/聚焦。
const BOOT_OVERLAY = '#layout > div.absolute.inset-0.z-10'

const waitForWorkspace = async (page: Page): Promise<void> => {
  await page.goto('/home')
  await page.waitForSelector('#app', { state: 'visible' })
  await page.locator(BOOT_OVERLAY).waitFor({ state: 'detached', timeout: 20_000 })
}

/**
 * 给当前 focused 元素打一次性标记并返回编号。
 * 用编号而非 tagName 比对，避免「多个无 id 的按钮」被误判成同一元素而漏掉焦点陷阱。
 */
const focusDescriptor = async (page: Page): Promise<string> =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null
    if (!element) return 'null'
    if (element === document.body) return 'body'
    if (!element.dataset.e2eFocusId) {
      const store = window as Window & { __e2eFocusSeq?: number }
      store.__e2eFocusSeq = (store.__e2eFocusSeq ?? 0) + 1
      element.dataset.e2eFocusId = String(store.__e2eFocusSeq)
    }
    return element.dataset.e2eFocusId
  })

test.describe('Desktop keyboard flows', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', '键盘主流程仅在桌面项目下运行')
    await bootstrapDesktopHarness(page)
  })

  test('Tab moves focus through workspace controls without losing it', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)
    await waitForWorkspace(page)
    await expect(page.getByRole('button', { name: /房间列表|Rooms/i }).first()).toBeVisible({ timeout: 15_000 })

    const visited: string[] = []
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press('Tab')
      visited.push(await focusDescriptor(page))
    }

    expect(visited, '按 Tab 后 activeElement 不应丢失').not.toContain('null')
    const controls = visited.filter((id) => id !== 'body' && id !== 'null')
    expect(new Set(controls).size, '连续 Tab 应依次落到不同的可聚焦控件').toBeGreaterThanOrEqual(5)

    expectNoRuntimeIssues(issues)
  })

  test('Enter activates the focused session and opens the message route', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)
    await waitForWorkspace(page)
    await seedMockRoom(page)

    const item = page.locator(SESSION_ITEM)
    await expect(item, 'mock 会话应出现在会话列表').toBeVisible({ timeout: 15_000 })
    await item.focus()
    await expect(item).toBeFocused()

    await page.keyboard.press('Enter')

    await expect(item, 'Enter 应把会话置为当前会话').toHaveAttribute('aria-current', 'true', { timeout: 10_000 })
    expect(
      /^\/message(?:\/|$)/.test(new URL(page.url()).pathname),
      `Enter 后应进入消息路由，实际跳转到 ${page.url()}`
    ).toBe(true)

    expectNoRuntimeIssues(issues)
  })

  test('Right-click menu takes keyboard focus, supports arrows, and closes on Escape', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)
    await waitForWorkspace(page)
    await seedMockRoom(page)

    const item = page.locator(SESSION_ITEM)
    await expect(item, 'mock 会话应出现在会话列表').toBeVisible({ timeout: 15_000 })
    await item.click({ button: 'right' })

    const menu = page.locator(CONTEXT_MENU)
    await expect(menu, '右键会话项应打开 role=menu 的浮层').toBeVisible({ timeout: 10_000 })
    await expect(menu, '浮层打开后焦点应进入菜单容器，否则键盘无法操作').toBeFocused({ timeout: 5_000 })

    await page.keyboard.press('ArrowDown')
    await expect(menu, 'ArrowDown 应把某个菜单项标记为当前项').toHaveAttribute(
      'aria-activedescendant',
      /menu-item-\d+/,
      { timeout: 5_000 }
    )

    await page.keyboard.press('Escape')
    await expect(menu, 'Escape 应关闭右键菜单').toHaveCount(0, { timeout: 5_000 })
    await expect(item, 'Escape 关闭后焦点应回到触发元素（WCAG 2.4.3）').toBeFocused({ timeout: 5_000 })

    expectNoRuntimeIssues(issues)
  })

  test('Settings tablist supports roving keyboard navigation', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)
    await page.goto('/settings?tab=preferences')
    await page.waitForLoadState('networkidle')
    // mock 会话没有 matrix client ⇒ 能力探测不触发，设置页会停在骨架屏。
    await markCapabilitiesLoaded(page)

    const preferencesTab = page.locator('#settings-tab-preferences')
    await expect(preferencesTab).toBeVisible({ timeout: 15_000 })
    await expect(preferencesTab).toHaveAttribute('aria-selected', 'true')
    await preferencesTab.focus()
    await expect(preferencesTab).toBeFocused()

    await page.keyboard.press('ArrowDown')

    const focusedId = await page.evaluate(() => document.activeElement?.id ?? '')
    expect(focusedId, 'ArrowDown 应把焦点移出当前页签').not.toBe('settings-tab-preferences')
    expect(focusedId.startsWith('settings-tab-'), `焦点应停留在设置页签上，实际 ${focusedId}`).toBe(true)
    await expect(page.locator(`#${focusedId}`), '焦点所在页签应同步为选中态').toHaveAttribute('aria-selected', 'true')

    expectNoRuntimeIssues(issues)
  })
})
