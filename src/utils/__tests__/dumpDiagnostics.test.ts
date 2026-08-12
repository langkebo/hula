import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCapabilityStore } from '@/stores/domains/chat/capability'
import { dumpDiagnostics, formatDiagnostics } from '@/utils/dumpDiagnostics'
import { errorTracker } from '@/utils/ErrorTracker'

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getConnectionState: vi.fn(() => 'CONNECTED'),
    getClient: vi.fn(() => ({ getHomeserverUrl: () => 'https://matrix.test' }))
  }
}))

vi.mock('@/utils/ErrorTracker', () => ({
  errorTracker: {
    getErrorSummary: vi.fn(() => ({
      total: 5,
      unhandled: 1,
      promise: 2,
      vue: 1,
      manual: 1,
      topErrors: []
    })),
    clearErrors: vi.fn(),
    terminate: vi.fn(),
    initialize: vi.fn(),
    trackError: vi.fn(),
    trackManual: vi.fn()
  }
}))

describe('dumpDiagnostics (O4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(errorTracker.getErrorSummary).mockReturnValue({
      total: 5,
      unhandled: 1,
      promise: 2,
      vue: 1,
      manual: 1,
      topErrors: []
    })
  })

  it('返回结构化诊断快照', () => {
    const snapshot = dumpDiagnostics()

    expect(snapshot.timestamp).toBeTruthy()
    expect(snapshot.connectionState).toBe('CONNECTED')
    expect(snapshot.homeserverUrl).toBe('https://matrix.test')
    expect(snapshot.errorSummary.total).toBe(5)
    expect(snapshot.errorSummary.unhandled).toBe(1)
    expect(snapshot.extensionHealth).toEqual({})
    expect(snapshot.hasDegradedExtension).toBe(false)
  })

  it('包含降级扩展信息', () => {
    const cap = useCapabilityStore()
    cap.setExtensionHealth('friend-manager', 'degraded')

    const snapshot = dumpDiagnostics()

    expect(snapshot.extensionHealth['friend-manager']).toBe('degraded')
    expect(snapshot.hasDegradedExtension).toBe(true)
  })

  it('formatDiagnostics 返回可复制的文本', () => {
    const snapshot = dumpDiagnostics()
    const text = formatDiagnostics(snapshot)

    expect(text).toContain('Diagnostics Snapshot')
    expect(text).toContain('Homeserver: https://matrix.test')
    expect(text).toContain('Connection: CONNECTED')
    expect(text).toContain('Error Summary:')
    expect(text).toContain('Total: 5')
  })

  it('dumpDiagnostics 不抛异常（non-blocking）', () => {
    vi.mocked(errorTracker.getErrorSummary).mockImplementation(() => {
      throw new Error('internal error')
    })

    expect(() => dumpDiagnostics()).not.toThrow()
  })
})
