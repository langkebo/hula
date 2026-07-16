import { expect, type Page, test } from '@playwright/test'

type RuntimeIssueCollector = {
  componentResolveErrors: string[]
  lazyLoadErrors: string[]
}

const bootstrapMobileHarness = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hula:e2e:enabled', '1')
    window.localStorage.setItem('hula:e2e:mock-auth', '1')
    window.localStorage.setItem('hula:e2e:platform', 'mobile')
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
  expect(collector.componentResolveErrors, 'SSO login page should not have component resolve errors').toEqual([])
  expect(collector.lazyLoadErrors, 'SSO login page should not have lazy load errors').toEqual([])
}

test.describe('Mobile SSO Login', () => {
  test('login page renders with all required elements', async ({ page }) => {
    test.skip(!test.info().project.name.startsWith('mobile-'), 'SSO test only runs in mobile project')

    const runtimeIssues = createRuntimeIssueCollector(page)
    await bootstrapMobileHarness(page)
    await page.goto('/mobile/login')

    // Login form should be visible with tabs
    await expect(page.locator('[data-testid="mobile-login-form"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-login"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-login-submit"]')).toBeVisible()

    // Should remain on login page (no redirect)
    await expect(page).toHaveURL(/\/mobile\/login/)
    expectNoRuntimeIssues(runtimeIssues)
  })

  test('callback with empty loginToken stays on login page', async ({ page }) => {
    test.skip(!test.info().project.name.startsWith('mobile-'), 'SSO test only runs in mobile project')

    const runtimeIssues = createRuntimeIssueCollector(page)
    await bootstrapMobileHarness(page)
    await page.goto('/mobile/login?loginToken=')

    // Should remain on login page - empty token returns false without API call
    await expect(page).toHaveURL(/\/mobile\/login/)
    expectNoRuntimeIssues(runtimeIssues)
  })

  test('callback with loginToken does not crash the page', async ({ page }) => {
    test.skip(!test.info().project.name.startsWith('mobile-'), 'SSO test only runs in mobile project')

    const runtimeIssues = createRuntimeIssueCollector(page)
    await bootstrapMobileHarness(page)
    await page.goto('/mobile/login?loginToken=e2e-test-sso-token')

    // Attempting SSO login with fake token should fail gracefully (toast shown)
    // The page should not crash and should remain on login URL
    await expect(page).toHaveURL(/\/mobile\/login/)
    expectNoRuntimeIssues(runtimeIssues)
  })

  test('SSO callback with missing login_token query param does not trigger callback', async ({ page }) => {
    test.skip(!test.info().project.name.startsWith('mobile-'), 'SSO test only runs in mobile project')

    const runtimeIssues = createRuntimeIssueCollector(page)
    await bootstrapMobileHarness(page)
    await page.goto('/mobile/login')

    // No SSO params in URL, so SSO callback should not attempt login
    // Confirm login page rendered
    await expect(page.locator('[data-testid="mobile-login-form"]')).toBeVisible()
    expectNoRuntimeIssues(runtimeIssues)
  })
})
