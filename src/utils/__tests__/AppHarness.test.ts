import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const osMock = vi.hoisted(() => ({
  type: vi.fn(() => 'macos')
}))

const performanceReporterMock = vi.hoisted(() => ({
  performanceReporter: {
    reportPageRender: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-os', () => osMock)

vi.mock('@/utils/PerformanceReporter', () => performanceReporterMock)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

import { detectAppPlatform, hasTauriRuntime, isE2EMode, shouldBypassAuthForE2E } from '../AppHarness'

const setWindowSearch = (search: string): void => {
  const path = window.location.pathname
  window.history.replaceState(null, '', search ? `${path}?${search}` : path)
}

describe('AppHarness', () => {
  beforeEach(() => {
    localStorage.clear()
    setWindowSearch('')
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    vi.stubEnv('DEV', true)
    osMock.type.mockReturnValue('macos')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  describe('hasTauriRuntime', () => {
    it('returns true when window.__TAURI_INTERNALS__ exists', () => {
      ;(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}
      expect(hasTauriRuntime()).toBe(true)
    })

    it('returns false when window.__TAURI_INTERNALS__ is undefined', () => {
      expect(hasTauriRuntime()).toBe(false)
    })

    it('returns false in non-browser environment', () => {
      vi.stubGlobal('window', undefined)
      expect(hasTauriRuntime()).toBe(false)
    })
  })

  describe('isE2EMode', () => {
    it('returns true when localStorage has tjg:e2e:enabled=1', () => {
      localStorage.setItem('tjg:e2e:enabled', '1')
      expect(isE2EMode()).toBe(true)
    })

    it('returns true when URL query has e2e=1', () => {
      setWindowSearch('e2e=1')
      expect(isE2EMode()).toBe(true)
    })

    it('returns false when neither query nor storage flag is set', () => {
      expect(isE2EMode()).toBe(false)
    })
  })

  describe('shouldBypassAuthForE2E', () => {
    it('returns true when DEV + E2E + mockAuth are all satisfied', () => {
      localStorage.setItem('tjg:e2e:enabled', '1')
      localStorage.setItem('tjg:e2e:mock-auth', '1')
      expect(shouldBypassAuthForE2E()).toBe(true)
    })

    it('returns false in non-DEV mode', () => {
      vi.stubEnv('DEV', false)
      localStorage.setItem('tjg:e2e:enabled', '1')
      localStorage.setItem('tjg:e2e:mock-auth', '1')
      expect(shouldBypassAuthForE2E()).toBe(false)
    })

    it('returns false when mockAuth flag is missing', () => {
      localStorage.setItem('tjg:e2e:enabled', '1')
      expect(shouldBypassAuthForE2E()).toBe(false)
    })
  })

  describe('detectAppPlatform', () => {
    it('returns "mobile" when URL query platform=mobile', () => {
      setWindowSearch('platform=mobile')
      expect(detectAppPlatform()).toBe('mobile')
    })

    it('returns "desktop" when URL query platform=desktop', () => {
      setWindowSearch('platform=desktop')
      expect(detectAppPlatform()).toBe('desktop')
    })

    it('returns "desktop" by default when no query is set', () => {
      expect(detectAppPlatform()).toBe('desktop')
    })
  })
})
