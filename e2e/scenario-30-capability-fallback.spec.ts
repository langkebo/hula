/**
 * §20.3 KPI #2 scenario #30 — Capability missing → fallback UI.
 *
 * Status: fixme stub. The capability store is hydrated by
 * `MatrixCapabilityService.refreshCapabilities()` during boot; simulating a
 * missing capability requires either stubbing the homeserver response or
 * directly mutating the capability store before the protected view mounts.
 *
 * Un-skip by:
 *   1. Intercepting `/capabilities` with `page.route(...)` to return a payload
 *      omitting the target capability (e.g. `m.set_displayname`).
 *   2. Navigating to the view gated on that capability.
 *   3. Asserting the fallback surface renders (empty-state / disabled CTA)
 *      instead of the primary control.
 */
import { expect, test } from '@playwright/test'
import { seedMockSession } from './support/session'

test.describe('§20.3 #30 Capability missing → fallback UI', () => {
  test.fixme('renders fallback surface when capability is missing', async ({ page }) => {
    await seedMockSession(page, { platform: 'desktop' })

    // TODO(§20.3#30): page.route('**/capabilities', ...) to strip the target
    // capability, navigate, then assert the fallback element is visible.
    await page.goto('/')
    await expect(page.locator('#app')).toBeVisible()
  })
})
