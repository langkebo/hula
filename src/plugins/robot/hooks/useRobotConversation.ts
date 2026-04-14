import { ref, computed } from 'vue'
import { matrixAIService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useRobotConversation')

export interface ConversationInfo {
  id: string
  title: string
  messageCount: number
  createTime: number
  updateTime?: number
}

export interface ConversationOptions {
  userUid: string
}

export function useRobotConversation(_options?: ConversationOptions) {
  const currentConversation = ref<ConversationInfo>({
    id: '0',
    title: '',
    messageCount: 0,
    createTime: 0
  })

  const conversationList = ref<ConversationInfo[]>([])
  const loadingConversations = ref(false)
  const loadingMessages = ref(false)

  const hasActiveConversation = computed(() => currentConversation.value.id !== '0')

  const createConversation = async (title = '新的会话'): Promise<ConversationInfo | null> => {
    try {
      const result = await matrixAIService.conversationCreate({
        title
      })

      const newConversation: ConversationInfo = {
        id: result.id,
        title: result.title || title,
        messageCount: 0,
        createTime: result.createdAt || Date.now()
      }

      conversationList.value.unshift(newConversation)
      currentConversation.value = newConversation

      logger.debug('创建会话成功:', newConversation)
      return newConversation
    } catch (e) {
      logger.error('创建会话失败:', e)
      window.$message.error('创建会话失败')
      return null
    }
  }

  const loadConversations = async () => {
    loadingConversations.value = true
    try {
      const result = await matrixAIService.conversationGetMy()

      conversationList.value = result.map((item) => ({
        id: item.id,
        title: item.title || '未命名会话',
        messageCount: 0,
        createTime: item.createdAt || Date.now()
      }))

      logger.debug('加载会话列表成功:', conversationList.value.length)
    } catch (e) {
      logger.error('加载会话列表失败:', e)
    } finally {
      loadingConversations.value = false
    }
  }

  const selectConversation = (conversation: ConversationInfo) => {
    currentConversation.value = conversation
    logger.debug('选择会话:', conversation.id)
  }

  const updateConversationTitle = async (title: string): Promise<boolean> => {
    if (!currentConversation.value.id || currentConversation.value.id === '0') {
      return false
    }

    try {
      await matrixAIService.conversationUpdate({
        id: currentConversation.value.id,
        title
      })

      currentConversation.value.title = title

      const index = conversationList.value.findIndex((c) => c.id === currentConversation.value.id)
      if (index !== -1) {
        conversationList.value[index].title = title
      }

      logger.debug('更新会话标题成功:', title)
      return true
    } catch (e) {
      logger.error('更新会话标题失败:', e)
      window.$message.error('更新标题失败')
      return false
    }
  }

  const deleteConversation = async (conversationId: string): Promise<boolean> => {
    try {
      await matrixAIService.conversationDelete([conversationId])

      conversationList.value = conversationList.value.filter((c) => c.id !== conversationId)

      if (currentConversation.value.id === conversationId) {
        currentConversation.value = {
          id: '0',
          title: '',
          messageCount: 0,
          createTime: 0
        }
      }

      logger.debug('删除会话成功:', conversationId)
      window.$message.success('会话已删除')
      return true
    } catch (e) {
      logger.error('删除会话失败:', e)
      window.$message.error('删除会话失败')
      return false
    }
  }

  const incrementMessageCount = () => {
    currentConversation.value.messageCount += 1

    const index = conversationList.value.findIndex((c) => c.id === currentConversation.value.id)
    if (index !== -1) {
      conversationList.value[index].messageCount = currentConversation.value.messageCount
    }
  }

  const resetCurrentConversation = () => {
    currentConversation.value = {
      id: '0',
      title: '',
      messageCount: 0,
      createTime: 0
    }
  }

  return {
    currentConversation,
    conversationList,
    loadingConversations,
    loadingMessages,
    hasActiveConversation,
    createConversation,
    loadConversations,
    selectConversation,
    updateConversationTitle,
    deleteConversation,
    incrementMessageCount,
    resetCurrentConversation
  }
}
