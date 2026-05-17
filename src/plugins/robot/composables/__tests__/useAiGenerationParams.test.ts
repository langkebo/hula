import type { UploadFileInfo } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIModel } from '@/services/matrix/ai/ModelService'
import type { VideoImageUploadPayload } from '../useAiGenerationParams'

const { aiServiceMock, uploadMock, fileInfoRef, errorMock, showFeedbackMock } = vi.hoisted(() => ({
  aiServiceMock: {
    audioGetVoices: vi.fn()
  },
  uploadMock: vi.fn(async () => undefined),
  fileInfoRef: { value: { downloadUrl: '' } },
  errorMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('@/services/matrix/ai/AIService', () => ({ aiService: aiServiceMock }))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: errorMock, warn: vi.fn(), debug: vi.fn() })
}))
vi.mock('@/hooks/useUpload', () => ({
  useUpload: () => ({ uploadFile: uploadMock, fileInfo: fileInfoRef }),
  UploadProviderEnum: { DEFAULT: 'default' }
}))
vi.mock('@/enums', () => ({ UploadSceneEnum: { CHAT: 'chat' } }))
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

import { useAiGenerationParams } from '../useAiGenerationParams'

const makeModel = (model = 'tts-1'): AIModel =>
  ({
    id: model,
    name: model,
    model,
    platform: 'test',
    type: 0,
    sort: 0,
    status: 1,
    publicStatus: 1
  }) as AIModel

const makeUploadPayload = (file: File, overrides: Partial<VideoImageUploadPayload> = {}): VideoImageUploadPayload => ({
  file: { file } as UploadFileInfo,
  onFinish: vi.fn(),
  onError: vi.fn(),
  ...overrides
})

const mountWith = <T>(setup: () => T): T => {
  let value!: T
  const Comp = {
    setup() {
      value = setup()
      return () => null
    }
  }
  const { createApp, h } = require('vue')
  const app = createApp({ render: () => h(Comp) })
  app.mount(document.createElement('div'))
  return value
}

beforeEach(() => {
  vi.clearAllMocks()
  fileInfoRef.value = { downloadUrl: 'https://cdn/x.png' }
})

describe('useAiGenerationParams', () => {
  it('initial state: defaults for image / video / audio params', () => {
    const c = mountWith(() => useAiGenerationParams())
    expect(c.imageParams.value.size).toBe('1024x1024')
    expect(c.videoParams.value).toEqual({ size: '1280x720', duration: 5, image: null })
    expect(c.audioParams.value).toEqual({ voice: 'alloy', speed: 1.0 })
    expect(c.audioVoiceOptions.value.length).toBeGreaterThan(0)
    expect(c.isUploadingVideoImage.value).toBe(false)
  })

  it('option arrays are pre-populated', () => {
    const c = mountWith(() => useAiGenerationParams())
    expect(c.imageSizeOptions.value).toHaveLength(3)
    expect(c.videoSizeOptions.value).toHaveLength(3)
    expect(c.videoDurationOptions.value).toHaveLength(2)
    expect(c.audioSpeedOptions.value).toHaveLength(6)
  })

  it('clearVideoImage resets image + preview + delegates to file ref', () => {
    const c = mountWith(() => useAiGenerationParams())
    c.videoParams.value.image = 'https://x/y.png'
    c.videoImagePreview.value = 'https://x/y.png'
    const clearMock = vi.fn()
    c.videoImageFileRef.value = { clear: clearMock }
    c.clearVideoImage()
    expect(c.videoParams.value.image).toBeNull()
    expect(c.videoImagePreview.value).toBeNull()
    expect(clearMock).toHaveBeenCalled()
  })

  it('clearVideoImage no-ops when fileRef has no clear method', () => {
    const c = mountWith(() => useAiGenerationParams())
    c.videoImageFileRef.value = {}
    expect(() => c.clearVideoImage()).not.toThrow()
  })

  it('loadAudioVoices populates from API response', async () => {
    aiServiceMock.audioGetVoices.mockResolvedValueOnce([{ name: 'tts-1:alice' }, { name: 'bob' }])
    const c = mountWith(() => useAiGenerationParams())
    await c.loadAudioVoices(makeModel('tts-1'))
    expect(c.audioVoiceOptions.value).toEqual([
      { label: 'Alice', value: 'tts-1:alice' },
      { label: 'Bob', value: 'bob' }
    ])
    expect(c.audioParams.value.voice).toBe('tts-1:alice')
  })

  it('loadAudioVoices falls back to Default when API returns empty', async () => {
    aiServiceMock.audioGetVoices.mockResolvedValueOnce([])
    const c = mountWith(() => useAiGenerationParams())
    await c.loadAudioVoices(makeModel('tts-1'))
    expect(c.audioVoiceOptions.value).toEqual([{ label: 'Default', value: 'default' }])
    expect(c.audioParams.value.voice).toBe('default')
  })

  it('loadAudioVoices early-exits for null / model-less input', async () => {
    const c = mountWith(() => useAiGenerationParams())
    await c.loadAudioVoices(null as unknown as AIModel)
    await c.loadAudioVoices({} as AIModel)
    expect(aiServiceMock.audioGetVoices).not.toHaveBeenCalled()
  })

  it('loadAudioVoices logs and swallows errors', async () => {
    aiServiceMock.audioGetVoices.mockRejectedValueOnce(new Error('boom'))
    const c = mountWith(() => useAiGenerationParams())
    await c.loadAudioVoices(makeModel('tts-1'))
    expect(errorMock).toHaveBeenCalled()
  })

  it('handleVideoImageUpload rejects unsupported MIME', async () => {
    const c = mountWith(() => useAiGenerationParams())
    const onError = vi.fn()
    const onFinish = vi.fn()
    await c.handleVideoImageUpload(
      makeUploadPayload(new File([], 'x.gif', { type: 'image/gif' }), {
        onError,
        onFinish
      })
    )
    expect(onError).toHaveBeenCalled()
    expect(onFinish).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('只支持 JPG、PNG、WEBP 格式的图片', 'error')
  })

  it('handleVideoImageUpload rejects oversized file', async () => {
    const c = mountWith(() => useAiGenerationParams())
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'x.png', { type: 'image/png' })
    const onError = vi.fn()
    await c.handleVideoImageUpload(makeUploadPayload(big, { onError, onFinish: vi.fn() }))
    expect(onError).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('图片大小不能超过 10MB', 'error')
  })

  it('handleVideoImageUpload happy path stores url on success', async () => {
    fileInfoRef.value = { downloadUrl: 'https://cdn/uploaded.png' }
    const c = mountWith(() => useAiGenerationParams())
    const onFinish = vi.fn()
    await c.handleVideoImageUpload(
      makeUploadPayload(new File([new Uint8Array(8)], 'a.png', { type: 'image/png' }), {
        onFinish,
        onError: vi.fn()
      })
    )
    expect(c.videoParams.value.image).toBe('https://cdn/uploaded.png')
    expect(c.videoImagePreview.value).toBe('https://cdn/uploaded.png')
    expect(onFinish).toHaveBeenCalled()
    expect(c.isUploadingVideoImage.value).toBe(false)
  })

  it('handleVideoImageUpload clears uploading flag even on upload error', async () => {
    uploadMock.mockRejectedValueOnce(new Error('net'))
    const c = mountWith(() => useAiGenerationParams())
    const onError = vi.fn()
    await c.handleVideoImageUpload(
      makeUploadPayload(new File([], 'a.png', { type: 'image/png' }), {
        onFinish: vi.fn(),
        onError
      })
    )
    expect(onError).toHaveBeenCalled()
    expect(c.isUploadingVideoImage.value).toBe(false)
  })
})
