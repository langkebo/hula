import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { convertFileSrc } from '@tauri-apps/api/core'
import { fetch as nativeFetch } from '@tauri-apps/plugin-http'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { matrixAIService, matrixMessageRelationService } from '@/services/matrix'
import { persistAiImageFile, resolveAiImagePath } from '@/utils/PathUtil'
import { md5FromString } from '@/utils/Md5Util'
import { createLogger } from '@/utils/Logger'
import { AiMsgContentTypeEnum, ThemeEnum } from '@/enums'
import { useOpenClaw } from '@/services/openclaw'
import { useSiliconFlow } from '@/services/siliconflow'
import { useTrendRadar } from '@/services/trendradar'

const logger = createLogger('useRobotChat')

export type AIProvider = 'hula' | 'openclaw' | 'siliconflow' | 'trendradar'

export interface Message {
  type: 'user' | 'assistant'
  content: string
  reasoningContent?: string
  streaming?: boolean
  createTime?: number
  id?: string
  replyId?: string | null
  model?: string
  isGenerating?: boolean
  msgType?: AiMsgContentTypeEnum
  imageUrl?: string
  imageInfo?: {
    prompt: string
    width: number
    height: number
    model: string
  }
  videoUrl?: string
  videoInfo?: {
    prompt: string
    width: number
    height: number
    model: string
  }
  audioUrl?: string
  audioInfo?: {
    prompt: string
    voice: string
    model: string
    speed: number
  }
}

export interface ChatInfo {
  id: string
  title: string
  messageCount: number
  createTime: number
}

export interface ModelInfo {
  id: string
  name: string
  description?: string
  platform?: string
  model?: string
  status: number
  type: number
  publicStatus?: number
  maxTokens?: number
  avatar?: string
}

export interface RoleInfo {
  id: string
  name: string
  description?: string
  avatar?: string
  status: number
}

const STORAGE_KEYS = {
  AI_PROVIDER: 'hula-chat-ai-provider',
  OPENCLAW_CONFIG: 'hula-chat-openclaw-config',
  TRENDRADAR_CONFIG: 'hula-chat-trendradar-config'
}

const MAX_MESSAGE_COUNT = 40
const MAX_MEDIA_CACHE_SIZE = 10

export function useRobotChat() {
  const settingStore = useSettingStore()
  const userStore = useUserStore()
  const { page, themes } = storeToRefs(settingStore)

  const openClawConfig = ref({
    gatewayUrl: 'http://127.0.0.1:18789',
    token: ''
  })

  const siliconFlowConfig = ref({
    apiKey: '',
    baseUrl: 'https://api.siliconflow.cn',
    model: 'deepseek-ai/DeepSeek-V3'
  })

  const trendRadarConfig = ref({
    apiUrl: 'http://127.0.0.1:3333/mcp',
    apiKey: ''
  })

  const aiProvider = ref<AIProvider>('openclaw')

  const {
    isConnected: isOpenClawConnected,
    availableModels: openClawModels,
    currentModel: openClawCurrentModel,
    connect: connectOpenClaw,
    sendMessage: sendOpenClawMessage
  } = useOpenClaw()

  const {
    isConnected: isSiliconFlowConnected,
    isConnecting: isSiliconFlowConnecting,
    availableModels: siliconFlowModels,
    currentModel: siliconFlowCurrentModel,
    error: siliconFlowError,
    connect: connectSiliconFlow,
    testConnection: testSiliconFlow,
    sendMessage: sendSiliconFlowMessage
  } = useSiliconFlow()

  const { isConnected: isTrendRadarConnected, setupTrendRadar, client: trendRadarClient } = useTrendRadar()

  const isAIStreaming = ref(false)
  const currentAiRequestId = ref<string | null>(null)
  const currentAiAccumulatedContent = ref('')
  const lastAiPrompt = ref('')

  const currentChat = ref<ChatInfo>({
    id: '0',
    title: '',
    messageCount: 0,
    createTime: 0
  })

  const messageList = ref<Message[]>([])
  const loadingMessages = ref(false)
  const shouldAutoStickBottom = ref(true)

  const remainingUsage = ref<number | null>(null)
  const serverTokenUsage = ref<number | null>(null)

  const selectedModel = ref<ModelInfo | null>(null)
  const selectedRole = ref<RoleInfo | null>(null)

  const isDarkTheme = computed(() => {
    const content = themes.value.content
    if (!content) {
      const datasetTheme = document.documentElement.dataset.theme
      return datasetTheme === ThemeEnum.DARK
    }
    return content === ThemeEnum.DARK
  })

  const remainingUsageDisplay = computed(() => {
    if (remainingUsage.value === null) return ''
    if (remainingUsage.value === -1) return '无限'
    return String(remainingUsage.value)
  })

  const remainingUsageTagType = computed(() => {
    if (remainingUsage.value === -1) return 'success'
    if ((remainingUsage.value || 0) > 0) return 'info'
    return 'error'
  })

  const estimateTokens = (text: string): number => {
    if (!text) return 0
    const chars = Array.from(text)
    const asciiChars = chars.filter((ch) => (ch.codePointAt(0) as number) <= 0x7f)
    const ascii = asciiChars.join('')
    const nonAsciiCount = chars.length - asciiChars.length
    const asciiWords = ascii.trim().split(/\s+/).filter(Boolean)
    const asciiTokens = asciiWords.reduce((acc, w) => acc + Math.ceil(w.length / 4), 0)
    const nonAsciiTokens = nonAsciiCount
    return asciiTokens + nonAsciiTokens
  }

  const estimateMessageTokens = (m: Message): number => {
    const base = estimateTokens(m.content || '')
    const reasoning = estimateTokens(m.reasoningContent || '')
    return base + reasoning
  }

  const conversationTokens = computed(() => {
    return messageList.value.reduce((sum: number, m: Message) => sum + estimateMessageTokens(m), 0)
  })

  const supportsReasoning = computed(() => {
    if (!selectedModel.value) return false
    const modelName = selectedModel.value.name?.toLowerCase() || ''
    return modelName.includes('deepseek') && modelName.includes('r')
  })

  const loadSavedConfig = () => {
    try {
      const savedProvider = localStorage.getItem(STORAGE_KEYS.AI_PROVIDER)
      if (savedProvider && ['hula', 'openclaw', 'siliconflow', 'trendradar'].includes(savedProvider)) {
        aiProvider.value = savedProvider as AIProvider
      }

      const savedOpenClawConfig = localStorage.getItem(STORAGE_KEYS.OPENCLAW_CONFIG)
      if (savedOpenClawConfig) {
        const parsed = JSON.parse(savedOpenClawConfig)
        if (parsed.gatewayUrl) openClawConfig.value.gatewayUrl = parsed.gatewayUrl
        if (parsed.token) openClawConfig.value.token = parsed.token
      }

      const savedTrendRadarConfig = localStorage.getItem(STORAGE_KEYS.TRENDRADAR_CONFIG)
      if (savedTrendRadarConfig) {
        const parsed = JSON.parse(savedTrendRadarConfig)
        if (parsed.apiUrl) trendRadarConfig.value.apiUrl = parsed.apiUrl
      }
    } catch (e) {
      logger.error('加载保存的配置失败:', e)
    }
  }

  const saveAiProvider = (provider: AIProvider) => {
    localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, provider)
  }

  const saveOpenClawConfig = () => {
    localStorage.setItem(STORAGE_KEYS.OPENCLAW_CONFIG, JSON.stringify(openClawConfig.value))
  }

  const saveTrendRadarConfig = () => {
    localStorage.setItem(STORAGE_KEYS.TRENDRADAR_CONFIG, JSON.stringify(trendRadarConfig.value))
  }

  watch(openClawConfig, saveOpenClawConfig, { deep: true })
  watch(trendRadarConfig, saveTrendRadarConfig, { deep: true })

  const loadRemainingUsage = async (modelId: string) => {
    if (!modelId) return
    remainingUsage.value = await matrixAIService.getModelRemainingUsage({ modelId })
  }

  const convertHttpDataToArrayBuffer = (rawData: unknown): ArrayBuffer => {
    if (rawData === null || rawData === undefined) {
      throw new Error('图片数据为空')
    }

    if (rawData instanceof ArrayBuffer) {
      return rawData
    }

    if (rawData instanceof Uint8Array) {
      return rawData.slice().buffer
    }

    if (ArrayBuffer.isView(rawData)) {
      const view = rawData as ArrayBufferView
      const copy = new Uint8Array(view.byteLength)
      copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
      return copy.buffer
    }

    if (Array.isArray(rawData)) {
      return Uint8Array.from(rawData).buffer
    }

    if (typeof rawData === 'object') {
      const maybeData = (rawData as { data?: number[] }).data
      if (Array.isArray(maybeData)) {
        return Uint8Array.from(maybeData).buffer
      }
    }

    if (typeof rawData === 'string') {
      const binaryString = atob(rawData)
      const len = binaryString.length
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      return bytes.buffer
    }

    throw new Error('无法解析图片数据')
  }

  const aiMediaDownloadTasks = new Map<string, Promise<ArrayBuffer>>()

  const requestAiMediaBuffer = (url: string): Promise<ArrayBuffer> => {
    if (!url) {
      return Promise.reject(new Error('图片地址无效'))
    }

    const existingTask = aiMediaDownloadTasks.get(url)
    if (existingTask) {
      return existingTask
    }

    if (aiMediaDownloadTasks.size >= MAX_MEDIA_CACHE_SIZE) {
      const firstKey = aiMediaDownloadTasks.keys().next().value
      if (firstKey) {
        aiMediaDownloadTasks.delete(firstKey)
      }
    }

    const downloadTask = (async () => {
      const response = await nativeFetch(url, {
        method: 'GET'
      })

      const anyResponse = response as unknown as Record<string, unknown>
      const status = typeof anyResponse.status === 'number' ? anyResponse.status : 200
      const statusText = typeof anyResponse.statusText === 'string' ? anyResponse.statusText : ''
      const ok = 'ok' in anyResponse ? Boolean(anyResponse.ok) : status >= 200 && status < 400

      if (!ok) {
        throw new Error(`下载失败: ${status} ${statusText}`.trim())
      }

      if (typeof (anyResponse as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === 'function') {
        const buffer = await (anyResponse as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
        if (buffer instanceof ArrayBuffer) {
          return buffer
        }
      }

      if (typeof (anyResponse as { bytes?: () => Promise<unknown> }).bytes === 'function') {
        const bytes = await (anyResponse as { bytes: () => Promise<unknown> }).bytes()
        return convertHttpDataToArrayBuffer(bytes)
      }

      if ('data' in anyResponse) {
        return convertHttpDataToArrayBuffer(anyResponse.data)
      }

      throw new Error('无法解析图片数据')
    })().finally(() => {
      aiMediaDownloadTasks.delete(url)
    })

    aiMediaDownloadTasks.set(url, downloadTask)
    return downloadTask
  }

  const getAiMediaExtension = (url: string, fallback = 'png'): string => {
    const cleanUrl = url.split(/[?#]/)[0] || ''
    const ext = cleanUrl.split('.').pop() || ''
    if (!ext || ext.length > 5 || ext.includes('/')) return fallback
    return ext
  }

  const buildAiMediaFileName = async (url: string, fallbackExt: string, prefix: string): Promise<string> => {
    const ext = getAiMediaExtension(url, fallbackExt)
    try {
      const hash = await md5FromString(url)
      return `${prefix}-${hash}.${ext}`
    } catch (error) {
      logger.error('生成 AI 媒体文件名失败:', error)
      return `${prefix}-${Date.now()}.${ext}`
    }
  }

  const ensureLocalAiMedia = async (
    remoteUrl: string,
    messageIndex: number,
    mediaType: 'image' | 'video' | 'audio'
  ): Promise<void> => {
    if (!remoteUrl || !userStore.userInfo?.uid || !currentChat.value.id) return
    const targetMessage = messageList.value[messageIndex]
    if (!targetMessage || targetMessage.type !== 'assistant') return

    const mediaKey = mediaType === 'image' ? 'imageUrl' : mediaType === 'video' ? 'videoUrl' : 'audioUrl'
    const isSameMedia = targetMessage[mediaKey]
      ? targetMessage[mediaKey] === remoteUrl
      : targetMessage.content === remoteUrl
    if (!isSameMedia) return

    try {
      const fallbackExt = mediaType === 'image' ? 'png' : mediaType === 'video' ? 'mp4' : 'mp3'
      const prefix = `ai-${mediaType}`
      const fileName = await buildAiMediaFileName(remoteUrl, fallbackExt, prefix)

      const existsResult = await resolveAiImagePath({
        userUid: userStore.userInfo.uid,
        conversationId: currentChat.value.id,
        fileName
      })

      let absolutePath = existsResult.absolutePath
      if (!existsResult.exists) {
        const buffer = await requestAiMediaBuffer(remoteUrl)
        const data = new Uint8Array(buffer)
        const saved = await persistAiImageFile({
          userUid: userStore.userInfo.uid,
          conversationId: currentChat.value.id,
          fileName,
          data
        })
        absolutePath = saved.absolutePath
      }

      if (messageList.value[messageIndex]) {
        const displayUrl = convertFileSrc(absolutePath)
        messageList.value[messageIndex].content = displayUrl
        ;(messageList.value[messageIndex] as Record<string, unknown>)[mediaKey] = remoteUrl
      }
    } catch (error) {
      logger.error(`AI ${mediaType}本地化失败:`, error)
    }
  }

  const handleProviderChange = (provider: AIProvider) => {
    aiProvider.value = provider
    saveAiProvider(provider)
  }

  const selectModel = (model: ModelInfo) => {
    selectedModel.value = model
    loadRemainingUsage(model.id)
  }

  const selectRole = (role: RoleInfo | null) => {
    selectedRole.value = role
  }

  const addMessage = (message: Message) => {
    messageList.value.push(message)
    if (messageList.value.length > MAX_MESSAGE_COUNT) {
      messageList.value.shift()
    }
  }

  const updateMessage = (index: number, updates: Partial<Message>) => {
    if (messageList.value[index]) {
      Object.assign(messageList.value[index], updates)
    }
  }

  const deleteMessage = async (messageId: string, index: number) => {
    if (messageId) {
      try {
        await matrixMessageRelationService.deleteMessage('', messageId)
      } catch (e) {
        logger.error('删除消息失败:', e)
      }
    }
    messageList.value.splice(index, 1)
  }

  const clearMessages = () => {
    messageList.value = []
  }

  const setCurrentChat = (chat: ChatInfo) => {
    currentChat.value = chat
  }

  const getMessageBubbleClass = (message: Message): string[] => {
    const classes = ['bubble']
    if (message.type === 'user') {
      classes.push('bubble-user')
    } else {
      classes.push('bubble-ai')
    }
    return classes
  }

  const isRenderableAiImage = (message: Message): boolean => {
    if (!message.content) return false
    return message.content.startsWith('http') || message.content.startsWith('asset://')
  }

  const isLikelyMediaUrl = (content: string): boolean => {
    if (!content) return false
    return content.startsWith('http') || content.startsWith('asset://')
  }

  const getAiPlaceholderText = (message: Message): string => {
    if (message.isGenerating) return '生成中...'
    if (!message.content) return '内容加载失败'
    return message.content
  }

  const getDefaultAvatar = (): string => {
    return '/logoD.png'
  }

  const getModelAvatar = (model: ModelInfo | null): string => {
    if (model?.avatar) return model.avatar
    return getDefaultAvatar()
  }

  return {
    openClawConfig,
    siliconFlowConfig,
    trendRadarConfig,
    aiProvider,
    isOpenClawConnected,
    openClawModels,
    openClawCurrentModel,
    connectOpenClaw,
    sendOpenClawMessage,
    isSiliconFlowConnected,
    isSiliconFlowConnecting,
    siliconFlowModels,
    siliconFlowCurrentModel,
    siliconFlowError,
    connectSiliconFlow,
    testSiliconFlow,
    sendSiliconFlowMessage,
    isTrendRadarConnected,
    setupTrendRadar,
    trendRadarClient,
    isAIStreaming,
    currentAiRequestId,
    currentAiAccumulatedContent,
    lastAiPrompt,
    currentChat,
    messageList,
    loadingMessages,
    shouldAutoStickBottom,
    remainingUsage,
    serverTokenUsage,
    selectedModel,
    selectedRole,
    isDarkTheme,
    remainingUsageDisplay,
    remainingUsageTagType,
    conversationTokens,
    supportsReasoning,
    page,
    loadSavedConfig,
    saveAiProvider,
    loadRemainingUsage,
    handleProviderChange,
    selectModel,
    selectRole,
    addMessage,
    updateMessage,
    deleteMessage,
    clearMessages,
    setCurrentChat,
    ensureLocalAiMedia,
    getMessageBubbleClass,
    isRenderableAiImage,
    isLikelyMediaUrl,
    getAiPlaceholderText,
    getDefaultAvatar,
    getModelAvatar
  }
}
