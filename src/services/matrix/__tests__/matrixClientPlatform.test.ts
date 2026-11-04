import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn()
}))

import { invoke } from '@tauri-apps/api/core'
import { type Event, listen } from '@tauri-apps/api/event'
import {
  persistRefreshedToken,
  persistWebAccessToken,
  readWebAccessToken,
  setupSystemResumeListener
} from '../matrixClientPlatform'

const mockedInvoke = vi.mocked(invoke)
const mockedListen = vi.mocked(listen)

/**
 * AR-07b / B1：`persistRefreshedToken` 现在按运行期分流 ——
 * Tauri 走 `invoke('update_token')`，浏览器走 localStorage at-rest 存储（刷新即更新）。
 * 因此这里必须显式构造 `__TAURI_INTERNALS__` 才能进 Tauri 分支。
 */
describe('persistRefreshedToken', () => {
  const originalTauriSymbol = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__

  beforeEach(() => {
    mockedInvoke.mockReset()
    localStorage.clear()
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  })

  afterEach(() => {
    if (originalTauriSymbol === undefined) {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
    } else {
      ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = originalTauriSymbol
    }
    localStorage.clear()
  })

  it('calls invoke update_token with the given credentials', async () => {
    mockedInvoke.mockResolvedValue(undefined)
    await persistRefreshedToken('uid-1', 'token-abc', 'refresh-xyz')
    expect(mockedInvoke).toHaveBeenCalledTimes(1)
    expect(mockedInvoke).toHaveBeenCalledWith('update_token', {
      req: {
        uid: 'uid-1',
        token: 'token-abc',
        refreshToken: 'refresh-xyz'
      }
    })
  })

  it('propagates invoke errors', async () => {
    mockedInvoke.mockRejectedValue(new Error('invoke failed'))
    await expect(persistRefreshedToken('uid-1', 'token', 'refresh')).rejects.toThrow('invoke failed')
  })

  it('在非 Tauri 运行期写入 localStorage 而不是调用 invoke', async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__

    await persistRefreshedToken('uid-1', 'web-token', 'refresh-xyz')

    expect(mockedInvoke).not.toHaveBeenCalled()
    expect(readWebAccessToken()).toBe('web-token')
  })
})

describe('persistWebAccessToken / readWebAccessToken', () => {
  const originalTauriSymbol = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__

  beforeEach(() => {
    localStorage.clear()
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  })

  afterEach(() => {
    if (originalTauriSymbol !== undefined) {
      ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = originalTauriSymbol
    }
    localStorage.clear()
  })

  it('浏览器运行期可写入、读取并清除', () => {
    persistWebAccessToken('tok-1')
    expect(readWebAccessToken()).toBe('tok-1')

    persistWebAccessToken(null)
    expect(readWebAccessToken()).toBeNull()
  })

  it('Tauri 运行期是 no-op（凭证只由 Rust 保管）', () => {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}

    persistWebAccessToken('should-not-persist')

    expect(localStorage.getItem('tjg.matrix.accessToken')).toBeNull()
    expect(readWebAccessToken()).toBeNull()
  })
})

describe('setupSystemResumeListener', () => {
  const originalTauriSymbol = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__

  beforeEach(() => {
    mockedListen.mockReset()
    // Remove any pre-existing __TAURI_INTERNALS__ flag to simulate the non-Tauri environment.
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  })

  afterEach(() => {
    if (originalTauriSymbol === undefined) {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
    } else {
      ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = originalTauriSymbol
    }
  })

  it('does nothing when running outside Tauri (no __TAURI_INTERNALS__ on window)', () => {
    const onResume = vi.fn()
    setupSystemResumeListener(onResume)
    expect(mockedListen).not.toHaveBeenCalled()
    expect(onResume).not.toHaveBeenCalled()
  })

  it('registers a system-resumed listener and triggers onResume when the event fires', async () => {
    let capturedHandler: ((event: Event<unknown>) => void) | undefined
    mockedListen.mockImplementation((_event: string, handler: (event: Event<unknown>) => void) => {
      capturedHandler = handler
      return Promise.resolve(() => {})
    })
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}

    const onResume = vi.fn()
    setupSystemResumeListener(onResume)

    await vi.waitFor(() => expect(mockedListen).toHaveBeenCalledTimes(1))
    expect(mockedListen).toHaveBeenCalledWith('system-resumed', expect.any(Function))

    capturedHandler?.({} as Event<unknown>)
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('does not call onResume when listen rejects', async () => {
    mockedListen.mockRejectedValue(new Error('listen failed'))
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}

    const onResume = vi.fn()
    setupSystemResumeListener(onResume)

    await vi.waitFor(() => expect(mockedListen).toHaveBeenCalledTimes(1))
    expect(onResume).not.toHaveBeenCalled()
  })

  it('unsubscribes the listener when the returned cleanup is called', async () => {
    const unlisten = vi.fn()
    let capturedHandler: ((event: Event<unknown>) => void) | undefined
    mockedListen.mockImplementation((_event: string, handler: (event: Event<unknown>) => void) => {
      capturedHandler = handler
      return Promise.resolve(unlisten)
    })
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}

    const onResume = vi.fn()
    const cleanup = setupSystemResumeListener(onResume)

    await vi.waitFor(() => expect(mockedListen).toHaveBeenCalledTimes(1))
    cleanup()

    expect(unlisten).toHaveBeenCalledTimes(1)

    // 注销后即使事件仍然到达，也不能再触发重连
    capturedHandler?.({} as Event<unknown>)
    expect(onResume).not.toHaveBeenCalled()
  })

  it('unsubscribes immediately when cleanup runs before listen resolves', async () => {
    const unlisten = vi.fn()
    let resolveListen: ((fn: () => void) => void) | undefined
    mockedListen.mockImplementation(
      () =>
        new Promise<() => void>((resolve) => {
          resolveListen = resolve
        })
    )
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}

    const onResume = vi.fn()
    const cleanup = setupSystemResumeListener(onResume)

    await vi.waitFor(() => expect(mockedListen).toHaveBeenCalledTimes(1))
    cleanup()
    resolveListen?.(unlisten)

    await vi.waitFor(() => expect(unlisten).toHaveBeenCalledTimes(1))
    expect(onResume).not.toHaveBeenCalled()
  })
})
