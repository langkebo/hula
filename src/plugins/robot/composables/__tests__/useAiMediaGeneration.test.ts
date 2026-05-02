import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { AiMsgContentTypeEnum } from '@/enums'

const {
  aiServiceMock,
  errorMock,
  clearVideoImageMock,
  clearInputMock,
  pollImageStatusMock,
  pollVideoStatusMock,
  pollAudioStatusMock
} = vi.hoisted(() => ({
  aiServiceMock: {
    generateImage: vi.fn(),
    videoGenerate: vi.fn(),
    audioGenerate: vi.fn()
  },
  errorMock: vi.fn(),
  clearVideoImageMock: vi.fn(),
  clearInputMock: vi.fn(),
  pollImageStatusMock: vi.fn(),
  pollVideoStatusMock: vi.fn(),
  pollAudioStatusMock: vi.fn()
}))

vi.mock('@/services/matrix/ai/AIService', () => ({
  aiService: aiServiceMock
}))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: errorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}))

import { useAiMediaGeneration } from '../useAiMediaGeneration'

const createOptions = (conversationTokens = 0) => ({
  currentChat: ref({ id: 'chat-1' }),
  conversationTokens: ref(conversationTokens),
  messageList: ref([]),
  msgInputRef: ref({ clearInput: clearInputMock }),
  imageParams: ref({ size: '1024x1024' }),
  videoParams: ref({ size: '1280x720', duration: 5, image: 'https://cdn/example.png' }),
  audioParams: ref({ voice: 'alloy', speed: 1 }),
  bumpMessageRenderVersion: vi.fn(),
  clearVideoImage: clearVideoImageMock,
  pollImageStatus: pollImageStatusMock,
  pollVideoStatus: pollVideoStatusMock,
  pollAudioStatus: pollAudioStatusMock
})

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).$message = {
    create: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    destroyAll: vi.fn()
  }
})

describe('useAiMediaGeneration', () => {
  it('generates image and starts polling with placeholder messages', async () => {
    aiServiceMock.generateImage.mockResolvedValue({ id: 101 })
    const options = createOptions()
    const { generateImage } = useAiMediaGeneration(options)

    await generateImage('draw a mountain', {
      id: 'model-image',
      name: 'Flux',
      type: 2,
      maxTokens: 1000
    } as any)

    expect(options.messageList.value).toHaveLength(2)
    expect(options.messageList.value[0]).toMatchObject({
      type: 'user',
      content: 'draw a mountain',
      msgType: AiMsgContentTypeEnum.IMAGE
    })
    expect(options.messageList.value[1]).toMatchObject({
      type: 'assistant',
      content: '正在思考中...',
      msgType: AiMsgContentTypeEnum.IMAGE,
      isGenerating: true
    })
    expect(aiServiceMock.generateImage).toHaveBeenCalledWith({
      modelId: 'model-image',
      prompt: 'draw a mountain',
      width: 1024,
      height: 1024,
      conversationId: 'chat-1'
    })
    expect(pollImageStatusMock).toHaveBeenCalledWith(101, 1, 'draw a mountain', 1024, 1024, 'Flux')
    expect(options.bumpMessageRenderVersion).toHaveBeenCalledTimes(1)
    expect(clearInputMock).toHaveBeenCalledTimes(1)
  })

  it('generates video and clears uploaded image after starting polling', async () => {
    aiServiceMock.videoGenerate.mockResolvedValue('202')
    const options = createOptions()
    const { generateVideo } = useAiMediaGeneration(options)

    await generateVideo('animate the skyline', {
      id: 'model-video',
      name: 'Veo',
      type: 4,
      maxTokens: 1000
    } as any)

    expect(aiServiceMock.videoGenerate).toHaveBeenCalledWith({
      modelId: 'model-video',
      prompt: 'animate the skyline',
      width: 1280,
      height: 720,
      duration: 5,
      conversationId: 'chat-1',
      options: {
        image: 'https://cdn/example.png'
      }
    })
    expect(pollVideoStatusMock).toHaveBeenCalledWith(202, 1, 'animate the skyline', 1280, 720, 'Veo')
    expect(clearVideoImageMock).toHaveBeenCalledTimes(1)
    expect(clearInputMock).toHaveBeenCalledTimes(1)
  })

  it('generates audio with stringified speed and starts polling', async () => {
    aiServiceMock.audioGenerate.mockResolvedValue(303)
    const options = createOptions()
    const { generateAudio } = useAiMediaGeneration(options)

    await generateAudio('read this aloud', {
      id: 'model-audio',
      name: 'TTS',
      type: 3,
      maxTokens: 1000
    } as any)

    expect(aiServiceMock.audioGenerate).toHaveBeenCalledWith({
      modelId: 'model-audio',
      prompt: 'read this aloud',
      conversationId: 'chat-1',
      options: {
        voice: 'alloy',
        speed: '1'
      }
    })
    expect(pollAudioStatusMock).toHaveBeenCalledWith(303, 1, 'read this aloud', 'TTS')
    expect(clearInputMock).toHaveBeenCalledTimes(1)
  })

  it('skips media generation when token budget is exhausted', async () => {
    const options = createOptions(1000)
    const { generateImage } = useAiMediaGeneration(options)

    await generateImage('draw a mountain', {
      id: 'model-image',
      name: 'Flux',
      type: 2,
      maxTokens: 1000
    } as any)

    expect(window.$message.warning).toHaveBeenCalledWith('本会话 Token 已用完（1000），请新建会话或更换模型')
    expect(aiServiceMock.generateImage).not.toHaveBeenCalled()
    expect(options.messageList.value).toEqual([])
  })

  it('writes failure content back into the placeholder message', async () => {
    aiServiceMock.audioGenerate.mockRejectedValue(new Error('network down'))
    const options = createOptions()
    const { generateAudio } = useAiMediaGeneration(options)

    await generateAudio('read this aloud', {
      id: 'model-audio',
      name: 'TTS',
      type: 3,
      maxTokens: 1000
    } as any)

    expect(options.messageList.value[1]).toMatchObject({
      content: '音频生成失败: network down',
      isGenerating: false
    })
    expect(errorMock).toHaveBeenCalledWith('音频生成失败:', expect.any(Error))
    expect(window.$message.error).toHaveBeenCalledWith('音频生成失败，请检查网络连接')
    expect(pollAudioStatusMock).not.toHaveBeenCalled()
  })
})
