import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onMounted: (fn: () => void) => fn(),
    onUnmounted: vi.fn()
  }
})

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => null)
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

import { useConnectionStatus } from '../useConnectionStatus'
import { matrixClientService } from '@/services/matrix/MatrixClientService'

describe('useConnectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure navigator.onLine is true for tests
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
  })

  it('initializes with online state', () => {
    const { state, retryCount } = useConnectionStatus()
    expect(state.value).toBe('online')
    expect(retryCount.value).toBe(0)
  })

  it('detects offline state on mount', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    const { state } = useConnectionStatus()
    expect(state.value).toBe('offline')
  })

  it('retry sets state to reconnecting and increments count', () => {
    const mockRetry = vi.fn()
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      retryImmediately: mockRetry
    } as unknown as ReturnType<typeof matrixClientService.getClient>)

    const { state, retryCount, retry } = useConnectionStatus()
    retry()

    expect(state.value).toBe('reconnecting')
    expect(retryCount.value).toBe(1)
  })

  it('retry sets error state when no client', () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)
    const { state, retry } = useConnectionStatus()
    retry()
    expect(state.value).toBe('error')
  })

  it('responds to online/offline events', () => {
    const listeners: Record<string, EventListener> = {}
    vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
      listeners[type] = handler as EventListener
    })

    const { state, retryCount } = useConnectionStatus()

    // Simulate offline
    if (listeners['offline']) {
      listeners['offline'](new Event('offline'))
    }
    expect(state.value).toBe('offline')

    // Simulate online
    if (listeners['online']) {
      listeners['online'](new Event('online'))
    }
    expect(state.value).toBe('online')
    expect(retryCount.value).toBe(0)
  })
})
