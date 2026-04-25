import { type InputInst, type UploadFileInfo } from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { useMitt } from '@/hooks/useMitt.ts'
import { useUserStore } from '@/stores/domains/user/user'
import { estimateMessageTokens } from '@/plugins/robot/utils/tokenEstimator'
import { AiMsgContentTypeEnum } from '@/enums'
import type { AIModel, ChatRole } from '@/services/matrix'
import { aiService, conversationService, modelService } from '@/services/matrix'
import type { AIAsyncGenerationResponse, AIConversation, VideoGenerationRequest } from '@/services/matrix/ai/AIService'
import type { AIAudio, AIImage, AIVideo, AIVoice } from '@/types/matrix-api'
import router from '@/router'
import { useUpload, UploadProviderEnum } from '@/hooks/useUpload'
import { UploadSceneEnum } from '@/enums'
import { createLogger } from '@/utils/Logger'
import { useAiProviderConfig } from '@/plugins/robot/composables/useAiProviderConfig'
import { useAiMediaCache } from '@/plugins/robot/composables/useAiMediaCache'
import { useAiHistoryView } from '@/plugins/robot/composables/useAiHistoryView'

const logger = createLogger('RobotChat')
const AI_THINKING_PLACEHOLDER = '正在思考中...'
const MAX_MESSAGE_COUNT = 40
const MAX_POLL_DURATION = 5 * 60 * 1000

export interface ConversationMeta {
  id: string
  title: string
  messageCount: number
  createTime: number
}

interface ConversationUsage extends AIConversation {
  tokenUsage?: number
}

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

interface AIConversationMessage {
  id?: string
  type?: 'user' | 'assistant'
  role?: 'user' | 'assistant' | 'system'
  content?: string
  reasoningContent?: string
  msgType?: AiMsgContentTypeEnum
  createTime?: number
  createdAt?: number
  replyId?: string | null
  model?: string
  imageUrl?: string
  videoUrl?: string
  audioUrl?: string
}

export type HistoryItem = (AIImage | AIVideo | AIAudio) & {
  prompt?: string
  picUrl?: string
  audioUrl?: string
  videoUrl?: string
  width?: number
  height?: number
}

export type PreviewItem = Partial<HistoryItem> & {
  picUrl?: string
}

interface LeftChatTitlePayload {
  title?: string
  id: string
  messageCount?: number
  createTime?: number
}

interface ChatActivePayload extends LeftChatTitlePayload {
  roleId?: string
  modelId?: string
}

export interface PaginationState {
  pageNo: number
  pageSize: number
  total: number
}

export interface UseRobotChatOptions {
  msgInputRef: Ref<{ clearInput?: () => void } | undefined>
}

const extractGenerationTaskId = (result: AIAsyncGenerationResponse): number => {
  if (typeof result === 'number') return result
  if (typeof result === 'string') return Number(result)
  return Number(result.id)
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return '未知错误'
}

const toAiMsgContentType = (value: unknown): AiMsgContentTypeEnum | undefined => {
  if (typeof value === 'number' && Object.values(AiMsgContentTypeEnum).includes(value)) {
    return value as AiMsgContentTypeEnum
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isInteger(parsed) && Object.values(AiMsgContentTypeEnum).includes(parsed)) {
      return parsed as AiMsgContentTypeEnum
    }
  }
  return undefined
}

const isLikelyImageUrl = (value?: string) => {
  if (!value) return false
  const lower = value.toLowerCase()
  return (
    /^https?:\/\//.test(value) ||
    lower.startsWith('data:image/') ||
    lower.startsWith('asset:') ||
    lower.startsWith('file:') ||
    lower.startsWith('tauri://') ||
    lower.startsWith('blob:')
  )
}

const isLikelyMediaUrl = (value?: string) => {
  if (!value) return false
  const lower = value.toLowerCase()
  return (
    /^https?:\/\//.test(value) ||
    lower.startsWith('data:') ||
    lower.startsWith('asset:') ||
    lower.startsWith('file:') ||
    lower.startsWith('tauri://') ||
    lower.startsWith('blob:')
  )
}

export const useRobotChat = (options: UseRobotChatOptions) => {
  const { msgInputRef } = options
  const userStore = useUserStore()

  const inputInstRef = ref<InputInst | null>(null)
  const isEdit = ref(false)
  const originalTitle = ref('')

  const isAIStreaming = ref(false)
  const currentAiRequestId = ref<string | null>(null)
  const currentAiAccumulatedContent = ref('')
  const lastAiPrompt = ref('')
  const currentChat = ref<ConversationMeta>({
    id: '0',
    title: '',
    messageCount: 0,
    createTime: 0
  })

  const remainingUsage = ref<number | null>(null)
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

  const messageList = ref<Message[]>([])
  const loadingMessages = ref(false)
  const messageRenderVersion = ref(0)
  const serverTokenUsage = ref<number | null>(null)
  const conversationTokens = computed(() => messageList.value.reduce((sum, item) => sum + estimateMessageTokens(item), 0))

  const showDeleteChatConfirm = ref(false)
  const deleteWithMessages = ref(false)

  const showRolePopover = ref(false)
  const selectedRole = ref<ChatRole | null>(null)
  const roleList = ref<ChatRole[]>([])
  const roleLoading = ref(false)

  const showModelPopover = ref(false)
  const modelLoading = ref(false)
  const modelSearch = ref('')
  const selectedModel = ref<AIModel | null>(null)
  const reasoningEnabled = ref(false)
  const supportsReasoning = computed(() => Boolean(selectedModel.value?.supportsReasoning))
  const modelPagination = ref<PaginationState>({
    pageNo: 1,
    pageSize: 10,
    total: 0
  })
  const modelList = ref<AIModel[]>([])
  const filteredModels = computed(() => {
    const search = modelSearch.value?.toLowerCase() || ''
    const filtered = search
      ? modelList.value.filter(
          (model) =>
            model.name?.toLowerCase().includes(search) ||
            model.description?.toLowerCase().includes(search) ||
            model.platform?.toLowerCase().includes(search)
        )
      : modelList.value.slice()

    return filtered.sort((a, b) => {
      const aOfficial = a.publicStatus === 0
      const bOfficial = b.publicStatus === 0
      if (aOfficial !== bOfficial) return aOfficial ? -1 : 1
      const aSort = a.sort ?? 0
      const bSort = b.sort ?? 0
      if (aSort !== bSort) return aSort - bSort
      return String(a.name || '').localeCompare(String(b.name || ''))
    })
  })
  const officialModels = computed(() => filteredModels.value.filter((item) => item.publicStatus === 0))
  const userModels = computed(() => filteredModels.value.filter((item) => item.publicStatus !== 0))

  const imageParams = ref({
    size: '1024x1024'
  })
  const imageSizeOptions = [
    { label: '1024x1024 (正方形)', value: '1024x1024' },
    { label: '1024x1792 (竖屏)', value: '1024x1792' },
    { label: '1792x1024 (横屏)', value: '1792x1024' }
  ]

  const videoParams = ref({
    size: '1280x720',
    duration: 5,
    image: null as string | null
  })
  const videoSizeOptions = [
    { label: '1280x720 (横屏)', value: '1280x720' },
    { label: '720x1280 (竖屏)', value: '720x1280' },
    { label: '960x960 (正方形)', value: '960x960' }
  ]
  const videoDurationOptions = [
    { label: '5秒', value: 5 },
    { label: '10秒', value: 10 }
  ]

  const audioParams = ref({
    voice: 'alloy',
    speed: 1.0
  })
  const audioVoiceOptions = ref([
    { label: 'Alloy (中性)', value: 'alloy' },
    { label: 'Echo (男性)', value: 'echo' },
    { label: 'Fable (男性)', value: 'fable' },
    { label: 'Onyx (男性)', value: 'onyx' },
    { label: 'Nova (女性)', value: 'nova' },
    { label: 'Shimmer (女性)', value: 'shimmer' }
  ])
  const audioSpeedOptions = [
    { label: '0.5x (慢速)', value: 0.5 },
    { label: '0.75x', value: 0.75 },
    { label: '1.0x (正常)', value: 1.0 },
    { label: '1.25x', value: 1.25 },
    { label: '1.5x (快速)', value: 1.5 },
    { label: '2.0x (极快)', value: 2.0 }
  ]

  const videoImageFileRef = ref<{ clear?: () => void } | null>(null)
  const videoImagePreview = ref<string | null>(null)
  const isUploadingVideoImage = ref(false)
  const { uploadFile: uploadReferenceImage, fileInfo } = useUpload()

  const pollingTasks = new Map<number, { timerId: number; conversationId: string; startedAt: number }>()

  const features = ref([
    { icon: 'model', label: '模型' },
    { icon: 'voice', label: '语音输入' },
    { icon: 'plugins2', label: '插件' }
  ])
  const otherFeatures = computed(() => features.value.filter((item) => item.icon !== 'model'))

  const userUid = computed(() => userStore.userInfo?.uid)
  const userAvatar = computed(() => userStore.userInfo?.avatar || '')

  const fetchModelList = async () => {
    modelLoading.value = true
    try {
      const data = await modelService.page({
        pageNo: modelPagination.value.pageNo,
        pageSize: modelPagination.value.pageSize
      })
      modelList.value = data.list || []
      modelPagination.value.total = data.total || 0
    } catch (error) {
      logger.error('获取模型列表失败:', error)
      window.$message.error('获取模型列表失败')
    } finally {
      modelLoading.value = false
    }
  }

  const {
    aiProvider,
    openClawConfig,
    isOpenClawConnected,
    openClawModels,
    openClawCurrentModel,
    connectOpenClaw,
    sendOpenClawMessage,
    loadSavedConfig,
    handleProviderChange
  } = useAiProviderConfig({
    fetchModelList,
    modelList
  })

  const { ensureLocalAiImage, ensureLocalAiVideo, ensureLocalAiAudio } = useAiMediaCache({
    messageList,
    currentChat,
    userUid
  })

  const {
    showHistoryModal,
    historyType,
    historyLoading,
    historyList,
    historyPagination,
    showImagePreview,
    showVideoPreview,
    previewItem,
    loadHistory,
    handleOpenHistory,
    switchHistoryType,
    handleHistoryPageChange,
    handleImagePreview,
    handlePreviewImage,
    handlePreviewVideo
  } = useAiHistoryView({ selectedModel })

  const bumpMessageRenderVersion = () => {
    messageRenderVersion.value += 1
  }

  const loadRemainingUsage = async (modelId: string) => {
    if (!modelId) return
    remainingUsage.value = await aiService.getModelRemainingUsage({ modelId })
  }

  const getDefaultAvatar = () => 'https://img1.baidu.com/it/u=3613958228,3522035000&fm=253&fmt=auto&app=120&f=JPEG?w=500&h=500'

  const getModelAvatar = (model: AIModel | null) => {
    if (!model) return getDefaultAvatar()
    if (model.avatar) return model.avatar
    return getDefaultAvatar()
  }

  const notifyConversationMetaChange = (payload: { messageCount?: number; createTime: number }) => {
    if (!currentChat.value.id || currentChat.value.id === '0') {
      return
    }

    if (payload.messageCount !== undefined) {
      currentChat.value.messageCount = payload.messageCount
    }

    const resolvedCreateTime =
      typeof payload.createTime === 'number' && Number.isFinite(payload.createTime)
        ? payload.createTime
        : currentChat.value.createTime || Date.now()
    currentChat.value.createTime = resolvedCreateTime

    useMitt.emit('update-chat-meta', {
      id: currentChat.value.id,
      messageCount: currentChat.value.messageCount,
      createTime: resolvedCreateTime
    })
  }

  const loadAudioVoices = async (model: AIModel) => {
    try {
      if (!model || !model.model) return

      const voices = await aiService.audioGetVoices({ model: model.model })
      if (voices && voices.length > 0) {
        audioVoiceOptions.value = voices.map((voice: AIVoice | string) => {
          const rawVoice = typeof voice === 'string' ? voice : voice.name
          const voiceName = rawVoice.includes(':') ? rawVoice.split(':')[1] : rawVoice
          return {
            label: voiceName.charAt(0).toUpperCase() + voiceName.slice(1),
            value: rawVoice
          }
        })
        if (audioVoiceOptions.value.length > 0) {
          audioParams.value.voice = audioVoiceOptions.value[0].value
        }
      } else {
        audioVoiceOptions.value = [{ label: 'Default', value: 'default' }]
        audioParams.value.voice = 'default'
      }
    } catch (error) {
      logger.error('加载声音列表失败:', error)
    }
  }

  const clearVideoImage = () => {
    videoParams.value.image = null
    videoImagePreview.value = null
    videoImageFileRef.value?.clear?.()
  }

  const handleVideoImageUpload = async (payload: {
    file: UploadFileInfo
    onFinish: () => void
    onError: () => void
  }) => {
    const file = payload.file.file as File
    if (!file) {
      payload.onError()
      return
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      window.$message.error('只支持 JPG、PNG、WEBP 格式的图片')
      payload.onError()
      return
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      window.$message.error('图片大小不能超过 10MB')
      payload.onError()
      return
    }

    try {
      isUploadingVideoImage.value = true
      await uploadReferenceImage(file, {
        provider: UploadProviderEnum.DEFAULT,
        scene: UploadSceneEnum.CHAT,
        enableDeduplication: true
      })

      const uploadedUrl = fileInfo.value?.downloadUrl
      if (!uploadedUrl) {
        throw new Error('未获取到图片URL')
      }

      videoParams.value.image = uploadedUrl
      videoImagePreview.value = uploadedUrl
      payload.onFinish()
    } catch (error) {
      logger.error('图片上传失败:', error)
      payload.onError()
    } finally {
      isUploadingVideoImage.value = false
    }
  }

  const stopAllPolling = () => {
    pollingTasks.forEach(({ timerId }) => window.clearInterval(timerId))
    pollingTasks.clear()
  }

  const stopConversationPolling = (conversationId: string) => {
    const tasksToStop: number[] = []
    pollingTasks.forEach(({ timerId, conversationId: taskConversationId }, taskId) => {
      if (taskConversationId === conversationId) {
        window.clearInterval(timerId)
        tasksToStop.push(taskId)
      }
    })
    tasksToStop.forEach((taskId) => pollingTasks.delete(taskId))
  }

  const getMessageBubbleClass = (message: Message) => {
    if (message.type === 'assistant' && isRenderableAiImage(message)) {
      return []
    }
    return ['bubble', message.type === 'user' ? 'bubble-oneself' : 'bubble-ai']
  }

  const isRenderableAiImage = (message: Message) => {
    if (message.type !== 'assistant') return false
    if (!isLikelyImageUrl(message.content)) return false
    return message.msgType === AiMsgContentTypeEnum.IMAGE || message.msgType === undefined || message.msgType === null
  }

  const getAiPlaceholderText = (message: Message) => {
    if (message.content && message.content.trim()) return message.content
    return isAIStreaming.value ? AI_THINKING_PLACEHOLDER : ''
  }

  const handleOpenClawSend = async (content: string) => {
    if (!isOpenClawConnected.value) {
      window.$message.warning('OpenClaw 未连接，请检查 Gateway')
      return
    }

    messageList.value.push({
      type: 'user',
      msgType: AiMsgContentTypeEnum.TEXT,
      content,
      createTime: Date.now()
    })
    const aiMessageIndex = messageList.value.length
    messageList.value.push({
      type: 'assistant',
      msgType: AiMsgContentTypeEnum.TEXT,
      content: '',
      createTime: Date.now()
    })
    bumpMessageRenderVersion()
    isAIStreaming.value = true

    try {
      for await (const _ of sendOpenClawMessage(content, (text) => {
        messageList.value[aiMessageIndex].content = text
      })) {
        // noop
      }
    } catch (error) {
      logger.error('OpenClaw 发送失败:', error)
      messageList.value[aiMessageIndex].content = `发送失败: ${error instanceof Error ? error.message : '未知错误'}`
    } finally {
      isAIStreaming.value = false
    }
  }

  const sendAIMessage = async (content: string, model: AIModel) => {
    try {
      lastAiPrompt.value = content
      currentAiAccumulatedContent.value = ''
      const tokenBudget = Number(model?.maxTokens || 0)
      if (tokenBudget > 0 && conversationTokens.value >= tokenBudget) {
        window.$message.warning(`本会话 Token 已用完（${tokenBudget}），请新建会话或更换模型`)
        return
      }

      window.$message.loading('AI思考中...', { duration: 0 })
      messageList.value.push({
        type: 'user',
        msgType: AiMsgContentTypeEnum.TEXT,
        content,
        createTime: Date.now()
      })
      const aiMessageIndex = messageList.value.length
      messageList.value.push({
        type: 'assistant',
        msgType: AiMsgContentTypeEnum.TEXT,
        content: AI_THINKING_PLACEHOLDER,
        createTime: Date.now()
      })
      bumpMessageRenderVersion()

      let accumulatedContent = ''
      let accumulatedReasoningContent = ''

      currentChat.value.messageCount = (currentChat.value.messageCount || 0) + 2
      notifyConversationMetaChange({
        messageCount: currentChat.value.messageCount,
        createTime: Date.now()
      })

      isAIStreaming.value = true
      await aiService.messageSendStream(
        currentChat.value.id,
        content,
        {
          onStart: (requestId: string) => {
            currentAiRequestId.value = requestId
          },
          onChunk: (chunk: string) => {
            let handled = false
            try {
              const data = JSON.parse(chunk)
              if (data && data.success && data.data?.receive) {
                if (data.data.receive.content) {
                  const incrementalContent = data.data.receive.content
                  if (messageList.value[aiMessageIndex].content === AI_THINKING_PLACEHOLDER && accumulatedContent === '') {
                    messageList.value[aiMessageIndex].content = ''
                  }
                  accumulatedContent += incrementalContent
                  messageList.value[aiMessageIndex].content = accumulatedContent
                  currentAiAccumulatedContent.value = accumulatedContent
                }
                if (data.data.receive.reasoningContent) {
                  const incrementalReasoningContent = data.data.receive.reasoningContent
                  accumulatedReasoningContent += incrementalReasoningContent
                  messageList.value[aiMessageIndex].reasoningContent = accumulatedReasoningContent
                }
                if (data.data.receive.msgType !== undefined) {
                  messageList.value[aiMessageIndex].msgType = data.data.receive.msgType
                }
                handled = true
              }
            } catch {
              // ignore invalid chunks
            }

            if (!handled) {
              const incrementalContent = chunk || ''
              if (messageList.value[aiMessageIndex].content === AI_THINKING_PLACEHOLDER && accumulatedContent === '') {
                messageList.value[aiMessageIndex].content = ''
              }
              accumulatedContent += incrementalContent
              messageList.value[aiMessageIndex].content = accumulatedContent
              currentAiAccumulatedContent.value = accumulatedContent
            }
          },
          onDone: () => {
            isAIStreaming.value = false
            currentAiRequestId.value = null
            const latestEntry = messageList.value[messageList.value.length - 1]
            const latestTimestamp = latestEntry?.createTime ?? currentChat.value.createTime ?? Date.now()
            notifyConversationMetaChange({ createTime: latestTimestamp })

            if (currentChat.value.id && currentChat.value.id !== '0') {
              aiService
                .conversationGetMy({ id: currentChat.value.id })
                .then((conversationList) => {
                  const conversation = Array.isArray(conversationList)
                    ? (conversationList[0] as ConversationUsage | undefined)
                    : undefined
                  if (conversation && typeof conversation.tokenUsage === 'number') {
                    serverTokenUsage.value = conversation.tokenUsage
                  }
                })
                .catch(() => {})

              if (model.id) {
                void loadRemainingUsage(model.id)
              }

              if (!messageList.value[aiMessageIndex].reasoningContent) {
                aiService
                  .messageListByConversationId({ conversationId: currentChat.value.id, pageNo: 1, pageSize: 100 })
                  .then((list) => {
                    if (!Array.isArray(list) || list.length === 0) return
                    const last = list[list.length - 1] as AIConversationMessage | undefined
                    if (
                      last &&
                      (last.type === 'assistant' || last.role === 'assistant') &&
                      typeof last.reasoningContent === 'string'
                    ) {
                      messageList.value[aiMessageIndex].reasoningContent = last.reasoningContent
                    }
                  })
                  .catch(() => {})
              }
            }
          },
          onError: (error: string) => {
            logger.error('AI流式响应错误:', error)
            messageList.value[aiMessageIndex].content = `抱歉，发生了错误：${error}`
            isAIStreaming.value = false
            currentAiRequestId.value = null
          }
        },
        true,
        reasoningEnabled.value
      )

      msgInputRef.value?.clearInput?.()
    } catch (error) {
      logger.error('AI消息发送失败:', error)
      window.$message.error('发送失败，请检查网络连接')
    } finally {
      window.$message.destroyAll()
    }
  }

  const handleStopAIStream = async () => {
    if (!isAIStreaming.value || !currentAiRequestId.value) return
    try {
      window.$message.destroyAll()
      await aiService.messageCancelStream(currentAiRequestId.value)
      await new Promise((resolve) => setTimeout(resolve, 180))
      const lastMessage = messageList.value[messageList.value.length - 1]
      if (lastMessage && lastMessage.type === 'assistant' && lastMessage.content === AI_THINKING_PLACEHOLDER) {
        lastMessage.content = ''
      }
      const latest =
        lastMessage && lastMessage.type === 'assistant' && lastMessage.content && lastMessage.content !== AI_THINKING_PLACEHOLDER
          ? lastMessage.content
          : currentAiAccumulatedContent.value
      if (latest && latest.trim()) {
        await aiService.messageSaveGeneratedContent({
          conversationId: currentChat.value.id,
          prompt: lastAiPrompt.value,
          generatedContent: latest
        })
      }
      window.$message.success('已停止生成')
    } catch (error) {
      logger.error('停止生成失败:', error)
      window.$message.error('停止生成失败')
    } finally {
      isAIStreaming.value = false
      currentAiRequestId.value = null
    }
  }

  const pollImageStatus = async (
    imageId: number,
    messageIndex: number,
    prompt: string,
    width: number,
    height: number,
    modelName: string
  ) => {
    const interval = 3000
    const conversationId = currentChat.value.id

    const poll = async () => {
      const task = pollingTasks.get(imageId)
      if (!task) return

      if (Date.now() - task.startedAt > MAX_POLL_DURATION) {
        window.clearInterval(task.timerId)
        pollingTasks.delete(imageId)
        messageList.value[messageIndex].content = '图片生成超时，请重试'
        messageList.value[messageIndex].isGenerating = false
        window.$message.warning('图片生成超时，已停止轮询')
        return
      }

      try {
        if (!pollingTasks.has(imageId)) return
        const imageList = await aiService.imageMyListByIds({ ids: imageId.toString() })
        if (!Array.isArray(imageList) || imageList.length === 0) {
          messageList.value[messageIndex].content = '图片生成失败: 记录不存在'
          messageList.value[messageIndex].isGenerating = false
          pollingTasks.delete(imageId)
          return
        }

        const image = imageList[0]
        if (image.status === 20) {
          messageList.value[messageIndex] = {
            type: 'assistant',
            content: image.picUrl || image.url,
            msgType: AiMsgContentTypeEnum.IMAGE,
            createTime: Date.now(),
            isGenerating: false,
            imageUrl: image.picUrl || image.url,
            imageInfo: {
              prompt,
              width,
              height,
              model: modelName
            }
          }
          void ensureLocalAiImage(image.picUrl || image.url, messageIndex)
          window.$message.success('图片生成成功')
          bumpMessageRenderVersion()
          pollingTasks.delete(imageId)
          return
        }

        if (image.status === 30) {
          messageList.value[messageIndex].content = `图片生成失败: ${image.errorMessage || '未知错误'}`
          messageList.value[messageIndex].isGenerating = false
          window.$message.error('图片生成失败')
          pollingTasks.delete(imageId)
        }
      } catch (error) {
        logger.error('轮询图片状态失败:', error)
        messageList.value[messageIndex].content = `查询状态失败: ${getErrorMessage(error)}`
        messageList.value[messageIndex].isGenerating = false
        pollingTasks.delete(imageId)
      }
    }

    const timerId = window.setInterval(poll, interval)
    pollingTasks.set(imageId, { timerId, conversationId, startedAt: Date.now() })
    await poll()
  }

  const generateImage = async (prompt: string, model: AIModel) => {
    try {
      const tokenBudget = Number(model?.maxTokens || 0)
      if (tokenBudget > 0 && conversationTokens.value >= tokenBudget) {
        window.$message.warning(`本会话 Token 已用完（${tokenBudget}），请新建会话或更换模型`)
        return
      }

      messageList.value.push({
        type: 'user',
        content: prompt,
        msgType: AiMsgContentTypeEnum.IMAGE,
        createTime: Date.now()
      })
      const aiMessageIndex = messageList.value.length
      messageList.value.push({
        type: 'assistant',
        msgType: AiMsgContentTypeEnum.IMAGE,
        content: AI_THINKING_PLACEHOLDER,
        createTime: Date.now(),
        isGenerating: true
      })
      bumpMessageRenderVersion()

      const [width, height] = imageParams.value.size.split('x').map(Number)
      const imageResult = await aiService.generateImage({
        modelId: String(model.id),
        prompt,
        width,
        height,
        conversationId: currentChat.value.id
      })
      const imageId = extractGenerationTaskId(imageResult)
      void pollImageStatus(imageId, aiMessageIndex, prompt, width, height, model.name)
      msgInputRef.value?.clearInput?.()
    } catch (error) {
      logger.error('图片生成失败:', error)
      const lastMessage = messageList.value[messageList.value.length - 1]
      if (lastMessage?.isGenerating) {
        lastMessage.content = `图片生成失败: ${getErrorMessage(error)}`
        lastMessage.isGenerating = false
      }
      window.$message.error('图片生成失败，请检查网络连接')
    }
  }

  const pollVideoStatus = async (
    videoId: number,
    messageIndex: number,
    prompt: string,
    width: number,
    height: number,
    modelName: string
  ) => {
    const interval = 5000
    const conversationId = currentChat.value.id

    const poll = async () => {
      const task = pollingTasks.get(videoId)
      if (!task) return

      if (Date.now() - task.startedAt > MAX_POLL_DURATION) {
        window.clearInterval(task.timerId)
        pollingTasks.delete(videoId)
        messageList.value[messageIndex].content = '视频生成超时，请重试'
        messageList.value[messageIndex].isGenerating = false
        window.$message.warning('视频生成超时，已停止轮询')
        return
      }

      try {
        if (!pollingTasks.has(videoId)) return
        const videoList = await aiService.videoMyListByIds({ ids: videoId.toString() })
        if (!Array.isArray(videoList) || videoList.length === 0) {
          messageList.value[messageIndex].content = '视频生成失败: 记录不存在'
          messageList.value[messageIndex].isGenerating = false
          pollingTasks.delete(videoId)
          return
        }

        const video = videoList[0]
        if (video.status === 20) {
          messageList.value[messageIndex] = {
            type: 'assistant',
            content: video.videoUrl || video.url,
            msgType: AiMsgContentTypeEnum.VIDEO,
            createTime: Date.now(),
            isGenerating: false,
            videoUrl: video.videoUrl || video.url,
            videoInfo: {
              prompt,
              width,
              height,
              model: modelName
            }
          }
          void ensureLocalAiVideo(video.videoUrl || video.url, messageIndex)
          window.$message.success('视频生成成功')
          bumpMessageRenderVersion()
          pollingTasks.delete(videoId)
          return
        }

        if (video.status === 30) {
          messageList.value[messageIndex].content = `视频生成失败: ${video.errorMessage || '未知错误'}`
          messageList.value[messageIndex].isGenerating = false
          window.$message.error('视频生成失败')
          pollingTasks.delete(videoId)
        }
      } catch (error) {
        logger.error('轮询视频状态失败:', error)
        messageList.value[messageIndex].content = `查询状态失败: ${getErrorMessage(error)}`
        messageList.value[messageIndex].isGenerating = false
        pollingTasks.delete(videoId)
      }
    }

    const timerId = window.setInterval(poll, interval)
    pollingTasks.set(videoId, { timerId, conversationId, startedAt: Date.now() })
    await poll()
  }

  const generateVideo = async (prompt: string, model: AIModel) => {
    try {
      const tokenBudget = Number(model?.maxTokens || 0)
      if (tokenBudget > 0 && conversationTokens.value >= tokenBudget) {
        window.$message.warning(`本会话 Token 已用完（${tokenBudget}），请新建会话或更换模型`)
        return
      }

      messageList.value.push({
        type: 'user',
        msgType: AiMsgContentTypeEnum.VIDEO,
        content: prompt,
        createTime: Date.now()
      })
      const aiMessageIndex = messageList.value.length
      messageList.value.push({
        type: 'assistant',
        msgType: AiMsgContentTypeEnum.VIDEO,
        content: AI_THINKING_PLACEHOLDER,
        createTime: Date.now(),
        isGenerating: true
      })
      bumpMessageRenderVersion()

      const [width, height] = videoParams.value.size.split('x').map(Number)
      const requestBody: VideoGenerationRequest = {
        modelId: String(model.id),
        prompt,
        width,
        height,
        duration: videoParams.value.duration,
        conversationId: currentChat.value.id
      }
      if (videoParams.value.image) {
        requestBody.options = {
          image: videoParams.value.image
        }
      }

      const videoResult = await aiService.videoGenerate(requestBody)
      const videoId = extractGenerationTaskId(videoResult)
      void pollVideoStatus(videoId, aiMessageIndex, prompt, width, height, model.name)
      msgInputRef.value?.clearInput?.()
      clearVideoImage()
    } catch (error) {
      logger.error('视频生成失败:', error)
      const lastMessage = messageList.value[messageList.value.length - 1]
      if (lastMessage?.isGenerating) {
        lastMessage.content = `视频生成失败: ${getErrorMessage(error)}`
        lastMessage.isGenerating = false
      }
      window.$message.error('视频生成失败，请检查网络连接')
    }
  }

  const pollAudioStatus = async (audioId: number, messageIndex: number, prompt: string, modelName: string) => {
    const interval = 3000
    const conversationId = currentChat.value.id

    const poll = async () => {
      const task = pollingTasks.get(audioId)
      if (!task) return

      if (Date.now() - task.startedAt > MAX_POLL_DURATION) {
        window.clearInterval(task.timerId)
        pollingTasks.delete(audioId)
        messageList.value[messageIndex].content = '音频生成超时，请重试'
        messageList.value[messageIndex].isGenerating = false
        window.$message.warning('音频生成超时，已停止轮询')
        return
      }

      try {
        if (!pollingTasks.has(audioId)) return
        const audioList = await aiService.audioMyListByIds({ ids: audioId.toString() })
        if (!Array.isArray(audioList) || audioList.length === 0) {
          messageList.value[messageIndex].content = '音频生成失败: 记录不存在'
          messageList.value[messageIndex].isGenerating = false
          pollingTasks.delete(audioId)
          return
        }

        const audio = audioList[0]
        if (audio.status === 20) {
          messageList.value[messageIndex] = {
            type: 'assistant',
            content: audio.audioUrl || audio.url,
            msgType: AiMsgContentTypeEnum.AUDIO,
            createTime: Date.now(),
            isGenerating: false,
            audioUrl: audio.audioUrl || audio.url,
            audioInfo: {
              prompt,
              model: modelName,
              voice: audioParams.value.voice,
              speed: audioParams.value.speed
            }
          }
          void ensureLocalAiAudio(audio.audioUrl || audio.url, messageIndex)
          window.$message.success('音频生成成功')
          bumpMessageRenderVersion()
          pollingTasks.delete(audioId)
          return
        }

        if (audio.status === 30) {
          messageList.value[messageIndex].content = `音频生成失败: ${audio.errorMessage || '未知错误'}`
          messageList.value[messageIndex].isGenerating = false
          window.$message.error('音频生成失败')
          pollingTasks.delete(audioId)
        }
      } catch (error) {
        messageList.value[messageIndex].content = `查询状态失败: ${getErrorMessage(error)}`
        messageList.value[messageIndex].isGenerating = false
        pollingTasks.delete(audioId)
      }
    }

    const timerId = window.setInterval(poll, interval)
    pollingTasks.set(audioId, { timerId, conversationId, startedAt: Date.now() })
    await poll()
  }

  const generateAudio = async (prompt: string, model: AIModel) => {
    try {
      const tokenBudget = Number(model?.maxTokens || 0)
      if (tokenBudget > 0 && conversationTokens.value >= tokenBudget) {
        window.$message.warning(`本会话 Token 已用完（${tokenBudget}），请新建会话或更换模型`)
        return
      }

      messageList.value.push({
        type: 'user',
        msgType: AiMsgContentTypeEnum.AUDIO,
        content: prompt,
        createTime: Date.now()
      })
      const aiMessageIndex = messageList.value.length
      messageList.value.push({
        type: 'assistant',
        msgType: AiMsgContentTypeEnum.AUDIO,
        content: AI_THINKING_PLACEHOLDER,
        createTime: Date.now(),
        isGenerating: true
      })
      bumpMessageRenderVersion()

      const audioResult = await aiService.audioGenerate({
        modelId: model.id,
        prompt,
        conversationId: currentChat.value.id,
        options: {
          voice: audioParams.value.voice,
          speed: String(audioParams.value.speed)
        }
      })
      const audioId = extractGenerationTaskId(audioResult)
      void pollAudioStatus(audioId, aiMessageIndex, prompt, model.name)
      msgInputRef.value?.clearInput?.()
    } catch (error) {
      logger.error('音频生成失败:', error)
      const lastMessage = messageList.value[messageList.value.length - 1]
      if (lastMessage?.isGenerating) {
        lastMessage.content = `音频生成失败: ${getErrorMessage(error)}`
        lastMessage.isGenerating = false
      }
      window.$message.error('音频生成失败，请检查网络连接')
    }
  }

  const handleSendAI = (data: { content: string }) => {
    if (!data.content.trim()) {
      window.$message.warning('消息内容不能为空')
      return
    }

    if (aiProvider.value === 'openclaw') {
      void handleOpenClawSend(data.content)
      return
    }

    if (!selectedModel.value) {
      window.$message.warning('请先选择AI模型')
      return
    }

    if (selectedModel.value.type === 1) {
      void sendAIMessage(data.content, selectedModel.value)
      return
    }
    if (selectedModel.value.type === 2) {
      void generateImage(data.content, selectedModel.value)
      return
    }
    if (selectedModel.value.type === 3) {
      void generateAudio(data.content, selectedModel.value)
      return
    }
    if ([4, 7, 8].includes(selectedModel.value.type)) {
      void generateVideo(data.content, selectedModel.value)
      return
    }

    window.$message.warning('不支持的模型类型')
  }

  const handleModelClick = () => {
    showModelPopover.value = !showModelPopover.value
    if (showModelPopover.value && modelList.value.length === 0) {
      void fetchModelList()
    }
  }

  const handleModelPopoverShowChange = (show: boolean) => {
    showModelPopover.value = show
    if (show && modelList.value.length === 0) {
      void fetchModelList()
    }
  }

  const selectModel = async (model: AIModel) => {
    selectedModel.value = model ? { ...model } : null
    showModelPopover.value = false

    if (model.type !== 8) {
      clearVideoImage()
    }
    if (model.type === 3) {
      await loadAudioVoices(model)
    }

    if (currentChat.value.id && currentChat.value.id !== '0') {
      try {
        await conversationService.update({
          id: currentChat.value.id,
          modelId: String(model.id)
        })
      } catch (error) {
        logger.error('切换模型失败:', error)
        window.$message.destroyAll()
        window.$message.error('切换模型失败')
      }
    } else {
      window.$message.success(`已选择模型: ${model.name}`)
    }

    useMitt.emit('model-selected', model)
    if (model.id) {
      void loadRemainingUsage(model.id)
    }
  }

  const handleModelPageChange = (page: number) => {
    modelPagination.value.pageNo = page
    void fetchModelList()
  }

  const handleOpenModelManagement = () => {
    showModelPopover.value = false
    useMitt.emit('open-model-management')
  }

  const loadRoleList = async () => {
    roleLoading.value = true
    try {
      const data = await aiService.chatRolePage({ pageNo: 1, pageSize: 100 })
      roleList.value = ((data.list || []) as ChatRole[]).filter((item) => item.status === 0)
      if (!selectedRole.value && roleList.value.length > 0) {
        selectedRole.value = roleList.value[0]
      }
    } catch (error) {
      logger.error('加载角色列表失败:', error)
      window.$message.error('加载角色列表失败')
    } finally {
      roleLoading.value = false
    }
  }

  const handleSelectRole = async (role: ChatRole) => {
    selectedRole.value = role ? { ...role } : null
    showRolePopover.value = false

    try {
      if (currentChat.value.id && currentChat.value.id !== '0') {
        await conversationService.update({
          id: currentChat.value.id,
          roleId: role.id,
          modelId: role.modelId || undefined
        })
      } else {
        window.$message.success(`已选择角色: ${role.name}`)
      }
    } catch (error) {
      logger.error('切换角色失败:', error)
      window.$message.destroyAll()
      window.$message.error('切换角色失败')
    }
  }

  const handleOpenRoleManagement = () => {
    showRolePopover.value = false
    useMitt.emit('open-role-management')
  }

  const handleBlur = async () => {
    isEdit.value = false
    if (originalTitle.value === currentChat.value.title) {
      return
    }
    if (currentChat.value.title === '') {
      currentChat.value.title = `新的聊天${currentChat.value.id}`
    }

    try {
      await conversationService.update({
        id: currentChat.value.id,
        title: currentChat.value.title
      })
      useMitt.emit('update-chat-title', { title: currentChat.value.title, id: currentChat.value.id })
    } catch (error) {
      logger.error('更新会话标题失败:', error)
      window.$message.error('重命名失败')
      currentChat.value.title = originalTitle.value
    }
  }

  const handleEdit = () => {
    originalTitle.value = currentChat.value.title
    isEdit.value = true
    nextTick(() => {
      inputInstRef.value?.select()
    })
  }

  const loadMessages = async (conversationId: string) => {
    if (!conversationId || conversationId === '0') {
      return
    }

    try {
      loadingMessages.value = true
      const data = (await aiService.messageListByConversationId({
        conversationId,
        pageNo: 1,
        pageSize: 100
      })) as AIConversationMessage[]

      if (Array.isArray(data) && data.length > 0) {
        messageList.value = []
        const limitedData = data.slice(-MAX_MESSAGE_COUNT)
        limitedData.forEach((msg) => {
          const messageType = msg.type === 'assistant' || msg.role === 'assistant' ? 'assistant' : 'user'
          const nextMessage: Message = {
            type: messageType,
            content: msg.content || '',
            reasoningContent: msg.reasoningContent,
            msgType: toAiMsgContentType(msg.msgType),
            createTime: msg.createTime ?? msg.createdAt ?? Date.now(),
            id: msg.id,
            replyId: msg.replyId,
            model: msg.model
          }
          if (
            nextMessage.type === 'assistant' &&
            (nextMessage.msgType === undefined || nextMessage.msgType === null) &&
            isLikelyImageUrl(nextMessage.content)
          ) {
            nextMessage.msgType = AiMsgContentTypeEnum.IMAGE
          }
          if (nextMessage.msgType === AiMsgContentTypeEnum.IMAGE && isLikelyImageUrl(nextMessage.content)) {
            nextMessage.imageUrl = msg.imageUrl || nextMessage.content
          }
          if (nextMessage.msgType === AiMsgContentTypeEnum.VIDEO && isLikelyMediaUrl(nextMessage.content)) {
            nextMessage.videoUrl = msg.videoUrl || nextMessage.content
          }
          if (nextMessage.msgType === AiMsgContentTypeEnum.AUDIO && isLikelyMediaUrl(nextMessage.content)) {
            nextMessage.audioUrl = msg.audioUrl || nextMessage.content
          }
          messageList.value.push(nextMessage)
        })
        bumpMessageRenderVersion()

        if (userStore.userInfo?.uid && currentChat.value.id) {
          void Promise.all(
            messageList.value.map((msg, index) => {
              if (msg.type !== 'assistant') return Promise.resolve()
              if (msg.msgType === AiMsgContentTypeEnum.IMAGE) {
                return ensureLocalAiImage(msg.imageUrl || msg.content, index)
              }
              if (msg.msgType === AiMsgContentTypeEnum.VIDEO) {
                return ensureLocalAiVideo(msg.videoUrl || msg.content, index)
              }
              if (msg.msgType === AiMsgContentTypeEnum.AUDIO) {
                return ensureLocalAiAudio(msg.audioUrl || msg.content, index)
              }
              return Promise.resolve()
            })
          )
        }

        try {
          const conversationList = await aiService.conversationGetMy({ id: conversationId })
          const conversation = Array.isArray(conversationList)
            ? (conversationList[0] as ConversationUsage | undefined)
            : undefined
          if (conversation && typeof conversation.tokenUsage === 'number') {
            serverTokenUsage.value = conversation.tokenUsage
          }
        } catch {
          // noop
        }
      } else {
        messageList.value = []
        bumpMessageRenderVersion()
      }
    } catch (error) {
      logger.error('加载消息失败:', error)
      window.$message.error('加载消息失败')
      messageList.value = []
      bumpMessageRenderVersion()
    } finally {
      loadingMessages.value = false
    }
  }

  const handleCreateNewChat = async () => {
    if (!selectedRole.value?.id) {
      window.$message.warning('请先选择角色')
      return
    }

    const roleId = selectedRole.value.id
    const roleName = selectedRole.value.name || '新的会话'

    try {
      const data = await conversationService.create({
        roleId,
        knowledgeId: undefined,
        title: roleName
      })

      if (data) {
        window.$message.success('会话创建成功')
        const rawCreateTime = Number(data.createTime)
        useMitt.emit('add-conversation', {
          id: data.id || data,
          title: data.title || roleName,
          createTime: Number.isFinite(rawCreateTime) ? rawCreateTime : Date.now(),
          messageCount: data.messageCount || 0,
          isPinned: data.pinned || false,
          roleId,
          modelId: data.modelId
        })

        serverTokenUsage.value = null
        messageList.value = []
        bumpMessageRenderVersion()
        await router.push('/chat')
      }
    } catch (error) {
      logger.error('创建会话失败:', error)
      window.$message.error('创建会话失败')
    }
  }

  const handleDeleteMessage = async (messageId: string, index: number) => {
    if (!messageId) {
      window.$message.warning('消息ID无效')
      return
    }

    try {
      await aiService.messageDelete({ id: messageId })
      messageList.value.splice(index, 1)
      bumpMessageRenderVersion()
      window.$message.success('消息已删除')

      currentChat.value.messageCount = Math.max((currentChat.value.messageCount || 0) - 1, 0)
      const latestEntry = messageList.value[messageList.value.length - 1]
      const latestTimestamp = latestEntry?.createTime ?? currentChat.value.createTime ?? Date.now()
      notifyConversationMetaChange({
        messageCount: currentChat.value.messageCount,
        createTime: latestTimestamp
      })
    } catch (error) {
      logger.error('删除消息失败:', error)
      window.$message.error('删除消息失败')
    }
  }

  const handleDeleteChat = async () => {
    if (!currentChat.value.id || currentChat.value.id === '0') {
      window.$message.warning('请先选择一个会话')
      showDeleteChatConfirm.value = false
      return
    }

    try {
      if (deleteWithMessages.value) {
        try {
          await aiService.messageDeleteByConversationId({ conversationIdList: [currentChat.value.id] })
        } catch (error) {
          logger.error('删除会话消息失败:', error)
        }
      }

      await conversationService.delete({ conversationIdList: [currentChat.value.id] })
      window.$message.success(deleteWithMessages.value ? '会话及消息已删除' : '会话删除成功')
      showDeleteChatConfirm.value = false
      deleteWithMessages.value = false
      currentChat.value = {
        id: '0',
        title: '',
        messageCount: 0,
        createTime: 0
      }
      messageList.value = []
      serverTokenUsage.value = null
      bumpMessageRenderVersion()
      await router.push('/welcome')
      useMitt.emit('refresh-conversations')
    } catch (error) {
      logger.error('删除会话失败:', error)
      window.$message.error('删除会话失败')
      showDeleteChatConfirm.value = false
    }
  }

  const handleRefreshRoleList = () => {
    void loadRoleList()
  }

  const handleRefreshModelList = async () => {
    await fetchModelList()
    if (selectedModel.value?.id) {
      const selectedModelId = selectedModel.value.id
      const updatedModel = modelList.value.find((item) => item.id === selectedModelId)
      if (updatedModel) {
        const oldType = selectedModel.value.type
        selectedModel.value = { ...updatedModel }
        void loadRemainingUsage(updatedModel.id)
        if (oldType === 8 && updatedModel.type !== 8) {
          clearVideoImage()
        }
      }
    }
  }

  const handleLeftChatTitle = (event: LeftChatTitlePayload) => {
    if (event.id === currentChat.value.id) {
      currentChat.value.title = event.title ?? ''
      currentChat.value.messageCount = event.messageCount ?? 0
      currentChat.value.createTime = event.createTime ?? currentChat.value.createTime ?? Date.now()
    }
  }

  const handleChatActive = async (event: ChatActivePayload) => {
    const { title, id, messageCount, roleId, modelId, createTime } = event
    currentChat.value.title = title || `新的聊天${currentChat.value.id}`
    currentChat.value.id = id
    currentChat.value.messageCount = messageCount ?? 0
    currentChat.value.createTime = createTime ?? currentChat.value.createTime ?? Date.now()
    serverTokenUsage.value = null
    messageList.value = []
    bumpMessageRenderVersion()

    if (modelList.value.length === 0) {
      await fetchModelList()
    }
    if (roleList.value.length === 0) {
      await loadRoleList()
    }

    if (roleId) {
      const role = roleList.value.find((item) => String(item.id) === String(roleId))
      if (role) {
        selectedRole.value = role
      }
    }

    if (modelId) {
      const model = modelList.value.find((item) => String(item.id) === String(modelId))
      if (model) {
        selectedModel.value = model
        void loadRemainingUsage(model.id)
        if (model.type === 3) {
          await loadAudioVoices(model)
        }
      }
    }

    await loadMessages(id)
  }

  watch(
    selectedModel,
    (model) => {
      remainingUsage.value = null
      if (model?.id) {
        void loadRemainingUsage(model.id)
      }
    },
    { immediate: true }
  )

  watch(
    () => currentChat.value.id,
    (newId, oldId) => {
      if (oldId && oldId !== newId) {
        stopConversationPolling(oldId)
        if (isAIStreaming.value) {
          void handleStopAIStream()
        }
      }
    }
  )

  onMounted(async () => {
    loadSavedConfig()

    if (aiProvider.value === 'openclaw') {
      try {
        await connectOpenClaw({
          gatewayUrl: openClawConfig.value.gatewayUrl,
          token: openClawConfig.value.token
        })
      } catch (error) {
        logger.error('OpenClaw 连接失败:', error)
      }
    }

    if (modelList.value.length === 0) {
      await fetchModelList()
    }
    await loadRoleList()

    useMitt.on('chat-active', handleChatActive)
    useMitt.on('refresh-role-list', handleRefreshRoleList)
    useMitt.on('refresh-model-list', handleRefreshModelList)
    useMitt.on('left-chat-title', handleLeftChatTitle)
  })

  onUnmounted(() => {
    stopAllPolling()
    if (isAIStreaming.value) {
      void handleStopAIStream()
    }

    useMitt.off('chat-active', handleChatActive)
    useMitt.off('refresh-role-list', handleRefreshRoleList)
    useMitt.off('refresh-model-list', handleRefreshModelList)
    useMitt.off('left-chat-title', handleLeftChatTitle)
  })

  return {
    inputInstRef,
    isEdit,
    currentChat,
    remainingUsage,
    remainingUsageDisplay,
    remainingUsageTagType,
    isAIStreaming,
    messageList,
    loadingMessages,
    messageRenderVersion,
    serverTokenUsage,
    conversationTokens,
    showDeleteChatConfirm,
    deleteWithMessages,
    showRolePopover,
    selectedRole,
    roleList,
    roleLoading,
    showModelPopover,
    modelLoading,
    modelSearch,
    selectedModel,
    reasoningEnabled,
    supportsReasoning,
    modelPagination,
    filteredModels,
    officialModels,
    userModels,
    imageParams,
    imageSizeOptions,
    videoParams,
    videoSizeOptions,
    videoDurationOptions,
    audioParams,
    audioVoiceOptions,
    audioSpeedOptions,
    videoImageFileRef,
    videoImagePreview,
    isUploadingVideoImage,
    showHistoryModal,
    historyType,
    historyLoading,
    historyList,
    historyPagination,
    showImagePreview,
    showVideoPreview,
    previewItem,
    otherFeatures,
    userAvatar,
    aiProvider,
    isOpenClawConnected,
    openClawModels,
    openClawCurrentModel,
    handleProviderChange,
    getDefaultAvatar,
    getModelAvatar,
    getMessageBubbleClass,
    getAiPlaceholderText,
    isLikelyMediaUrl,
    handleVideoImageUpload,
    clearVideoImage,
    handleSendAI,
    handleStopAIStream,
    handleImagePreview,
    handlePreviewImage,
    handlePreviewVideo,
    handleModelClick,
    handleModelPopoverShowChange,
    selectModel,
    handleModelPageChange,
    handleOpenModelManagement,
    handleSelectRole,
    handleOpenRoleManagement,
    handleBlur,
    handleEdit,
    handleCreateNewChat,
    handleDeleteMessage,
    handleDeleteChat,
    switchHistoryType,
    handleHistoryPageChange
  }
}
