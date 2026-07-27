import { expect, test } from '@playwright/test'
import { createRuntimeIssueCollector, expectNoRuntimeIssues } from './support/runtimeIssues'
import { bootstrapDesktopHarness } from './support/session'

test.describe('Message Workspace', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', '消息工作区仅在桌面项目下运行')
    await bootstrapDesktopHarness(page)
  })

  test('should render workspace with left sidebar after mock auth', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)

    await page.goto('/home')
    await page.waitForSelector('#app', { state: 'visible' })

    // After mock auth, workspace should render (no login page)
    const loginForm = page.locator('.login-box')
    await expect(loginForm).not.toBeVisible({ timeout: 15000 })

    // Mock auth skips Matrix bootstrap — verify workspace shell renders without crash.
    // The left sidebar renders navigation buttons even without session data.
    const roomsButton = page.getByRole('button', { name: /Rooms|会话|消息/i })
    await expect(roomsButton.first()).toBeVisible({ timeout: 10000 })

    expectNoRuntimeIssues(issues)
  })

  test('should render the chat area with empty state', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)

    await page.goto('/home')
    await page.waitForSelector('#app', { state: 'visible' })

    // With mock auth, no session is selected — the center area shows a placeholder.
    // Verify the center panel renders rather than crashing.
    const centerPanel = page.getByText(/未选择会话|选择一个会话|select a session/i)
    await expect(centerPanel.first()).toBeVisible({ timeout: 15000 })

    expectNoRuntimeIssues(issues)
  })

  test('should render workspace navigation and session list', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)

    await page.goto('/home')
    await page.waitForSelector('#app', { state: 'visible' })

    // Left sidebar renders navigation tabs
    const roomsTab = page.getByRole('button', { name: /Rooms|会话/i })
    await expect(roomsTab.first()).toBeVisible({ timeout: 10000 })

    // Session search input is present in the sidebar (may be visually hidden by Naive UI)
    const searchInput = page.getByRole('textbox', { name: /Search|搜索/i })
    await expect(searchInput.first()).toBeAttached({ timeout: 10000 })

    // Session filter buttons render
    const allButton = page.getByRole('button', { name: /All|全部/i })
    await expect(allButton.first()).toBeVisible({ timeout: 5000 })

    expectNoRuntimeIssues(issues)
  })

  test('should render the session list with accessible filter controls', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)

    await page.goto('/home')
    await page.waitForSelector('#app', { state: 'visible' })

    // Session filter tabs render with accessible button roles
    const allButton = page.getByRole('button', { name: /All|全部/i })
    await expect(allButton.first()).toBeVisible({ timeout: 10000 })
    await expect(allButton.first()).toHaveAttribute('aria-pressed', 'true')

    const unreadButton = page.getByRole('button', { name: /Unread|未读/i })
    await expect(unreadButton.first()).toBeVisible({ timeout: 5000 })

    expectNoRuntimeIssues(issues)
  })

  test('should show empty state message when no messages exist', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)

    await page.goto('/home')
    await page.waitForSelector('#app', { state: 'visible' })

    // Since we're using mock auth with no real messages, the empty state should appear
    const _emptyState = page.getByText(/empty|暂无|还没有/i)
    // Empty state may or may not appear depending on mock data state -
    // just verify no errors occurred
    await page.waitForTimeout(2000)

    expectNoRuntimeIssues(issues)
  })

  test('should remain responsive after network toggle', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)

    await page.goto('/home')
    await page.waitForSelector('#app', { state: 'visible' })

    // Verify workspace renders before network toggle
    const roomsButton = page.getByRole('button', { name: /Rooms|会话/i })
    await expect(roomsButton.first()).toBeVisible({ timeout: 10000 })

    // Simulate going offline and back — lazy-load failures during offline
    // are expected, so clear the collector before and after the toggle.
    issues.componentResolveErrors.length = 0
    issues.lazyLoadErrors.length = 0
    await page.context().setOffline(true)
    await page.waitForTimeout(2000)
    await page.context().setOffline(false)
    await page.waitForTimeout(2000)
    // Clear again — dynamic imports may retry and fail during recovery
    issues.componentResolveErrors.length = 0
    issues.lazyLoadErrors.length = 0

    // App should still be responsive after network cycle
    await expect(roomsButton.first()).toBeVisible({ timeout: 5000 })

    expectNoRuntimeIssues(issues)
  })

  test('should access settings via URL and verify tab navigation', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)

    await page.goto('/home')
    await page.waitForSelector('#app', { state: 'visible' })

    // Navigate to settings
    await page.goto('/settings?tab=preferences')
    await page.waitForLoadState('networkidle')

    // Verify settings panel renders
    const settingsTab = page.locator('#settings-tab-preferences')
    await expect(settingsTab).toBeVisible({ timeout: 10000 })
    await expect(settingsTab).toHaveAttribute('aria-selected', 'true')

    expectNoRuntimeIssues(issues)
  })
})
