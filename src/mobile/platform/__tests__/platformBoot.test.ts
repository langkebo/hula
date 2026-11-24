import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { initMock, hasTauriRuntimeMock, invokeSilentlyMock, badgeSyncMock, piniaMock } = vi.hoisted(() => ({
  initMock: vi.fn(),
  hasTauriRuntimeMock: vi.fn(() => true),
  invokeSilentlyMock: vi.fn(async () => null),
  badgeSyncMock: vi.fn(),
  piniaMock: { __pinia: true }
}))

vi.mock('@/mobile/platform/mobileBadgeSync', () => ({
  startMobileBadgeSync: badgeSyncMock
}))

vi.mock('@/stores', () => ({
  pinia: piniaMock
}))

vi.mock('eruda', () => ({
  default: { init: initMock }
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: hasTauriRuntimeMock
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeSilently: invokeSilentlyMock
}))

import { mobilePlatformBoot } from '@/mobile/platform/platformBoot'
import { desktopPlatformBoot } from '@/platform/desktop/platformBoot'
import { getPlatformBoot, registerPlatformBoot } from '@/platform/platformBoot'

describe('platform boot registry', () => {
  beforeEach(() => {
    registerPlatformBoot(desktopPlatformBoot)
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('defaults to the desktop implementation', () => {
    expect(getPlatformBoot()).toBe(desktopPlatformBoot)
  })

  it('switches to the mobile implementation after registration', () => {
    registerPlatformBoot(mobilePlatformBoot)
    expect(getPlatformBoot()).toBe(mobilePlatformBoot)
  })
})

describe('mobile platform boot', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    hasTauriRuntimeMock.mockReturnValue(true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('notifies native splash when the document is already ready', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')

    mobilePlatformBoot.afterPlatformInitialize()

    await vi.waitFor(() => {
      expect(invokeSilentlyMock).toHaveBeenCalledWith('set_complete', { task: 'frontend' })
    })
  })

  it('waits for DOMContentLoaded when the document is still loading', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')

    mobilePlatformBoot.afterPlatformInitialize()
    expect(invokeSilentlyMock).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('DOMContentLoaded'))

    await vi.waitFor(() => {
      expect(invokeSilentlyMock).toHaveBeenCalledWith('set_complete', { task: 'frontend' })
    })
  })

  it('skips the native signal outside the Tauri runtime', async () => {
    hasTauriRuntimeMock.mockReturnValue(false)
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')

    mobilePlatformBoot.afterPlatformInitialize()

    await Promise.resolve()
    expect(invokeSilentlyMock).not.toHaveBeenCalled()
  })

  it('initializes eruda only in development', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
    vi.stubEnv('NODE_ENV', 'development')

    mobilePlatformBoot.afterPlatformInitialize()

    await vi.waitFor(() => {
      expect(initMock).toHaveBeenCalledTimes(1)
    })
  })

  it('does not initialize eruda in production', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
    vi.stubEnv('NODE_ENV', 'production')

    mobilePlatformBoot.afterPlatformInitialize()

    await Promise.resolve()
    expect(initMock).not.toHaveBeenCalled()
  })

  it('does not start the badge sync before the app setup context exists', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')

    mobilePlatformBoot.afterPlatformInitialize()

    expect(badgeSyncMock).not.toHaveBeenCalled()
  })

  it('starts the mobile badge sync with the shared pinia instance during app setup', () => {
    mobilePlatformBoot.afterAppSetup?.()

    expect(badgeSyncMock).toHaveBeenCalledWith(piniaMock)
  })
})
