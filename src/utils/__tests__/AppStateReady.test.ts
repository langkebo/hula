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
    vi.useRealTimers()
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

  it('waits for app-state-ready when native app state is not ready yet', async () => {
    hasTauriRuntimeMock.mockReturnValue(true)
    invokeWithResultMock.mockResolvedValue({
      isOk: () => true,
      value: false
    })
    const unlisten = vi.fn()
    let readyHandler: (() => void) | undefined
    listenMock.mockImplementation((_event: string, handler: () => void) => {
      readyHandler = handler
      return Promise.resolve(unlisten)
    })

    const { ensureAppStateReady } = await import('../AppStateReady')

    const promise = ensureAppStateReady()
    await Promise.resolve()
    readyHandler?.()

    await expect(promise).resolves.toBeUndefined()
    expect(unlisten).toHaveBeenCalledTimes(1)
  })

  it('releases waiters when app-state-ready is not emitted', async () => {
    vi.useFakeTimers()
    hasTauriRuntimeMock.mockReturnValue(true)
    invokeWithResultMock.mockResolvedValue({
      isOk: () => true,
      value: false
    })
    const unlisten = vi.fn()
    listenMock.mockResolvedValue(unlisten)

    const { ensureAppStateReady } = await import('../AppStateReady')

    const promise = ensureAppStateReady()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(10_000)

    await expect(promise).resolves.toBeUndefined()
    vi.useRealTimers()
  })
})
