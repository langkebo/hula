import type { Ref } from 'vue'
import { useMitt } from '@/hooks/useMitt.ts'
import router from '@/router'
import { aiService } from '@/services/matrix/ai/AIService'
import type { ChatRole } from '@/services/matrix/ai/ChatRoleService'
import { conversationService } from '@/services/matrix/ai/ConversationService'
import type { AIModel } from '@/services/matrix/ai/ModelService'
import { createLogger } from '@/utils/Logger'
import type { ConversationMeta, Message } from './useRobotChat'

const logger = createLogger('AiConversationLifecycle')

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

interface UseAiConversationLifecycleOptions {
  currentChat: Ref<ConversationMeta>
  messageList: Ref<Message[]>
  serverTokenUsage: Ref<number | null>
  showDeleteChatConfirm: Ref<boolean>
  deleteWithMessages: Ref<boolean>
  selectedRole: Ref<ChatRole | null>
  selectedModel: Ref<AIModel | null>
  modelList: Ref<AIModel[]>
  roleList: Ref<ChatRole[]>
  bumpMessageRenderVersion: () => void
  fetchModelList: () => Promise<void>
  loadRoleList: () => Promise<void>
  loadRemainingUsage: (modelId: string) => Promise<void>
  loadAudioVoices: (model: AIModel) => Promise<void>
  loadMessages: (conversationId: string) => Promise<void>
}

export const useAiConversationLifecycle = ({
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
}: UseAiConversationLifecycleOptions) => {
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

  return {
    handleCreateNewChat,
    handleDeleteChat,
    handleLeftChatTitle,
    handleChatActive
  }
}
