import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const {
  mittMock,
  userStoreMock,
  routerPushMock,
  infoMock,
  errorMock,
  conversationServiceMock,
  modelServiceMock,
  aiServiceMock,
  generateImageMock,
  generateVideoMock,
  generateAudioMock,
  stopAllPollingMock,
  stopConversationPollingMock,
  clearInputMock,
  loadSavedConfigMock,
  useAiGenerationParamsMock,
  useAiProviderConfigMock,
  useAiMediaCacheMock,
  useAiHistoryViewMock
} = vi.hoisted(() => {
  const clearInputMock = vi.fn()
  const generateImageMock = vi.fn()
  const generateVideoMock = vi.fn()
  const generateAudioMock = vi.fn()
  const stopAllPollingMock = vi.fn()
  const stopConversationPollingMock = vi.fn()
  const fetchModelListPageMock = vi.fn().mockResolvedValue({ list: [], total: 0 })
  const chatRolePageMock = vi.fn().mockResolvedValue({ list: [], total: 0 })

  return {
    mittMock: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    userStoreMock: { userInfo: { uid: 'u1', avatar: 'avatar.png' } },
    routerPushMock: vi.fn(),
    infoMock: vi.fn(),
    errorMock: vi.fn(),
    aiServiceMock: {
      chatRolePage: chatRolePageMock,
      getModelRemainingUsage: vi.fn().mockResolvedValue(9)
    },
    conversationServiceMock: {
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn()
    },
    modelServiceMock: {
      page: fetchModelListPageMock
    },
    generateImageMock,
    generateVideoMock,
    generateAudioMock,
    stopAllPollingMock,
    stopConversationPollingMock,
    clearInputMock,
    loadSavedConfigMock: vi.fn(),
    fetchModelListPageMock,
    chatRolePageMock,
    useAiGenerationParamsMock: vi.fn(() => ({
      imageParams: ref({ size: '1024x1024' }),
      imageSizeOptions: [],
      videoParams: ref({ size: '1280x720', duration: 5, image: null }),
      videoSizeOptions: [],
      videoDurationOptions: [],
      audioParams: ref({ voice: 'alloy', speed: 1 }),
      audioVoiceOptions: ref([]),
      audioSpeedOptions: [],
      videoImageFileRef: ref(null),
      videoImagePreview: ref(null),
      isUploadingVideoImage: ref(false),
      loadAudioVoices: vi.fn(),
      clearVideoImage: vi.fn(),
      handleVideoImageUpload: vi.fn()
    })),
    useAiProviderConfigMock: vi.fn(() => ({
      aiProvider: ref('hula'),
      siliconFlowConfig: ref({ apiKey: '', baseUrl: 'https://api.siliconflow.cn', model: '' }),
      trendRadarConfig: ref({ apiUrl: 'http://127.0.0.1:3333/mcp', apiKey: '' }),
      isSiliconFlowConnected: ref(false),
      isSiliconFlowConnecting: ref(false),
      siliconFlowModels: ref([]),
      siliconFlowCurrentModel: ref(null),
      siliconFlowError: ref(null),
      connectSiliconFlow: vi.fn(),
      testSiliconFlow: vi.fn(),
      sendSiliconFlowMessage: vi.fn(),
      isTrendRadarConnected: ref(false),
      setupTrendRadar: vi.fn(),
      trendRadarClient: ref(null),
      loadSavedConfig: vi.fn(),
      handleProviderChange: vi.fn()
    })),
    useAiMediaCacheMock: vi.fn(() => ({
      ensureLocalAiImage: vi.fn().mockResolvedValue(undefined),
      ensureLocalAiVideo: vi.fn().mockResolvedValue(undefined),
      ensureLocalAiAudio: vi.fn().mockResolvedValue(undefined)
    })),
    useAiHistoryViewMock: vi.fn(() => ({
      showHistoryModal: ref(false),
      historyType: ref('image'),
      historyLoading: ref(false),
      historyList: ref([]),
      historyPagination: ref({ pageNo: 1, pageSize: 12, total: 0 }),
      showImagePreview: ref(false),
      showVideoPreview: ref(false),
      previewItem: ref(null),
      loadHistory: vi.fn(),
      handleOpenHistory: vi.fn(),
      switchHistoryType: vi.fn(),
      handleHistoryPageChange: vi.fn(),
      handleImagePreview: vi.fn(),
      handlePreviewImage: vi.fn(),
      handlePreviewVideo: vi.fn()
    }))
  }
})

vi.mock('@/hooks/useMitt.ts', () => ({ useMitt: mittMock }))
vi.mock('@/stores/domains/user/user', () => ({ useUserStore: () => userStoreMock }))
vi.mock('@/plugins/robot/utils/tokenEstimator', () => ({ estimateMessageTokens: () => 0 }))
vi.mock('@/services/matrix', () => ({
  conversationService: conversationServiceMock,
  modelService: modelServiceMock
}))

vi.mock('@/services/matrix/ai/AIService', () => ({
  aiService: aiServiceMock
}))
vi.mock('@/router', () => ({ default: { push: routerPushMock } }))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: infoMock, error: errorMock, warn: vi.fn(), debug: vi.fn() })
}))
vi.mock('@/plugins/robot/composables/useAiGenerationParams', () => ({
  useAiGenerationParams: useAiGenerationParamsMock
}))
vi.mock('@/plugins/robot/composables/useAiProviderConfig', () => ({
  useAiProviderConfig: () => {
    const result = useAiProviderConfigMock()
    result.loadSavedConfig = loadSavedConfigMock
    return result
  }
}))
vi.mock('@/plugins/robot/composables/useAiMediaCache', () => ({
  useAiMediaCache: useAiMediaCacheMock
}))
vi.mock('@/plugins/robot/composables/useAiHistoryView', () => ({
  useAiHistoryView: useAiHistoryViewMock
}))
vi.mock('@/plugins/robot/composables/useAiGenerationPolling', () => ({
  useAiGenerationPolling: vi.fn(() => ({
    stopAllPolling: stopAllPollingMock,
    stopConversationPolling: stopConversationPollingMock,
    pollImageStatus: vi.fn(),
    pollVideoStatus: vi.fn(),
    pollAudioStatus: vi.fn()
  }))
}))
vi.mock('@/plugins/robot/composables/useAiMediaGeneration', () => ({
  useAiMediaGeneration: vi.fn(() => ({
    generateImage: generateImageMock,
    generateVideo: generateVideoMock,
    generateAudio: generateAudioMock
  }))
}))

import { useRobotChat } from '../useRobotChat'

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const mountWith = async () => {
  let value!: ReturnType<typeof useRobotChat>
  const Comp = {
    setup() {
      value = useRobotChat({
        msgInputRef: ref({ clearInput: clearInputMock })
      })
      return () => null
    }
  }

  const { createApp, h } = await import('vue')
  const app = createApp({ render: () => h(Comp) })
  const root = document.createElement('div')
  app.mount(root)
  await flushPromises()

  return {
    composable: value,
    unmount: () => app.unmount()
  }
}

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

describe('useRobotChat', () => {
  it('routes image generation through useAiMediaGeneration', async () => {
    const { composable, unmount } = await mountWith()
    composable.selectedModel.value = {
      id: 'model-image',
      name: 'Flux',
      type: 2,
      maxTokens: 1000
    } as any

    composable.handleSendAI({ content: 'draw a mountain' })
    await flushPromises()

    expect(generateImageMock).toHaveBeenCalledWith('draw a mountain', composable.selectedModel.value)
    unmount()
  })

  it('routes video generation through useAiMediaGeneration', async () => {
    const { composable, unmount } = await mountWith()
    composable.selectedModel.value = {
      id: 'model-video',
      name: 'Veo',
      type: 4,
      maxTokens: 1000
    } as any

    composable.handleSendAI({ content: 'animate the skyline' })
    await flushPromises()

    expect(generateVideoMock).toHaveBeenCalledWith('animate the skyline', composable.selectedModel.value)
    unmount()
  })

  it('routes audio generation through useAiMediaGeneration', async () => {
    const { composable, unmount } = await mountWith()
    composable.selectedModel.value = {
      id: 'model-audio',
      name: 'TTS',
      type: 3,
      maxTokens: 1000
    } as any

    composable.handleSendAI({ content: 'read this aloud' })
    await flushPromises()

    expect(generateAudioMock).toHaveBeenCalledWith('read this aloud', composable.selectedModel.value)
    unmount()
  })

  it('stops polling for the previous conversation when current chat changes', async () => {
    const { composable, unmount } = await mountWith()

    composable.currentChat.value.id = 'chat-1'
    await flushPromises()
    stopConversationPollingMock.mockClear()

    composable.currentChat.value.id = 'chat-2'
    await flushPromises()

    expect(stopConversationPollingMock).toHaveBeenCalledWith('chat-1')
    unmount()
  })

  it('stops all polling tasks on unmount', async () => {
    const { unmount } = await mountWith()

    unmount()

    expect(stopAllPollingMock).toHaveBeenCalledTimes(1)
  })
})
