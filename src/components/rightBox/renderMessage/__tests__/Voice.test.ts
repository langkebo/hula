import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import VoiceMessage from '../Voice.vue'

vi.hoisted(() => {
  // 让可见性任务在挂载时立即触发，使惰性加载在测试中可确定地执行
  class ImmediateIntersectionObserver {
    private callback: (entries: IntersectionObserverEntry[]) => void

    constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
      this.callback = callback
    }

    observe(target: Element) {
      this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry])
    }

    unobserve() {}

    disconnect() {}
  }

  ;(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = ImmediateIntersectionObserver
})

const {
  togglePlaybackMock,
  seekToTimeMock,
  createAudioElementMock,
  playbackCleanupMock,
  getAudioUrlMock,
  loadAudioWaveformMock,
  fileManagerCleanupMock,
  downloadEncryptedFileMock,
  safeExistsPathMock,
  getPlayableUrlMock,
  audioState,
  dragState,
  waveformState
} = vi.hoisted(() => ({
  togglePlaybackMock: vi.fn(),
  seekToTimeMock: vi.fn(),
  createAudioElementMock: vi.fn(),
  playbackCleanupMock: vi.fn(),
  getAudioUrlMock: vi.fn(),
  loadAudioWaveformMock: vi.fn(),
  fileManagerCleanupMock: vi.fn(),
  downloadEncryptedFileMock: vi.fn(),
  safeExistsPathMock: vi.fn(),
  getPlayableUrlMock: vi.fn((mxc?: string, url?: string) => mxc || url || ''),
  audioState: {
    isPlaying: false,
    loading: false,
    playbackProgress: 0,
    audioElement: null as { duration: number; pause: () => void } | null
  },
  dragState: {
    isDragging: false,
    showTimePreview: false,
    previewTime: 0
  },
  waveformState: {
    waveformWidth: 120,
    scanLinePosition: 0
  }
}))

vi.mock('@/composables/chat/useVoiceDragControl', () => ({
  useVoiceDragControl: () => ({
    isDragging: ref(dragState.isDragging),
    showTimePreview: ref(dragState.showTimePreview),
    previewTime: ref(dragState.previewTime),
    handleDragStart: vi.fn(),
    cleanup: vi.fn()
  })
}))

vi.mock('@/composables/chat/useWaveformRenderer', () => ({
  useWaveformRenderer: () => {
    const waveformData = ref<number[]>([])
    return {
      waveformCanvas: ref(null),
      waveformWidth: ref(waveformState.waveformWidth),
      scanLinePosition: ref(waveformState.scanLinePosition),
      waveformData,
      shouldUpdateCache: ref(false),
      drawWaveform: vi.fn(),
      drawWaveformThrottled: vi.fn(),
      drawWaveformImmediate: vi.fn(),
      generateWaveformData: vi.fn(async () => {
        waveformData.value = [0.4, 0.8]
      }),
      loadPrecomputedWaveform: vi.fn((data: number[]) => {
        waveformData.value = data
      })
    }
  }
}))

vi.mock('@/composables/common/useAudioFileManager', () => ({
  useAudioFileManager: () => ({
    getAudioUrl: getAudioUrlMock,
    loadAudioWaveform: loadAudioWaveformMock,
    cleanup: fileManagerCleanupMock
  })
}))

vi.mock('@/composables/common/useAudioPlayback', () => ({
  useAudioPlayback: () => ({
    isPlaying: ref(audioState.isPlaying),
    loading: ref(audioState.loading),
    playbackProgress: ref(audioState.playbackProgress),
    audioElement: ref(audioState.audioElement),
    togglePlayback: togglePlaybackMock,
    seekToTime: seekToTimeMock,
    createAudioElement: createAudioElementMock,
    cleanup: playbackCleanupMock
  })
}))

vi.mock('@/services/matrix/media/MatrixVoiceService', () => ({
  matrixVoiceService: {
    getPlayableUrl: getPlayableUrlMock
  }
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: ref(null)
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    userInfo: { uid: '@me:server.test' }
  })
}))

vi.mock('@/stores/domains/widget/fileDownload', () => ({
  useFileDownloadStore: () => ({
    downloadEncryptedFile: downloadEncryptedFileMock
  })
}))

vi.mock('@/utils/Formatting', () => ({
  extractFileName: (url: string) => {
    const segment = url.split('/').pop() || ''
    return segment.includes('.') ? segment : ''
  },
  formatDuration: (seconds: number, options: { round?: boolean; padMinutes?: boolean } = {}) => {
    const { round = false, padMinutes = false } = options
    const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
    const total = round ? Math.round(safeSeconds) : Math.floor(safeSeconds)
    const minutes = Math.floor(total / 60)
    const remainingSeconds = total % 60
    const minutesText = padMinutes ? minutes.toString().padStart(2, '0') : minutes.toString()
    return `${minutesText}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('@/utils/PathUtil', () => ({
  safeExistsPath: safeExistsPathMock
}))

describe('renderMessage/Voice', () => {
  // 波形缓存是模块级的，为每个用例生成独立音频地址，避免用例之间互相命中
  let voiceSequence = 0
  const nextVoiceUrl = () => {
    voiceSequence += 1
    return `mxc://server/voice-${voiceSequence}`
  }

  beforeEach(() => {
    vi.clearAllMocks()
    audioState.isPlaying = false
    audioState.loading = false
    audioState.playbackProgress = 0
    audioState.audioElement = null
    dragState.isDragging = false
    dragState.showTimePreview = false
    loadAudioWaveformMock.mockResolvedValue({})
    createAudioElementMock.mockResolvedValue(undefined)
    getAudioUrlMock.mockResolvedValue('blob:audio')
    safeExistsPathMock.mockResolvedValue(false)
    downloadEncryptedFileMock.mockResolvedValue('/local/voice.webm')
    getPlayableUrlMock.mockImplementation((mxc?: string, url?: string) => mxc || url || '')
  })

  const mountComponent = (body: Record<string, unknown> = {}, fromUserUid = '@other:server.test') =>
    mount(VoiceMessage, {
      props: {
        body: { mxcUrl: nextVoiceUrl(), second: 65, ...body },
        fromUserUid
      } as never
    })

  const bodyUrl = (wrapper: ReturnType<typeof mountComponent>) => (wrapper.props('body') as { mxcUrl: string }).mxcUrl

  it('进入视口时只加载波形，不提前创建音频元素', async () => {
    const wrapper = mountComponent()
    const url = bodyUrl(wrapper)
    await flushPromises()

    expect(loadAudioWaveformMock).toHaveBeenCalledWith(url)
    expect(createAudioElementMock).not.toHaveBeenCalled()
  })

  it('点击容器时按需创建音频元素并开始播放', async () => {
    const wrapper = mountComponent()
    const url = bodyUrl(wrapper)
    await flushPromises()

    await wrapper.find('.voice-container').trigger('click')
    await flushPromises()

    expect(createAudioElementMock).toHaveBeenCalledWith(url, 65)
    expect(togglePlaybackMock).toHaveBeenCalledTimes(1)
  })

  it('同一音频重复挂载时复用波形缓存', async () => {
    const body = { mxcUrl: 'mxc://server/cached-voice', second: 65 }

    mountComponent(body)
    await flushPromises()
    expect(loadAudioWaveformMock).toHaveBeenCalledTimes(1)

    mountComponent(body)
    await flushPromises()
    expect(loadAudioWaveformMock).toHaveBeenCalledTimes(1)
  })

  it('格式化语音时长为分:秒', async () => {
    const wrapper = mountComponent({ second: 65 })
    await flushPromises()

    expect(wrapper.find('.voice-second').text()).toBe('1:05')
  })

  it('时长不足一分钟时秒数补零', async () => {
    const wrapper = mountComponent({ second: 5 })
    await flushPromises()

    expect(wrapper.find('.voice-second').text()).toBe('0:05')
  })

  it('加载中时展示 loading 图标与 loading 样式', async () => {
    audioState.loading = true
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('.voice-container').classes()).toContain('loading')
    expect(wrapper.find('.loading-icon').exists()).toBe(true)
  })

  it('播放中时展示播放样式', async () => {
    audioState.isPlaying = true
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('.voice-container').classes()).toContain('playing')
  })

  it('当前用户消息使用反色图标', async () => {
    const wrapper = mountComponent({}, '@me:server.test')
    await flushPromises()

    expect(wrapper.find('.voice-second').attributes('style')).toContain('--tjg-text-inverse')
  })

  it('其他用户消息使用主文本色图标', async () => {
    const wrapper = mountComponent({}, '@other:server.test')
    await flushPromises()

    expect(wrapper.find('.voice-second').attributes('style')).toContain('--tjg-text-primary')
  })

  it('加密语音进入视口时下载解密，点击后才创建可播放地址', async () => {
    const encryptedFile = { url: 'mxc://server/enc', v: 'v2' }
    const wrapper = mountComponent({ encryptedFile })
    await flushPromises()

    expect(downloadEncryptedFileMock).toHaveBeenCalled()
    expect(getAudioUrlMock).not.toHaveBeenCalled()

    await wrapper.find('.voice-container').trigger('click')
    await flushPromises()

    expect(getAudioUrlMock).toHaveBeenCalledWith('/local/voice.webm')
    expect(createAudioElementMock).toHaveBeenCalledWith('blob:audio', 65)
  })

  it('卸载时清理播放与文件资源', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    wrapper.unmount()

    expect(playbackCleanupMock).toHaveBeenCalledTimes(1)
    expect(fileManagerCleanupMock).toHaveBeenCalledTimes(1)
  })
})
