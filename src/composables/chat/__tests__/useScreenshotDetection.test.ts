import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => vi.fn())
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  default: {
    sendTextMessage: vi.fn().mockResolvedValue({})
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: vi.fn()
  })
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => true
}))

describe('useScreenshotDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports useScreenshotDetection function', async () => {
    const { useScreenshotDetection } = await import('../useScreenshotDetection')
    expect(typeof useScreenshotDetection).toBe('function')
  })

  it('startWatch sets isWatching to true', async () => {
    const { useScreenshotDetection } = await import('../useScreenshotDetection')
    const { isWatching, startWatch } = useScreenshotDetection()
    expect(isWatching.value).toBe(false)
    await startWatch('!room1:server')
    expect(isWatching.value).toBe(true)
  })

  it('stopWatch sets isWatching to false', async () => {
    const { useScreenshotDetection } = await import('../useScreenshotDetection')
    const { isWatching, startWatch, stopWatch } = useScreenshotDetection()
    await startWatch('!room1:server')
    await stopWatch()
    expect(isWatching.value).toBe(false)
  })

  it('startWatch is idempotent (no double-start)', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const { useScreenshotDetection } = await import('../useScreenshotDetection')
    const { startWatch } = useScreenshotDetection()
    await startWatch('!room1:server')
    await startWatch('!room1:server')
    expect((invoke as any).mock.calls.length).toBe(1)
  })
})
