import { expect, test } from '@playwright/test'
import { createRuntimeIssueCollector, expectNoRuntimeIssues } from './support/runtimeIssues'
import { bootstrapMobileHarness } from './support/session'

const SSO_RUNTIME_ISSUE_OPTIONS = {
  componentResolveErrorMessage: 'SSO login page should not have component resolve errors',
  lazyLoadErrorMessage: 'SSO login page should not have lazy load errors'
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
    expectNoRuntimeIssues(runtimeIssues, SSO_RUNTIME_ISSUE_OPTIONS)
  })

  test('callback with empty loginToken stays on login page', async ({ page }) => {
    test.skip(!test.info().project.name.startsWith('mobile-'), 'SSO test only runs in mobile project')

    const runtimeIssues = createRuntimeIssueCollector(page)
    await bootstrapMobileHarness(page)
    await page.goto('/mobile/login?loginToken=')

    // Should remain on login page - empty token returns false without API call
    await expect(page).toHaveURL(/\/mobile\/login/)
    expectNoRuntimeIssues(runtimeIssues, SSO_RUNTIME_ISSUE_OPTIONS)
  })

  test('callback with loginToken does not crash the page', async ({ page }) => {
    test.skip(!test.info().project.name.startsWith('mobile-'), 'SSO test only runs in mobile project')

    const runtimeIssues = createRuntimeIssueCollector(page)
    await bootstrapMobileHarness(page)
    await page.goto('/mobile/login?loginToken=e2e-test-sso-token')

    // Attempting SSO login with fake token should fail gracefully (toast shown)
    // The page should not crash and should remain on login URL
    await expect(page).toHaveURL(/\/mobile\/login/)
    expectNoRuntimeIssues(runtimeIssues, SSO_RUNTIME_ISSUE_OPTIONS)
  })

  test('SSO callback with missing login_token query param does not trigger callback', async ({ page }) => {
    test.skip(!test.info().project.name.startsWith('mobile-'), 'SSO test only runs in mobile project')

    const runtimeIssues = createRuntimeIssueCollector(page)
    await bootstrapMobileHarness(page)
    await page.goto('/mobile/login')

    // No SSO params in URL, so SSO callback should not attempt login
    // Confirm login page rendered
    await expect(page.locator('[data-testid="mobile-login-form"]')).toBeVisible()
    expectNoRuntimeIssues(runtimeIssues, SSO_RUNTIME_ISSUE_OPTIONS)
  })
})
