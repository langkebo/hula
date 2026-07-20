import { expect, type Page, test } from '@playwright/test'
import { clearMockSession, seedMockSession } from './support/session'

type RuntimeIssueCollector = {
  componentResolveErrors: string[]
  lazyLoadErrors: string[]
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

test.describe('Login Flow', () => {
  test.describe('Login Page Rendering', () => {
    test('should render login form with all required elements', async ({ page }) => {
      await clearMockSession(page)
      const issues = createRuntimeIssueCollector(page)

      await page.goto('/')
      await page.waitForSelector('#app', { state: 'visible' })

      // Verify login form container exists
      const loginBox = page.locator('.login-box')
      await expect(loginBox).toBeVisible({ timeout: 15000 })

      // Verify account input is present
      const accountInput = page.locator('input').first()
      await expect(accountInput).toBeVisible()

      // Verify password input is present
      const passwordInput = page.locator('input[type="password"]')
      await expect(passwordInput).toBeVisible()

      // Verify login button is present
      const loginButton = page.locator('button.gradient-button')
      await expect(loginButton).toBeVisible()

      // Verify bottom bar links exist
      await expect(page.getByText(/扫码登录|扫码|QR/i)).toBeVisible()

      expectNoRuntimeIssues(issues)
    })

    test('should navigate to QR code page', async ({ page }) => {
      await clearMockSession(page)
      const issues = createRuntimeIssueCollector(page)

      await page.goto('/')
      await page.waitForSelector('#app', { state: 'visible' })

      // Click the QR code switch link
      const qrLink = page.getByText(/扫码登录|扫码|QR/i)
      await qrLink.click()

      await expect(page).toHaveURL(/\/qrCode/, { timeout: 10000 })
      expectNoRuntimeIssues(issues)
    })

    test('should navigate to register page', async ({ page }) => {
      await clearMockSession(page)
      const issues = createRuntimeIssueCollector(page)

      await page.goto('/')
      await page.waitForSelector('#app', { state: 'visible' })

      // "Register" is inside a popover triggered by "More Opt..."
      const moreLink = page.getByText(/More Opt|more/i)
      await moreLink.click()
      await page.waitForTimeout(500)

      const registerLink = page.getByText(/register/i)
      await registerLink.click()

      await expect(page).toHaveURL(/\/register/, { timeout: 10000 })
      expectNoRuntimeIssues(issues)
    })
  })

  test.describe('Login Form Validation', () => {
    test('should disable login button when fields are empty', async ({ page }) => {
      await clearMockSession(page)
      const issues = createRuntimeIssueCollector(page)

      await page.goto('/')
      await page.waitForSelector('#app', { state: 'visible' })

      const loginButton = page.locator('button.gradient-button')
      // Button should be disabled when no account/password entered
      const isDisabled = await loginButton.getAttribute('disabled')
      expect(isDisabled).not.toBeNull()

      expectNoRuntimeIssues(issues)
    })

    test('should show server config modal', async ({ page }) => {
      await clearMockSession(page)
      const issues = createRuntimeIssueCollector(page)

      await page.goto('/')
      await page.waitForSelector('#app', { state: 'visible' })

      // Click server config link
      const serverConfigLink = page.getByText(/服务器配置|server|服务器/i)
      if (await serverConfigLink.isVisible()) {
        await serverConfigLink.click()
        // Verify the modal appears
        await expect(page.locator('.n-modal')).toBeVisible({ timeout: 5000 })
      }

      expectNoRuntimeIssues(issues)
    })
  })

  test.describe('Mock Session Bootstrap', () => {
    test('should bypass auth with mock session and render workspace', async ({ page }) => {
      await seedMockSession(page, { platform: 'desktop' })
      const issues = createRuntimeIssueCollector(page)

      await page.goto('/')
      await page.waitForSelector('#app', { state: 'visible' })

      // With mock auth, we should not see the login form
      const loginForm = page.locator('.login-box')
      await expect(loginForm).not.toBeVisible({ timeout: 15000 })

      expectNoRuntimeIssues(issues)
    })
  })
})
