import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAudioPlayback } from '../useAudioPlayback'

const { audioManagerMock } = vi.hoisted(() => ({
  audioManagerMock: {
    getCurrentAudioId: vi.fn(),
    stop: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn()
  }
}))

vi.mock('@/utils/AudioManager', () => ({
  audioManager: audioManagerMock
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

describe('useAudioPlayback cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正在播放的是其他语音时不停止播放', () => {
    audioManagerMock.getCurrentAudioId.mockReturnValue('mxc://server/other')

    const playback = useAudioPlayback('mxc://server/mine')
    playback.cleanup()

    // 只移除本实例的监听器，不打断其他语音
    expect(audioManagerMock.removeListener).toHaveBeenCalledTimes(1)
    expect(audioManagerMock.stop).not.toHaveBeenCalled()
  })

  it('本实例拥有播放时停止播放', () => {
    audioManagerMock.getCurrentAudioId.mockReturnValue('mxc://server/mine')

    const playback = useAudioPlayback('mxc://server/mine')
    playback.cleanup()

    expect(audioManagerMock.stop).toHaveBeenCalledTimes(1)
  })
})
