/**
 * §20.3 KPI #2 scenario #5 — Logout cleans tokens + caches.
 *
 * Status: fixme stub. The runtime logout path (`logoutCurrentSession`) chains
 * through Tauri WebviewWindow APIs and the matrix store, neither of which run
 * cleanly in browser-only Playwright. This spec is checked in to populate the
 * §20.3 inventory; un-skip by:
 *
 *   1. Wiring a desktop-Tauri Playwright project (or mocking `WebviewWindow`
 *      + `EventEnum.LOGOUT` in the page context).
 *   2. Driving `sessionOrchestrator.logoutCurrentSession()` from
 *      the page and asserting `localStorage` no longer holds `user`,
 *      `TOKEN`, `REFRESH_TOKEN`, plus capability cache invalidation.
 *   3. Asserting the auth guard redirects to `/login` once
 *      `clearMockSession` removes the bypass flag.
 */
import { expect, test } from '@playwright/test'
import { clearMockSession, seedMockSession } from './support/session'

test.describe('§20.3 #5 Logout cleans tokens + caches', () => {
  test.fixme('logout clears session keys and redirects to /login', async ({ page }) => {
    await seedMockSession(page, { platform: 'desktop' })
    await page.addInitScript(() => {
      window.localStorage.setItem('user', JSON.stringify({ uid: '@stub:matrix.test' }))
      window.localStorage.setItem('TOKEN', 'stub-access-token')
      window.localStorage.setItem('REFRESH_TOKEN', 'stub-refresh-token')
    })
    await page.goto('/message')

    // TODO(§20.3#5): drive sessionOrchestrator.logoutCurrentSession()
    // and assert localStorage cleanup + /login redirect after clearMockSession.
    await clearMockSession(page)

    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  })
})
