import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { OpenClawConversation, OpenClawWorkbenchMessage } from '@/views/openclaw/types'

const CONVERSATION_STORAGE_KEY = 'openclawConversation'

export const useOpenClawConversationStore = defineStore(
  'openclawConversation',
  () => {
    // --- State ---
    const conversations = ref<OpenClawConversation[]>([])
    const activeConversationId = ref('')
    const inputMessage = ref('')
    const isSending = ref(false)
    const expandedReasoningIds = ref<string[]>([])

    // --- Injected dependencies ---
    const translateFn = ref<(key: string, params?: Record<string, unknown>) => string>((key: string) => key)
    const confirmDeleteAllCallback = ref<(() => Promise<boolean>) | null>(null)

    // --- Helpers ---
    const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    const sanitizeMessage = (message: Partial<OpenClawWorkbenchMessage>): OpenClawWorkbenchMessage | null => {
      if (!message || (message.role !== 'user' && message.role !== 'assistant')) {
        return null
      }

      return {
        id: typeof message.id === 'string' && message.id ? message.id : createId(),
        role: message.role,
        content: typeof message.content === 'string' ? message.content : '',
        reasoningContent: typeof message.reasoningContent === 'string' ? message.reasoningContent : undefined,
        createdAt: typeof message.createdAt === 'number' ? message.createdAt : Date.now(),
        model: typeof message.model === 'string' ? message.model : undefined,
        status:
          message.status === 'done' || message.status === 'streaming' || message.status === 'error'
            ? message.status
            : 'done',
        errorMessage: typeof message.errorMessage === 'string' ? message.errorMessage : undefined
      }
    }

    const sanitizeConversation = (conversation: Partial<OpenClawConversation>): OpenClawConversation | null => {
      if (!conversation || typeof conversation.id !== 'string' || !conversation.id) {
        return null
      }

      const messages = Array.isArray(conversation.messages)
        ? conversation.messages
            .map((message) => sanitizeMessage(message))
            .filter((message): message is OpenClawWorkbenchMessage => !!message)
        : []

      const createdAt = typeof conversation.createdAt === 'number' ? conversation.createdAt : Date.now()
      const updatedAt = typeof conversation.updatedAt === 'number' ? conversation.updatedAt : createdAt

      return {
        id: conversation.id,
        title:
          typeof conversation.title === 'string' && conversation.title.trim()
            ? conversation.title.trim()
            : translateFn.value('ai_assistant.robot.new_conversation_title'),
        createdAt,
        updatedAt,
        messages
      }
    }

    const createConversation = (
      title = translateFn.value('ai_assistant.robot.new_conversation_title')
    ): OpenClawConversation => ({
      id: createId(),
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    })

    const sortConversations = () => {
      conversations.value = [...conversations.value].sort((left, right) => right.updatedAt - left.updatedAt)
    }

    const ensureConversation = () => {
      if (conversations.value.length > 0) {
        if (!activeConversationId.value) {
          activeConversationId.value = conversations.value[0].id
        }
        return
      }

      const conversation = createConversation()
      conversations.value = [conversation]
      activeConversationId.value = conversation.id
    }

    const updateCurrentConversation = (updater: (conversation: OpenClawConversation) => void) => {
      const conversation = conversations.value.find((item) => item.id === activeConversationId.value)
      if (!conversation) return
      updater(conversation)
      conversation.updatedAt = Date.now()
      sortConversations()
    }

    const buildConversationTitle = (message: string) => {
      const normalized = message.trim().replace(/\s+/g, ' ')
      if (!normalized) return translateFn.value('ai_assistant.robot.new_conversation_title')
      return normalized.length > 24 ? `${normalized.slice(0, 24)}...` : normalized
    }

    // --- Computed ---
    const currentConversation = computed(
      () => conversations.value.find((conversation) => conversation.id === activeConversationId.value) ?? null
    )

    const canSend = computed(() => {
      return !!inputMessage.value.trim() && !isSending.value
    })

    // --- Actions ---
    const setTranslate = (fn: (key: string, params?: Record<string, unknown>) => string) => {
      translateFn.value = fn
      normalizePersistedState()
    }

    const setConfirmDeleteAllCallback = (cb: () => Promise<boolean>) => {
      confirmDeleteAllCallback.value = cb
    }

    const normalizePersistedState = () => {
      conversations.value = conversations.value
        .map((conversation) => sanitizeConversation(conversation))
        .filter((conversation): conversation is OpenClawConversation => !!conversation)
      expandedReasoningIds.value = expandedReasoningIds.value.filter((id) => typeof id === 'string' && !!id)
      ensureConversation()
    }

    const handleCreateConversation = () => {
      const conversation = createConversation()
      conversations.value = [conversation, ...conversations.value]
      activeConversationId.value = conversation.id
      inputMessage.value = ''
    }

    const handleDeleteConversation = (id: string) => {
      conversations.value = conversations.value.filter((c) => c.id !== id)
      if (activeConversationId.value === id) {
        activeConversationId.value = conversations.value[0]?.id || ''
      }
      ensureConversation()
    }

    const handleDeleteAllConversations = async () => {
      const confirmed = confirmDeleteAllCallback.value ? await confirmDeleteAllCallback.value() : true
      if (!confirmed) return

      conversations.value = []
      activeConversationId.value = ''
      ensureConversation()
    }

    const toggleReasoning = (messageId: string) => {
      const index = expandedReasoningIds.value.indexOf(messageId)
      if (index > -1) {
        expandedReasoningIds.value.splice(index, 1)
      } else {
        expandedReasoningIds.value.push(messageId)
      }
    }

    return {
      // State
      conversations,
      activeConversationId,
      inputMessage,
      isSending,
      expandedReasoningIds,

      // Computed
      currentConversation,
      canSend,

      // Actions
      handleCreateConversation,
      handleDeleteConversation,
      handleDeleteAllConversations,
      toggleReasoning,
      setTranslate,
      setConfirmDeleteAllCallback,
      normalizePersistedState,

      // Helpers (exposed for use by workbench composable)
      createId,
      createConversation,
      sanitizeMessage,
      sanitizeConversation,
      sortConversations,
      ensureConversation,
      updateCurrentConversation,
      buildConversationTitle
    }
  },
  {
    persist: {
      key: CONVERSATION_STORAGE_KEY,
      pick: ['conversations', 'activeConversationId', 'expandedReasoningIds']
    }
  }
)
