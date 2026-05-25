import { beforeEach, describe, expect, it, vi } from 'vitest'

const hasTauriRuntimeMock = vi.fn()
const invokeWithResultMock = vi.fn()
const listenMock = vi.fn()

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: hasTauriRuntimeMock
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeWithResult: invokeWithResultMock
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock
}))

describe('AppStateReady', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns immediately in browser-only runs without a Tauri runtime', async () => {
    hasTauriRuntimeMock.mockReturnValue(false)

    const { ensureAppStateReady } = await import('../AppStateReady')

    await expect(ensureAppStateReady()).resolves.toBeUndefined()
    expect(invokeWithResultMock).not.toHaveBeenCalled()
    expect(listenMock).not.toHaveBeenCalled()
  })

  it('checks native app state when the Tauri runtime is available', async () => {
    hasTauriRuntimeMock.mockReturnValue(true)
    invokeWithResultMock.mockResolvedValue({
      isOk: () => true,
      value: true
    })

    const { ensureAppStateReady } = await import('../AppStateReady')

    await expect(ensureAppStateReady()).resolves.toBeUndefined()
    expect(invokeWithResultMock).toHaveBeenCalledWith('is_app_state_ready')
  })
})
