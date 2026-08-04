import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}))

const startWatchMock = vi.fn().mockResolvedValue(undefined)
const stopWatchMock = vi.fn().mockResolvedValue(undefined)

vi.mock('../useScreenshotDetection', () => ({
  useScreenshotDetection: () => ({
    isWatching: { value: false },
    startWatch: startWatchMock,
    stopWatch: stopWatchMock
  })
}))

describe('usePrivateMode screenshot integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('confirmPrivateMode calls startWatch when currentRoomId is set', async () => {
    const { useScreenshotDetection } = await import('../useScreenshotDetection')
    const { usePrivateMode } = await import('../usePrivateMode')
    const { setRoomId, confirmPrivateMode } = usePrivateMode()
    setRoomId('!room1:server')
    confirmPrivateMode()
    expect(useScreenshotDetection().startWatch).toHaveBeenCalledWith('!room1:server')
  })

  it('togglePrivateMode (exit) calls stopWatch', async () => {
    const { useScreenshotDetection } = await import('../useScreenshotDetection')
    const { usePrivateMode } = await import('../usePrivateMode')
    const { setRoomId, confirmPrivateMode, togglePrivateMode } = usePrivateMode()
    setRoomId('!room1:server')
    confirmPrivateMode()
    togglePrivateMode()
    expect(useScreenshotDetection().stopWatch).toHaveBeenCalled()
  })
})
