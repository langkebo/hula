import { computed, onMounted, onUnmounted, type Ref, ref, watch } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import type { AiMsgContentTypeEnum } from '@/enums'
import { useAiConversationLifecycle } from '@/plugins/robot/composables/useAiConversationLifecycle'
import { useAiConversationMessages } from '@/plugins/robot/composables/useAiConversationMessages'
import { useAiGenerationParams } from '@/plugins/robot/composables/useAiGenerationParams'
import { useAiGenerationPolling } from '@/plugins/robot/composables/useAiGenerationPolling'
import { useAiHistoryView } from '@/plugins/robot/composables/useAiHistoryView'
import { useAiMediaCache } from '@/plugins/robot/composables/useAiMediaCache'
import { useAiMediaGeneration } from '@/plugins/robot/composables/useAiMediaGeneration'
import { useAiMessageDisplay } from '@/plugins/robot/composables/useAiMessageDisplay'
import { useAiModelManagement } from '@/plugins/robot/composables/useAiModelManagement'
import { useAiProviderConfig } from '@/plugins/robot/composables/useAiProviderConfig'
import { useAiRoleManagement } from '@/plugins/robot/composables/useAiRoleManagement'
import { useAiStreaming } from '@/plugins/robot/composables/useAiStreaming'
import { useAiTitleEdit } from '@/plugins/robot/composables/useAiTitleEdit'
import { isLikelyMediaUrl } from '@/plugins/robot/utils/aiMediaUrl'
import { estimateMessageTokens } from '@/plugins/robot/utils/tokenEstimator'
import { useI18nGlobal } from '@/services/i18n'
import { aiService } from '@/services/matrix/ai/AIService'
import { useUserStore } from '@/stores/domains/user/user'
import type { AIAudio, AIImage, AIVideo } from '@/types/matrix-api'
import { createLogger } from '@/utils/Logger'

const _logger = createLogger('RobotChat')

export interface ConversationMeta {
  id: string
  title: string
  messageCount: number
  createTime: number
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

export interface PaginationState {
  pageNo: number
  pageSize: number
  total: number
}

export interface UseRobotChatOptions {
  msgInputRef: Ref<{ clearInput?: () => void } | undefined>
}

export const useRobotChat = (options: UseRobotChatOptions) => {
  const { msgInputRef } = options
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()
  const userStore = useUserStore()

  const currentChat = ref<ConversationMeta>({
    id: '0',
    title: '',
    messageCount: 0,
    createTime: 0
  })

  const remainingUsage = ref<number | null>(null)
  const remainingUsageDisplay = computed(() => {
    if (remainingUsage.value === null) return ''
    if (remainingUsage.value === -1) return t('ai_assistant.robot.unlimited')
    return String(remainingUsage.value)
  })
  const remainingUsageTagType = computed(() => {
    if (remainingUsage.value === -1) return 'success'
    if ((remainingUsage.value || 0) > 0) return 'info'
    return 'error'
  })

  const messageList = ref<Message[]>([])
  const messageRenderVersion = ref(0)
  const serverTokenUsage = ref<number | null>(null)
  const conversationTokens = computed(() =>
    messageList.value.reduce((sum, item) => sum + estimateMessageTokens(item), 0)
  )

  const showDeleteChatConfirm = ref(false)
  const deleteWithMessages = ref(false)

  const {
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
    loadAudioVoices,
    clearVideoImage,
    handleVideoImageUpload
  } = useAiGenerationParams()

  const features = computed(() => [
    { icon: 'model', label: t('ai_assistant.robot.feature_model') },
    { icon: 'voice', label: t('ai_assistant.robot.feature_voice_input') },
    { icon: 'plugins2', label: t('ai_assistant.robot.feature_plugins') }
  ])
  const otherFeatures = computed(() => features.value.filter((item) => item.icon !== 'model'))

  const userUid = computed(() => userStore.userInfo?.uid)
  const userAvatar = computed(() => userStore.userInfo?.avatar || '')

  const loadRemainingUsage = async (modelId: string) => {
    if (!modelId) return
    remainingUsage.value = await aiService.getModelRemainingUsage({ modelId })
  }

  const {
    showModelPopover,
    modelLoading,
    modelSearch,
    selectedModel,
    reasoningEnabled,
    supportsReasoning,
    modelPagination,
    modelList,
    filteredModels,
    officialModels,
    userModels,
    fetchModelList,
    handleModelClick,
    handleModelPopoverShowChange,
    selectModel,
    handleModelPageChange,
    handleOpenModelManagement,
    handleRefreshModelList
  } = useAiModelManagement({
    currentChat,
    clearVideoImage,
    loadAudioVoices,
    loadRemainingUsage
  })

  const { aiProvider, loadSavedConfig, handleProviderChange } = useAiProviderConfig({
    fetchModelList,
    modelList
  })

  const {
    showRolePopover,
    selectedRole,
    roleList,
    roleLoading,
    loadRoleList,
    handleSelectRole,
    handleOpenRoleManagement,
    handleRefreshRoleList
  } = useAiRoleManagement({ currentChat })

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
    switchHistoryType,
    handleHistoryPageChange,
    handleImagePreview,
    handlePreviewImage,
    handlePreviewVideo
  } = useAiHistoryView({ selectedModel })

  const bumpMessageRenderVersion = () => {
    messageRenderVersion.value += 1
  }

  const { stopAllPolling, stopConversationPolling, pollImageStatus, pollVideoStatus, pollAudioStatus } =
    useAiGenerationPolling({
      currentChat,
      messageList,
      bumpMessageRenderVersion,
      ensureLocalAiImage,
      ensureLocalAiVideo,
      ensureLocalAiAudio,
      getCurrentAudioInfo: () => ({
        voice: audioParams.value.voice,
        speed: audioParams.value.speed
      })
    })

  const { generateImage, generateVideo, generateAudio } = useAiMediaGeneration({
    currentChat,
    conversationTokens,
    messageList,
    msgInputRef,
    imageParams,
    videoParams,
    audioParams,
    bumpMessageRenderVersion,
    clearVideoImage,
    pollImageStatus,
    pollVideoStatus,
    pollAudioStatus
  })

  const { loadingMessages, loadMessages, handleDeleteMessage, notifyConversationMetaChange } =
    useAiConversationMessages({
      currentChat,
      messageList,
      serverTokenUsage,
      bumpMessageRenderVersion,
      ensureLocalAiImage,
      ensureLocalAiVideo,
      ensureLocalAiAudio
    })

  const { isAIStreaming, sendAIMessage, handleStopAIStream } = useAiStreaming({
    currentChat,
    messageList,
    conversationTokens,
    reasoningEnabled,
    msgInputRef,
    bumpMessageRenderVersion,
    notifyConversationMetaChange,
    loadRemainingUsage,
    onTokenUsageUpdate: (usage) => {
      serverTokenUsage.value = usage
    }
  })

  const { handleCreateNewChat, handleDeleteChat, handleLeftChatTitle, handleChatActive } = useAiConversationLifecycle({
    currentChat,
    messageList,
    serverTokenUsage,
    showDeleteChatConfirm,
    deleteWithMessages,
    selectedRole,
    selectedModel,
    modelList,
    roleList,
    bumpMessageRenderVersion,
    fetchModelList,
    loadRoleList,
    loadRemainingUsage,
    loadAudioVoices,
    loadMessages
  })

  const { getDefaultAvatar, getModelAvatar, getMessageBubbleClass, getAiPlaceholderText } = useAiMessageDisplay({
    isAIStreaming
  })

  const { handleBlur, handleEdit, isEdit } = useAiTitleEdit({ currentChat })

  const handleSendAI = (data: { content: string }) => {
    if (!data.content.trim()) {
      showFeedback('消息内容不能为空', 'warning')
      return
    }

    if (!selectedModel.value) {
      showFeedback(t('ai_assistant.robot.select_model_first'), 'warning')
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

    showFeedback(t('ai_assistant.robot.unsupported_model_type'), 'warning')
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
