import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { AiMsgContentTypeEnum } from '@/enums'
import type { Message } from '../useRobotChat'

const { aiServiceMock, errorMock, showFeedbackMock } = vi.hoisted(() => ({
  aiServiceMock: {
    imageMyListByIds: vi.fn(),
    videoMyListByIds: vi.fn(),
    audioMyListByIds: vi.fn()
  },
  errorMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('@/services/matrix/ai/AIService', () => ({ aiService: aiServiceMock }))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: errorMock, warn: vi.fn(), debug: vi.fn() })
}))
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

import { useAiGenerationPolling } from '../useAiGenerationPolling'

const createMessageList = () =>
  ref<Message[]>([
    {
      type: 'assistant',
      content: '正在思考中...',
      msgType: AiMsgContentTypeEnum.TEXT,
      createTime: Date.now(),
      isGenerating: true
    }
  ])

describe('useAiGenerationPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-25T00:00:00Z'))
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pollImageStatus updates image message and bumps render version on success', async () => {
    aiServiceMock.imageMyListByIds.mockResolvedValue([
      {
        status: 20,
        picUrl: 'https://cdn/image.png',
        url: 'https://cdn/image.png'
      }
    ])
    const messageList = createMessageList()
    const ensureLocalAiImage = vi.fn().mockResolvedValue(undefined)
    const bumpMessageRenderVersion = vi.fn()
    const polling = useAiGenerationPolling({
      currentChat: ref({ id: 'chat-1' }),
      messageList,
      bumpMessageRenderVersion,
      ensureLocalAiImage,
      ensureLocalAiVideo: vi.fn().mockResolvedValue(undefined),
      ensureLocalAiAudio: vi.fn().mockResolvedValue(undefined),
      getCurrentAudioInfo: () => ({ voice: 'alloy', speed: 1 })
    })

    await polling.pollImageStatus(11, 0, 'sunrise', 1024, 768, 'flux')

    expect(aiServiceMock.imageMyListByIds).toHaveBeenCalledWith({ ids: '11' })
    expect(messageList.value[0]).toMatchObject({
      type: 'assistant',
      content: 'https://cdn/image.png',
      msgType: AiMsgContentTypeEnum.IMAGE,
      imageUrl: 'https://cdn/image.png',
      isGenerating: false,
      imageInfo: {
        prompt: 'sunrise',
        width: 1024,
        height: 768,
        model: 'flux'
      }
    })
    expect(ensureLocalAiImage).toHaveBeenCalledWith('https://cdn/image.png', 0)
    expect(bumpMessageRenderVersion).toHaveBeenCalledTimes(1)
    expect(showFeedbackMock).toHaveBeenCalledWith('图片生成成功', 'success')
  })

  it('pollVideoStatus writes failure content and stops polling on failed status', async () => {
    aiServiceMock.videoMyListByIds.mockResolvedValue([
      {
        status: 30,
        errorMessage: 'quota exceeded'
      }
    ])
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const messageList = createMessageList()
    const polling = useAiGenerationPolling({
      currentChat: ref({ id: 'chat-1' }),
      messageList,
      bumpMessageRenderVersion: vi.fn(),
      ensureLocalAiImage: vi.fn().mockResolvedValue(undefined),
      ensureLocalAiVideo: vi.fn().mockResolvedValue(undefined),
      ensureLocalAiAudio: vi.fn().mockResolvedValue(undefined),
      getCurrentAudioInfo: () => ({ voice: 'alloy', speed: 1 })
    })

    await polling.pollVideoStatus(12, 0, 'city', 1280, 720, 'veo')

    expect(messageList.value[0].content).toBe('视频生成失败: quota exceeded')
    expect(messageList.value[0].isGenerating).toBe(false)
    expect(showFeedbackMock).toHaveBeenCalledWith('视频生成失败', 'error')
    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it('pollAudioStatus keeps audio metadata from current options on success', async () => {
    aiServiceMock.audioMyListByIds.mockResolvedValue([
      {
        status: 20,
        audioUrl: 'https://cdn/audio.mp3',
        url: 'https://cdn/audio.mp3'
      }
    ])
    const messageList = createMessageList()
    const ensureLocalAiAudio = vi.fn().mockResolvedValue(undefined)
    const polling = useAiGenerationPolling({
      currentChat: ref({ id: 'chat-2' }),
      messageList,
      bumpMessageRenderVersion: vi.fn(),
      ensureLocalAiImage: vi.fn().mockResolvedValue(undefined),
      ensureLocalAiVideo: vi.fn().mockResolvedValue(undefined),
      ensureLocalAiAudio,
      getCurrentAudioInfo: () => ({ voice: 'nova', speed: 1.25 })
    })

    await polling.pollAudioStatus(13, 0, 'read this', 'tts-1')

    expect(messageList.value[0]).toMatchObject({
      content: 'https://cdn/audio.mp3',
      msgType: AiMsgContentTypeEnum.AUDIO,
      audioUrl: 'https://cdn/audio.mp3',
      isGenerating: false,
      audioInfo: {
        prompt: 'read this',
        model: 'tts-1',
        voice: 'nova',
        speed: 1.25
      }
    })
    expect(ensureLocalAiAudio).toHaveBeenCalledWith('https://cdn/audio.mp3', 0)
    expect(showFeedbackMock).toHaveBeenCalledWith('音频生成成功', 'success')
  })

  it('pollImageStatus marks timeout after max duration and warns user', async () => {
    aiServiceMock.imageMyListByIds.mockResolvedValue([{ status: 10 }])
    const messageList = createMessageList()
    const polling = useAiGenerationPolling({
      currentChat: ref({ id: 'chat-timeout' }),
      messageList,
      bumpMessageRenderVersion: vi.fn(),
      ensureLocalAiImage: vi.fn().mockResolvedValue(undefined),
      ensureLocalAiVideo: vi.fn().mockResolvedValue(undefined),
      ensureLocalAiAudio: vi.fn().mockResolvedValue(undefined),
      getCurrentAudioInfo: () => ({ voice: 'alloy', speed: 1 })
    })

    await polling.pollImageStatus(14, 0, 'forest', 512, 512, 'flux')
    vi.setSystemTime(new Date('2026-04-25T00:05:01Z'))
    await vi.advanceTimersByTimeAsync(3000)

    expect(messageList.value[0].content).toBe('图片生成超时，请重试')
    expect(messageList.value[0].isGenerating).toBe(false)
    expect(showFeedbackMock).toHaveBeenCalledWith('图片生成超时，已停止轮询', 'warning')
  })

  it('pollAudioStatus writes query failure when polling request throws', async () => {
    aiServiceMock.audioMyListByIds.mockRejectedValue(new Error('network down'))
    const messageList = createMessageList()
    const polling = useAiGenerationPolling({
      currentChat: ref({ id: 'chat-error' }),
      messageList,
      bumpMessageRenderVersion: vi.fn(),
      ensureLocalAiImage: vi.fn().mockResolvedValue(undefined),
      ensureLocalAiVideo: vi.fn().mockResolvedValue(undefined),
      ensureLocalAiAudio: vi.fn().mockResolvedValue(undefined),
      getCurrentAudioInfo: () => ({ voice: 'alloy', speed: 1 })
    })

    await polling.pollAudioStatus(15, 0, 'voice', 'tts')

    expect(messageList.value[0].content).toBe('查询状态失败: network down')
    expect(messageList.value[0].isGenerating).toBe(false)
    expect(errorMock).toHaveBeenCalled()
  })

  it('pollVideoStatus marks missing record when API returns an empty list', async () => {
    aiServiceMock.videoMyListByIds.mockResolvedValue([])
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const messageList = createMessageList()
    const polling = useAiGenerationPolling({
      currentChat: ref({ id: 'chat-missing' }),
      messageList,
      bumpMessageRenderVersion: vi.fn(),
      ensureLocalAiImage: vi.fn().mockResolvedValue(undefined),
      ensureLocalAiVideo: vi.fn().mockResolvedValue(undefined),
      ensureLocalAiAudio: vi.fn().mockResolvedValue(undefined),
      getCurrentAudioInfo: () => ({ voice: 'alloy', speed: 1 })
    })

    await polling.pollVideoStatus(16, 0, 'missing record', 1280, 720, 'veo')

    expect(messageList.value[0].content).toBe('视频生成失败: 记录不存在')
    expect(messageList.value[0].isGenerating).toBe(false)
    expect(clearIntervalSpy).toHaveBeenCalled()
    expect(showFeedbackMock).not.toHaveBeenCalled()
  })

  it('pollImageStatus keeps polling while record stays in pending status', async () => {
    aiServiceMock.imageMyListByIds.mockResolvedValueOnce([{ status: 10 }]).mockResolvedValueOnce([
      {
        status: 20,
        picUrl: 'https://cdn/final-image.png',
        url: 'https://cdn/final-image.png'
      }
    ])
    const messageList = createMessageList()
    const ensureLocalAiImage = vi.fn().mockResolvedValue(undefined)
    const bumpMessageRenderVersion = vi.fn()
    const polling = useAiGenerationPolling({
      currentChat: ref({ id: 'chat-pending' }),
      messageList,
      bumpMessageRenderVersion,
      ensureLocalAiImage,
      ensureLocalAiVideo: vi.fn().mockResolvedValue(undefined),
      ensureLocalAiAudio: vi.fn().mockResolvedValue(undefined),
      getCurrentAudioInfo: () => ({ voice: 'alloy', speed: 1 })
    })

    await polling.pollImageStatus(17, 0, 'pending image', 1024, 1024, 'flux')
    expect(messageList.value[0].content).toBe('正在思考中...')
    expect(messageList.value[0].isGenerating).toBe(true)
    expect(showFeedbackMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3000)

    expect(aiServiceMock.imageMyListByIds).toHaveBeenCalledTimes(2)
    expect(messageList.value[0]).toMatchObject({
      content: 'https://cdn/final-image.png',
      msgType: AiMsgContentTypeEnum.IMAGE,
      imageUrl: 'https://cdn/final-image.png',
      isGenerating: false
    })
    expect(ensureLocalAiImage).toHaveBeenCalledWith('https://cdn/final-image.png', 0)
    expect(bumpMessageRenderVersion).toHaveBeenCalledTimes(1)
    expect(showFeedbackMock).toHaveBeenCalledWith('图片生成成功', 'success')
  })
})
