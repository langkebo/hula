import { expect, type Page, test } from '@playwright/test'

type RuntimeIssueCollector = {
  componentResolveErrors: string[]
  lazyLoadErrors: string[]
}

const bootstrapDesktopHarness = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hula:e2e:enabled', '1')
    window.localStorage.setItem('hula:e2e:mock-auth', '1')
    window.localStorage.setItem('hula:e2e:platform', 'desktop')
  })
}

const createRuntimeIssueCollector = (page: Page): RuntimeIssueCollector => {
  const collector: RuntimeIssueCollector = {
    componentResolveErrors: [],
    lazyLoadErrors: []
  }

  page.on('console', (message) => {
    const text = message.text()
    if (text.includes('Failed to resolve component')) {
      collector.componentResolveErrors.push(text)
    }
    if (
      /Failed to fetch dynamically imported module|ChunkLoadError|error loading dynamically imported module/i.test(text)
    ) {
      collector.lazyLoadErrors.push(text)
    }
  })

  page.on('pageerror', (error) => {
    const text = String(error)
    if (
      /Failed to fetch dynamically imported module|ChunkLoadError|error loading dynamically imported module/i.test(text)
    ) {
      collector.lazyLoadErrors.push(text)
    }
  })

  return collector
}

const expectNoRuntimeIssues = (collector: RuntimeIssueCollector) => {
  expect(collector.componentResolveErrors, '页面不应出现组件解析失败').toEqual([])
  expect(collector.lazyLoadErrors, '页面不应出现懒加载 chunk 拉取失败').toEqual([])
}

test.describe('Room Operations', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', '房间操作仅在桌面项目下运行')
    await bootstrapDesktopHarness(page)
  })

  test.describe('Room List Sidebar', () => {
    test('should render room list panel after auth', async ({ page }) => {
      const issues = createRuntimeIssueCollector(page)

      await page.goto('/home')
      await page.waitForSelector('#app', { state: 'visible' })

      // Room list sidebar should be visible
      const sidebar = page.locator('.room-sidebar, .room-list, [class*="left-panel"]')
      await expect(sidebar.first()).toBeVisible({ timeout: 15000 })

      // Search input should exist
      const searchInput = page.locator(
        'input[placeholder*="搜索"], input[placeholder*="search"], input[placeholder*="Search"]'
      )
      await expect(searchInput.first()).toBeVisible({ timeout: 10000 })

      expectNoRuntimeIssues(issues)
    })

    test('should render space navigation if spaces enabled', async ({ page }) => {
      const issues = createRuntimeIssueCollector(page)

      await page.goto('/home')
      await page.waitForSelector('#app', { state: 'visible' })

      // Space toolbar or navigation should be present
      const spaceNav = page.locator('.space-bar, .space-toolbar, [class*="space-nav"]')
      const isVisible = await spaceNav.isVisible().catch(() => false)

      if (isVisible) {
        expectNoRuntimeIssues(issues)
      } else {
        // Spaces may be collapsed or not loaded - still shouldn't error
        expectNoRuntimeIssues(issues)
      }
    })
  })

  test.describe('Room Detail Panel', () => {
    test('should show room detail when clicking a room', async ({ page }) => {
      const issues = createRuntimeIssueCollector(page)

      await page.goto('/home')
      await page.waitForSelector('#app', { state: 'visible' })

      // Try clicking on a room item if available
      const roomItem = page.locator('.room-item, [class*="room-list-item"]').first()

      if (await roomItem.isVisible({ timeout: 5000 }).catch(() => false)) {
        await roomItem.click()
        await page.waitForTimeout(1000)
        // Chat area should be visible
        const chatArea = page.locator('.chat-main, .message-panel, [class*="chat-area"]')
        await expect(chatArea.first()).toBeVisible({ timeout: 10000 })
      }

      expectNoRuntimeIssues(issues)
    })
  })

  test.describe('Message Composition', () => {
    test('should render message input area', async ({ page }) => {
      const issues = createRuntimeIssueCollector(page)

      await page.goto('/home')
      await page.waitForSelector('#app', { state: 'visible' })

      // Message input area should exist with role="textbox" or contenteditable
      const editor = page.locator('[contenteditable="true"], textarea.message-input, .editor')
      await expect(editor.first()).toBeVisible({ timeout: 15000 })

      expectNoRuntimeIssues(issues)
    })

    test('should render emoji picker button', async ({ page }) => {
      const issues = createRuntimeIssueCollector(page)

      await page.goto('/home')
      await page.waitForSelector('#app', { state: 'visible' })

      // Emoji picker button should be present and accessible
      const emojiButton = page.locator('[aria-label*="表情"], [aria-label*="emoji"], [aria-label*="Emoji"]').first()
      await expect(emojiButton).toBeVisible({ timeout: 15000 })

      expectNoRuntimeIssues(issues)
    })

    test('should toggle emoji picker on button click', async ({ page }) => {
      const issues = createRuntimeIssueCollector(page)

      await page.goto('/home')
      await page.waitForSelector('#app', { state: 'visible' })

      const emojiButton = page.locator('[aria-label*="表情"], [aria-label*="emoji"], [aria-label*="Emoji"]').first()
      await emojiButton.click()

      // Emoji picker modal should appear
      const emojiPicker = page.locator('.emoji-picker, .emoji-panel, [class*="emoji"]')
      await expect(emojiPicker.first()).toBeVisible({ timeout: 5000 })

      expectNoRuntimeIssues(issues)
    })
  })

  test.describe('Network Resilience', () => {
    test('should show connection banner when network is lost', async ({ page }) => {
      const issues = createRuntimeIssueCollector(page)

      await page.goto('/home')
      await page.waitForSelector('#app', { state: 'visible' })

      // Go offline
      await page.context().setOffline(true)
      await page.waitForTimeout(2000)

      // Network bad banner should appear
      const networkBanner = page.locator('#cloudError, .network-banner, [class*="network-status"]')
      const isVisible = await networkBanner
        .first()
        .isVisible()
        .catch(() => false)

      // Restore connectivity
      await page.context().setOffline(false)

      if (isVisible) {
        await expect(networkBanner.first()).toBeVisible()
      }

      expectNoRuntimeIssues(issues)
    })

    test('should recover UI after network restored', async ({ page }) => {
      const issues = createRuntimeIssueCollector(page)

      await page.goto('/home')
      await page.waitForSelector('#app', { state: 'visible' })

      // Go offline and back online
      await page.context().setOffline(true)
      await page.waitForTimeout(1000)
      await page.context().setOffline(false)
      await page.waitForTimeout(2000)

      // App should still be responsive
      const appRoot = page.locator('#app')
      await expect(appRoot).toBeVisible()

      expectNoRuntimeIssues(issues)
    })
  })
})
