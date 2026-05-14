/**
 * §20.3 KPI #2 scenario #23 — Settings save + persist across relaunch.
 *
 * Status: fixme stub. "Relaunch" requires either a new Playwright browser
 * context that inherits the same storage state, or a Tauri-process restart in
 * the desktop project. Un-skip by:
 *
 *   1. Capturing `storageState` after writing the target setting.
 *   2. Spawning a fresh context with that state and re-asserting the value.
 *   3. Repeating with `pinia-plugin-persistedstate` keys for the relevant
 *      setting domain (e.g. `hula-settings-config`).
 */
import { expect, test } from '@playwright/test'
import { seedMockSession } from './support/session'

test.describe('§20.3 #23 Settings save + persist across relaunch', () => {
  test.fixme('persists modified setting across relaunch', async ({ page, context }) => {
    await seedMockSession(page, { platform: 'desktop' })
    await page.goto('/settings')

    // TODO(§20.3#23): mutate a target setting via the UI, capture
    // `await context.storageState()`, open a new context with that state,
    // navigate to /settings, and assert the mutated value is restored.
    const stateSnapshot = await context.storageState()
    expect(stateSnapshot.origins.length).toBeGreaterThan(0)
  })
})
