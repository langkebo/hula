import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn()
}))

import { invoke } from '@tauri-apps/api/core'
import { type Event, listen } from '@tauri-apps/api/event'
import { persistRefreshedToken, setupSystemResumeListener } from '../matrixClientPlatform'

const mockedInvoke = vi.mocked(invoke)
const mockedListen = vi.mocked(listen)

describe('persistRefreshedToken', () => {
  beforeEach(() => {
    mockedInvoke.mockReset()
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
})

describe('setupSystemResumeListener', () => {
  const originalTauriSymbol = (window as unknown as Record<string, unknown>).__TAURI__

  beforeEach(() => {
    mockedListen.mockReset()
    // Remove any pre-existing __TAURI__ flag to simulate the non-Tauri environment.
    delete (window as unknown as Record<string, unknown>).__TAURI__
  })

  afterEach(() => {
    if (originalTauriSymbol === undefined) {
      delete (window as unknown as Record<string, unknown>).__TAURI__
    } else {
      ;(window as unknown as Record<string, unknown>).__TAURI__ = originalTauriSymbol
    }
  })

  it('does nothing when running outside Tauri (no __TAURI__ on window)', () => {
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
    ;(window as unknown as Record<string, unknown>).__TAURI__ = {}

    const onResume = vi.fn()
    setupSystemResumeListener(onResume)

    await vi.waitFor(() => expect(mockedListen).toHaveBeenCalledTimes(1))
    expect(mockedListen).toHaveBeenCalledWith('system-resumed', expect.any(Function))

    capturedHandler?.({} as Event<unknown>)
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('does not call onResume when listen rejects', async () => {
    mockedListen.mockRejectedValue(new Error('listen failed'))
    ;(window as unknown as Record<string, unknown>).__TAURI__ = {}

    const onResume = vi.fn()
    setupSystemResumeListener(onResume)

    await vi.waitFor(() => expect(mockedListen).toHaveBeenCalledTimes(1))
    expect(onResume).not.toHaveBeenCalled()
  })
})
