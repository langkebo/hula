/// <reference types="node" />
import { test as base, type Page } from '@playwright/test'
// 存储键唯一定义源（src 与 e2e 共用）。此前这里写死的键仍带旧品牌前缀，
// 而 src 已改成 tjg 前缀，导致 mock-auth / platform 标记从未生效（F-8）。
import {
  E2E_STORAGE_KEYS,
  MATRIX_HOMESERVER_STORAGE_KEY,
  MATRIX_IDENTITY_SERVER_STORAGE_KEY
} from '../../src/utils/storageKeys'
import { autoDismissLocalUnlockGate } from './localUnlockGate'

const STORAGE_KEYS = {
  enabled: E2E_STORAGE_KEYS.enabled,
  mockAuth: E2E_STORAGE_KEYS.mockAuth,
  platform: E2E_STORAGE_KEYS.platform,
  homeserverUrl: MATRIX_HOMESERVER_STORAGE_KEY,
  identityServerUrl: MATRIX_IDENTITY_SERVER_STORAGE_KEY
} as const

export type SessionPlatform = 'desktop' | 'mobile'

export interface MockSessionOptions {
  platform?: SessionPlatform
  homeserverUrl?: string | null
  identityServerUrl?: string | null
  resetRenderSamples?: boolean
}

const DEFAULT_OPTIONS: Required<Omit<MockSessionOptions, 'homeserverUrl' | 'identityServerUrl'>> & {
  homeserverUrl: string | null
  identityServerUrl: string | null
} = {
  platform: 'desktop',
  homeserverUrl: null,
  identityServerUrl: null,
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

      if (payload.resetRenderSamples) {
        ;(window as Window & { __TJG_RENDER_SAMPLES__?: unknown[] }).__TJG_RENDER_SAMPLES__ = []
      }
    },
    {
      keys: STORAGE_KEYS,
      payload: {
        platform: merged.platform,
        homeserverUrl: merged.homeserverUrl,
        identityServerUrl: merged.identityServerUrl,
        resetRenderSamples: merged.resetRenderSamples
      }
    }
  )
}

/**
 * Mock Tauri runtime internals on `window` so the app doesn't crash in the
 * browser-only Playwright environment. Without this, `WebviewWindow.getCurrent()`
 * → `getCurrentWindow()` accesses `window.__TAURI_INTERNALS__.metadata` →
 * `undefined` → crash.
 */
export const installTauriRuntimeMock = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    ;((window as unknown as { __TAURI_INTERNALS__?: Record<string, unknown> }).__TAURI_INTERNALS__ ??= {}).metadata = {
      currentWindow: { label: 'main' },
      currentWebview: { windowLabel: 'main', label: 'main' }
    }
  })
}

/**
 * Bootstrap a desktop E2E harness: seeds mock-auth session flags and installs
 * the Tauri runtime mock. Centralized so spec files don't re-implement the
 * same `bootstrapDesktopHarness` helper.
 */
export const bootstrapDesktopHarness = async (page: Page, options: MockSessionOptions = {}): Promise<void> => {
  await seedMockSession(page, { ...options, platform: 'desktop' })
  await installTauriRuntimeMock(page)
  // 纯浏览器没有密钥库 ⇒ 「设置本地解锁密码」弹窗必然出现并阻断启动（F-10 的 mock 侧）。
  // mock 会话下所有用例都要越过它，集中在这里自动点掉，避免每个 spec 各写一遍。
  await autoDismissLocalUnlockGate(page)
}

/**
 * Bootstrap a mobile E2E harness: seeds mock-auth session flags with the
 * mobile platform marker. Centralized so spec files don't re-implement the
 * same `bootstrapMobileHarness` helper.
 */
export const bootstrapMobileHarness = async (page: Page, options: MockSessionOptions = {}): Promise<void> => {
  await seedMockSession(page, { ...options, platform: 'mobile' })
  await autoDismissLocalUnlockGate(page)
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
  // 断言登录页的用例同样要先过解锁门禁，否则 splash 挡着、Login 根本不挂载。
  await autoDismissLocalUnlockGate(page)
}

export interface SessionFixtures {
  mockSessionOptions: MockSessionOptions
  seededPage: Page
}

/**
 * 把 `capability` store 标记为「已加载」（空能力表）。
 *
 * 为什么需要：设置页侧栏用 `capabilitiesLoaded` 做骨架屏门禁，而 `isLoaded` 只由
 * `MatrixCapabilityService.refreshCapabilities()` 置位 —— 该方法需要 matrix client。
 * mock 会话没有 client ⇒ 能力探测永不触发 ⇒ 设置页永远停在骨架屏，
 * `#settings-tab-*` 一个都不渲染（`desktop-key-flows` / `messaging-workspace` 因此红）。
 *
 * 这里是**测试侧**补位，不改产品语义（真实登录一定会有 client 和一次 refresh）。
 */
export const markCapabilitiesLoaded = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () => (window as Window & { __TJG_PINIA_READY__?: boolean }).__TJG_PINIA_READY__ === true,
    undefined,
    { timeout: 20_000 }
  )
  await page.evaluate(async () => {
    const modulePath = '/src/stores/domains/chat/capability.ts'
    const { useCapabilityStore } = (await import(/* @vite-ignore */ modulePath)) as {
      useCapabilityStore: (pinia?: unknown) => {
        setCapabilities: (data: Record<string, unknown>) => void
      }
    }
    useCapabilityStore((window as Window & { pinia?: unknown }).pinia).setCapabilities({
      unstable_features: {},
      capabilities: {},
      client_config: {}
    })
  })
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
