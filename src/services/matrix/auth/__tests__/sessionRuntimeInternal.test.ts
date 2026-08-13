import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import { IdempotencyGuard } from '@/utils/ExecutionGuard'
import { SessionRuntimeState } from '../sessionRuntimeInternal'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@/services/matrix/user/MatrixPresenceService', () => ({
  matrixPresenceService: { setPresence: vi.fn() }
}))

const mockSetPresence = vi.mocked(matrixPresenceService.setPresence)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SessionRuntimeState', () => {
  it('exposes a bootstrapGuard that is an IdempotencyGuard instance', () => {
    const state = new SessionRuntimeState()
    expect(state.bootstrapGuard).toBeInstanceOf(IdempotencyGuard)
  })

  it('initializes presenceChangeCleanup to null', () => {
    const state = new SessionRuntimeState()
    expect(state.presenceChangeCleanup).toBeNull()
  })

  it('initializes beforeUnloadRegistered to false', () => {
    const state = new SessionRuntimeState()
    expect(state.beforeUnloadRegistered).toBe(false)
  })

  it('initializes cachedHasSession to null', () => {
    const state = new SessionRuntimeState()
    expect(state.cachedHasSession).toBeNull()
  })

  it('allows the mutable fields to be reassigned after initialization', () => {
    const state = new SessionRuntimeState()
    const cleanup = () => {}
    state.presenceChangeCleanup = cleanup
    state.beforeUnloadRegistered = true
    state.cachedHasSession = true

    expect(state.presenceChangeCleanup).toBe(cleanup)
    expect(state.beforeUnloadRegistered).toBe(true)
    expect(state.cachedHasSession).toBe(true)
  })

  it('onBeforeUnload calls matrixPresenceService.setPresence with unavailable', async () => {
    mockSetPresence.mockResolvedValue(undefined)
    const state = new SessionRuntimeState()

    state.onBeforeUnload()

    expect(mockSetPresence).toHaveBeenCalledWith('unavailable')
    // onBeforeUnload 内部 `void promise.catch(...)`，允许异步完成，不抛错
    await vi.waitFor(() => expect(mockSetPresence).toHaveBeenCalledTimes(1))
  })

  it('onBeforeUnload swallows a rejected setPresence promise', async () => {
    mockSetPresence.mockRejectedValue(new Error('presence down'))
    const state = new SessionRuntimeState()

    // 不应抛出异常（内部通过 .catch 吞掉）
    expect(() => state.onBeforeUnload()).not.toThrow()
    await vi.waitFor(() => expect(mockSetPresence).toHaveBeenCalledTimes(1))
  })
})
