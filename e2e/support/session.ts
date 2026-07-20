/// <reference types="node" />
import { test as base, type Page } from '@playwright/test'

const STORAGE_KEYS = {
  enabled: 'hula:e2e:enabled',
  mockAuth: 'hula:e2e:mock-auth',
  platform: 'hula:e2e:platform',
  seedWorkbench: 'hula:e2e:seed-workbench',
  homeserverUrl: 'hula-homeserver-url',
  identityServerUrl: 'hula-identity-server-url'
} as const

export type SessionPlatform = 'desktop' | 'mobile'

export interface MockSessionOptions {
  platform?: SessionPlatform
  homeserverUrl?: string | null
  identityServerUrl?: string | null
  seedWorkbench?: boolean
  resetRenderSamples?: boolean
}

const DEFAULT_OPTIONS: Required<Omit<MockSessionOptions, 'homeserverUrl' | 'identityServerUrl'>> & {
  homeserverUrl: string | null
  identityServerUrl: string | null
} = {
  platform: 'desktop',
  homeserverUrl: null,
  identityServerUrl: null,
  seedWorkbench: false,
  resetRenderSamples: true
}

/**
 * Seeds the localStorage flags consumed by `AppHarness` so the SPA boots in
 * E2E mock-auth mode (auth guard bypassed). Must be invoked before any
 * `page.goto(...)`. Compatible with non-MATRIX_LIVE_E2E specs.
 */
export const seedMockSession = async (page: Page, options: MockSessionOptions = {}): Promise<void> => {
  const merged = { ...DEFAULT_OPTIONS, ...options }
  await page.addInitScript(
    ({ keys, payload }) => {
      window.localStorage.setItem(keys.enabled, '1')
      window.localStorage.setItem(keys.mockAuth, '1')
      window.localStorage.setItem(keys.platform, payload.platform)

      if (payload.homeserverUrl) {
        window.localStorage.setItem(keys.homeserverUrl, payload.homeserverUrl)
      } else {
        window.localStorage.removeItem(keys.homeserverUrl)
      }

      if (payload.identityServerUrl) {
        window.localStorage.setItem(keys.identityServerUrl, payload.identityServerUrl)
      } else {
        window.localStorage.removeItem(keys.identityServerUrl)
      }

      if (payload.seedWorkbench) {
        window.localStorage.setItem(keys.seedWorkbench, '1')
      } else {
        window.localStorage.removeItem(keys.seedWorkbench)
      }

      if (payload.resetRenderSamples) {
        ;(window as Window & { __HULA_RENDER_SAMPLES__?: unknown[] }).__HULA_RENDER_SAMPLES__ = []
      }
    },
    {
      keys: STORAGE_KEYS,
      payload: {
        platform: merged.platform,
        homeserverUrl: merged.homeserverUrl,
        identityServerUrl: merged.identityServerUrl,
        seedWorkbench: merged.seedWorkbench,
        resetRenderSamples: merged.resetRenderSamples
      }
    }
  )
}

/**
 * Removes any seeded mock-session flags. Useful for specs that need to assert
 * the un-bypassed login redirect after exercising a logout flow.
 */
export const clearMockSession = async (page: Page): Promise<void> => {
  await page.addInitScript((keys) => {
    for (const key of Object.values(keys)) {
      window.localStorage.removeItem(key)
    }
    // Keep E2E mode enabled so the app knows it's running in a test environment.
    // This skips driver.js onboarding overlays that would block clicks.
    window.localStorage.setItem(keys.enabled, '1')
  }, STORAGE_KEYS)
}

export interface SessionFixtures {
  mockSessionOptions: MockSessionOptions
  seededPage: Page
}

/**
 * Playwright `test` object extended with a `seededPage` fixture that returns a
 * `Page` already pre-seeded with mock-session flags. Override per-spec via
 * `test.use({ mockSessionOptions: {...} })`.
 */
export const sessionTest = base.extend<SessionFixtures>({
  mockSessionOptions: [{ platform: 'desktop' }, { option: true }],
  seededPage: async ({ page, mockSessionOptions }, use) => {
    await seedMockSession(page, mockSessionOptions)
    await use(page)
  }
})

export { STORAGE_KEYS as MOCK_SESSION_STORAGE_KEYS }
