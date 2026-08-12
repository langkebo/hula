import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import VoiceMessage from '../Voice.vue'

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
  useWaveformRenderer: () => ({
    waveformCanvas: ref(null),
    waveformWidth: ref(waveformState.waveformWidth),
    scanLinePosition: ref(waveformState.scanLinePosition),
    shouldUpdateCache: ref(false),
    drawWaveform: vi.fn(),
    drawWaveformThrottled: vi.fn(),
    drawWaveformImmediate: vi.fn(),
    generateWaveformData: vi.fn().mockResolvedValue(undefined)
  })
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
        body: { mxcUrl: 'mxc://server/voice', second: 65, ...body },
        fromUserUid
      } as never
    })

  it('挂载时加载波形并创建音频元素', async () => {
    mountComponent()
    await flushPromises()

    expect(loadAudioWaveformMock).toHaveBeenCalledWith('mxc://server/voice')
    expect(createAudioElementMock).toHaveBeenCalledWith('mxc://server/voice', 'mxc://server/voice', 65)
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

  it('点击容器切换播放状态', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    await wrapper.find('.voice-container').trigger('click')

    expect(togglePlaybackMock).toHaveBeenCalledTimes(1)
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

  it('加密语音挂载时走加密下载流程', async () => {
    const encryptedFile = { url: 'mxc://server/enc', v: 'v2' }
    mountComponent({ encryptedFile, mxcUrl: 'mxc://server/voice' })
    await flushPromises()

    expect(downloadEncryptedFileMock).toHaveBeenCalled()
    expect(getAudioUrlMock).toHaveBeenCalledWith('/local/voice.webm')
  })

  it('卸载时清理播放与文件资源', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    wrapper.unmount()

    expect(playbackCleanupMock).toHaveBeenCalledTimes(1)
    expect(fileManagerCleanupMock).toHaveBeenCalledTimes(1)
  })
})
