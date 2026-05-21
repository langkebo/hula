import dayjs from 'dayjs'
import { useDialog } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { openClawClient, useOpenClaw } from '@/services/openclaw'
import { robotCredentialService } from '@/services/robot'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { useOpenClawConversationStore } from '@/stores/domains/chat/openClawConversation'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'
import type { OpenClawConfig, OpenClawWorkbenchMessage } from '../types'
import { useOpenClawInstall } from './useOpenClawInstall'

const logger = createLogger('OpenClawWorkbenchComposable')

const MODEL_STORAGE_KEY = 'hula-openclaw-workbench-model'
const DEFAULT_OPENCLAW_TEMPERATURE = 0.7
const DEFAULT_OPENCLAW_MAX_TOKENS = 4096

export function useOpenClawWorkbench() {
  const { t, locale } = useI18n()
  const dialog = useDialog()
  const { showFeedback } = useActionFeedback()
  const userStore = useUserStore()
  const matrixStore = useMatrixStore()

  const translate = (key: string, params?: Record<string, unknown>) =>
    t(key as never, (params ?? {}) as never) as string

  const { isConnected, isLoading, availableModels, error, connectionState, connect, disconnect, stopGeneration } =
    useOpenClaw()
  const conversationStore = useOpenClawConversationStore()
  const installStore = useOpenClawInstall(translate)
  const credentialOwnerId = computed(() => userStore.userInfo?.uid || matrixStore.userId || undefined)
  const storageScope = computed(() => ({ userId: credentialOwnerId.value }))

  const getScopedModelStorageKey = () => {
    const scopeId = credentialOwnerId.value || 'anonymous'
    return `${MODEL_STORAGE_KEY}::${scopeId}`
  }

  // Inject translate function and delete-all confirmation callback into the store
  conversationStore.setTranslate(translate)
  conversationStore.setConfirmDeleteAllCallback(async () => {
    return new Promise<boolean>((resolve) => {
      dialog.warning({
        title: translate('common.confirm'),
        content: translate('ai_assistant.robot.confirm_delete_all'),
        positiveText: translate('common.confirm'),
        negativeText: translate('common.cancel'),
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false),
        onClose: () => resolve(false),
        onMaskClick: () => resolve(false)
      })
    })
  })

  // --- State ---
  const transientError = ref('')
  const selectedModelId = ref('')

  const openClawConfig = ref<OpenClawConfig>({
    gatewayUrl: 'http://127.0.0.1:18789',
    token: import.meta.env.VITE_OPENCLAW_TOKEN || '',
    autoConnect: true,
    reconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000,
    temperature: DEFAULT_OPENCLAW_TEMPERATURE,
    maxTokens: DEFAULT_OPENCLAW_MAX_TOKENS,
    topP: 1.0,
    presencePenalty: 0.0,
    frequencyPenalty: 0.0,
    systemPrompt: ''
  })

  // --- Helpers ---
  const syncSelectedModel = () => {
    if (availableModels.value.length === 0) {
      selectedModelId.value = ''
      return
    }

    if (selectedModelId.value && availableModels.value.includes(selectedModelId.value)) {
      return
    }

    if (typeof window !== 'undefined') {
      const storedModel = window.localStorage.getItem(getScopedModelStorageKey())
      if (storedModel && availableModels.value.includes(storedModel)) {
        selectedModelId.value = storedModel
        return
      }
    }

    selectedModelId.value = availableModels.value[0]
  }

  // --- Computed ---
  const resolvedErrorMessage = computed(() => {
    return transientError.value || error.value || connectionState.value.lastError || ''
  })

  const canSend = computed(() => {
    return (
      !!conversationStore.inputMessage.trim() &&
      !!selectedModelId.value &&
      isConnected.value &&
      !conversationStore.isSending
    )
  })

  // --- Actions ---
  const loadStoredData = async () => {
    const storedConfig = await robotCredentialService.loadOpenClawConfig(openClawConfig.value, storageScope.value)
    if (storedConfig) {
      openClawConfig.value = { ...openClawConfig.value, ...storedConfig }
    }

    conversationStore.normalizePersistedState()

    if (typeof window !== 'undefined') {
      const scopedModelKey = getScopedModelStorageKey()
      const storedModel = window.localStorage.getItem(scopedModelKey) ?? window.localStorage.getItem(MODEL_STORAGE_KEY)
      if (storedModel) {
        selectedModelId.value = storedModel
        if (window.localStorage.getItem(scopedModelKey) !== storedModel) {
          window.localStorage.setItem(scopedModelKey, storedModel)
        }
      }
    }
  }

  const handleConnect = async () => {
    transientError.value = ''
    try {
      await robotCredentialService.saveOpenClawConfig(openClawConfig.value, storageScope.value)
      await connect({
        gatewayUrl: openClawConfig.value.gatewayUrl,
        token: openClawConfig.value.token,
        autoConnect: openClawConfig.value.autoConnect,
        reconnect: openClawConfig.value.reconnect,
        reconnectInterval: openClawConfig.value.reconnectInterval,
        maxReconnectAttempts: openClawConfig.value.maxReconnectAttempts,
        heartbeatInterval: openClawConfig.value.heartbeatInterval
      })
      syncSelectedModel()
      showFeedback(translate('ai_assistant.connection_success'), 'success')
    } catch (connectError) {
      transientError.value =
        connectError instanceof Error ? connectError.message : translate('ai_assistant.robot.unknown_error')
      logger.error('OpenClaw connection failed:', connectError)
      showFeedback(translate('ai_assistant.robot.openclaw_connection_failed_gateway'), 'error')
    }
  }

  const handleDisconnect = () => {
    disconnect()
    transientError.value = ''
  }

  const handleSend = async (onSuccess?: () => void) => {
    const content = conversationStore.inputMessage.trim()
    if (!content || !conversationStore.currentConversation || !canSend.value) {
      return
    }

    const userMessage: OpenClawWorkbenchMessage = {
      id: conversationStore.createId(),
      role: 'user',
      content,
      createdAt: Date.now(),
      model: selectedModelId.value,
      status: 'done'
    }
    const assistantMessage: OpenClawWorkbenchMessage = {
      id: conversationStore.createId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      model: selectedModelId.value,
      status: 'streaming'
    }

    conversationStore.inputMessage = ''
    transientError.value = ''
    conversationStore.isSending = true

    conversationStore.updateCurrentConversation((conversation) => {
      conversation.messages.push(userMessage, assistantMessage)
      if (conversation.messages.length === 2) {
        conversation.title = conversationStore.buildConversationTitle(content)
      }
    })

    if (onSuccess) onSuccess()

    try {
      // P10: requestAnimationFrame batching for streaming updates
      let pendingContent = ''
      let pendingReasoning = ''
      let rafId: number | null = null
      let lastUpdateTime = Date.now()
      const UPDATE_INTERVAL = 60

      const flushPending = () => {
        rafId = null
        const contentToApply = pendingContent
        const reasoningToApply = pendingReasoning
        pendingContent = ''
        pendingReasoning = ''

        if (!contentToApply && !reasoningToApply) return

        conversationStore.updateCurrentConversation((conversation) => {
          const targetMessage = conversation.messages.find((message) => message.id === assistantMessage.id)
          if (targetMessage) {
            if (reasoningToApply) {
              targetMessage.reasoningContent = (targetMessage.reasoningContent || '') + reasoningToApply
            }
            if (contentToApply) {
              targetMessage.content += contentToApply
            }
          }
        })

        const now = Date.now()
        if (now - lastUpdateTime > UPDATE_INTERVAL) {
          if (onSuccess) onSuccess()
          lastUpdateTime = now
        }
      }

      const scheduleFlush = () => {
        if (rafId === null) {
          rafId = requestAnimationFrame(flushPending)
        }
      }

      for await (const chunk of openClawClient.sendChatCompletion(
        conversationStore
          .currentConversation!.messages.filter((m) => m.id !== assistantMessage.id && m.status !== 'error')
          .map((m) => ({ role: m.role, content: m.content })),
        {
          model: selectedModelId.value,
          temperature: openClawConfig.value.temperature,
          maxTokens: openClawConfig.value.maxTokens,
          topP: openClawConfig.value.topP,
          presencePenalty: openClawConfig.value.presencePenalty,
          frequencyPenalty: openClawConfig.value.frequencyPenalty
        }
      )) {
        if (!chunk.content && !chunk.reasoning_content) continue

        if (chunk.reasoning_content) {
          pendingReasoning += chunk.reasoning_content
        }
        if (chunk.content) {
          pendingContent += chunk.content
        }

        scheduleFlush()
      }

      // Flush any remaining pending content
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      flushPending()

      conversationStore.updateCurrentConversation((conversation) => {
        const targetMessage = conversation.messages.find((message) => message.id === assistantMessage.id)
        if (targetMessage) {
          targetMessage.status = targetMessage.content.trim() ? 'done' : 'error'
          if (targetMessage.status === 'error') {
            targetMessage.errorMessage = translate('ai_assistant.empty_response')
          }
        }
      })
      if (onSuccess) onSuccess()
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : translate('ai_assistant.robot.unknown_error')
      if (message === 'generation_stopped') {
        conversationStore.updateCurrentConversation((conversation) => {
          const targetMessage = conversation.messages.find((item) => item.id === assistantMessage.id)
          if (targetMessage) {
            targetMessage.status = targetMessage.content.trim() ? 'done' : 'error'
          }
        })
      } else {
        transientError.value = message
        conversationStore.updateCurrentConversation((conversation) => {
          const targetMessage = conversation.messages.find((item) => item.id === assistantMessage.id)
          if (targetMessage) {
            targetMessage.status = 'error'
            targetMessage.errorMessage = translate('ai_assistant.robot.send_failed_with_error', { error: message })
          }
        })
      }
    } finally {
      conversationStore.isSending = false
    }
  }

  const handleStopGeneration = () => {
    if (conversationStore.isSending) {
      stopGeneration()
    }
  }

  const handleRegenerate = async (messageId: string, onStart?: () => void) => {
    if (conversationStore.isSending) return
    const conversation = conversationStore.currentConversation
    if (!conversation) return

    const messageIndex = conversation.messages.findIndex((m) => m.id === messageId)
    if (messageIndex === -1) return

    const performRegenerate = async () => {
      let lastUserPrompt = ''
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (conversation.messages[i].role === 'user') {
          lastUserPrompt = conversation.messages[i].content
          break
        }
      }
      if (!lastUserPrompt) return

      conversation.messages.splice(messageIndex)
      conversationStore.inputMessage = lastUserPrompt
      if (onStart) onStart()
      await handleSend()
    }

    if (messageIndex < conversation.messages.length - 1) {
      dialog.warning({
        title: translate('common.confirm'),
        content: translate('ai_assistant.robot.openclaw_regenerate_confirm'),
        positiveText: translate('common.confirm'),
        negativeText: translate('common.cancel'),
        onPositiveClick: () => performRegenerate()
      })
    } else {
      await performRegenerate()
    }
  }

  const loadInstallStatus = async () => {
    await installStore.loadInstallStatus()
  }

  const handleInstallOpenClaw = async () => {
    await installStore.handleInstallOpenClaw(async () => {
      if (!isConnected.value) await handleConnect()
    })
  }

  // --- Watchers ---
  watch(selectedModelId, (val) => {
    if (typeof window !== 'undefined') {
      const storageKey = getScopedModelStorageKey()
      if (val) window.localStorage.setItem(storageKey, val)
      else window.localStorage.removeItem(storageKey)
    }
  })

  watch(
    () => locale.value,
    (newLocale) => {
      dayjs.locale(newLocale === 'zh-CN' ? 'zh-cn' : 'en')
    },
    { immediate: true }
  )

  return {
    // State - from conversation store (wrapped in computed to preserve reactivity)
    conversations: computed(() => conversationStore.conversations),
    activeConversationId: computed({
      get: () => conversationStore.activeConversationId,
      set: (val: string) => {
        conversationStore.activeConversationId = val
      }
    }),
    inputMessage: computed({
      get: () => conversationStore.inputMessage,
      set: (val: string) => {
        conversationStore.inputMessage = val
      }
    }),
    isSending: computed(() => conversationStore.isSending),
    expandedReasoningIds: computed(() => conversationStore.expandedReasoningIds),
    currentConversation: computed(() => conversationStore.currentConversation),
    canSend,

    // State - local
    transientError,
    selectedModelId,
    openClawConfig,

    // State - from install store
    installStatus: installStore.installStatus,
    installStatusLoading: installStore.installStatusLoading,
    installingOpenClaw: installStore.installingOpenClaw,
    installErrorMessage: installStore.installErrorMessage,
    installLogs: installStore.installLogs,

    // State - from useOpenClaw
    isConnected,
    isLoading,
    availableModels,
    connectionState,

    // Computed
    resolvedErrorMessage,

    // Actions - from conversation store
    handleCreateConversation: conversationStore.handleCreateConversation,
    handleDeleteConversation: conversationStore.handleDeleteConversation,
    handleDeleteAllConversations: conversationStore.handleDeleteAllConversations,
    toggleReasoning: conversationStore.toggleReasoning,

    // Actions - local
    loadStoredData,
    handleConnect,
    handleDisconnect,
    handleSend,
    handleStopGeneration,
    handleRegenerate,

    // Actions - from install store
    loadInstallStatus,
    handleInstallOpenClaw,

    // Helpers exposed for parent
    persistConnectionConfig: () => robotCredentialService.saveOpenClawConfig(openClawConfig.value, storageScope.value),

    // Helpers from conversation store
    updateCurrentConversation: conversationStore.updateCurrentConversation,
    createId: conversationStore.createId,
    buildConversationTitle: conversationStore.buildConversationTitle,
    ensureConversation: conversationStore.ensureConversation,

    // Translate
    translate
  }
}
