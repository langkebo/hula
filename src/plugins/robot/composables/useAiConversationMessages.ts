import { type Ref, ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { AiMsgContentTypeEnum } from '@/enums'
import { isLikelyImageUrl, isLikelyMediaUrl } from '@/plugins/robot/utils/aiMediaUrl'
import { useI18nGlobal } from '@/services/i18n'
import type { AIConversation } from '@/services/matrix/ai/AIService'
import { aiService } from '@/services/matrix/ai/AIService'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'
import type { Message } from './useRobotChat'

const logger = createLogger('AiConversationMessages')
const MAX_MESSAGE_COUNT = 40

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

interface ConversationUsage extends AIConversation {
  tokenUsage?: number
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

interface UseAiConversationMessagesOptions {
  currentChat: Ref<{ id: string; messageCount: number; createTime: number }>
  messageList: Ref<Message[]>
  serverTokenUsage: Ref<number | null>
  bumpMessageRenderVersion: () => void
  ensureLocalAiImage: (url: string, index: number) => Promise<void>
  ensureLocalAiVideo: (url: string, index: number) => Promise<void>
  ensureLocalAiAudio: (url: string, index: number) => Promise<void>
}

export const useAiConversationMessages = ({
  currentChat,
  messageList,
  serverTokenUsage,
  bumpMessageRenderVersion,
  ensureLocalAiImage,
  ensureLocalAiVideo,
  ensureLocalAiAudio
}: UseAiConversationMessagesOptions) => {
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()
  const userStore = useUserStore()
  const loadingMessages = ref(false)

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
      showFeedback('加载消息失败', 'error')
      messageList.value = []
      bumpMessageRenderVersion()
    } finally {
      loadingMessages.value = false
    }
  }

  const handleDeleteMessage = async (messageId: string, index: number) => {
    if (!messageId) {
      showFeedback('消息ID无效', 'warning')
      return
    }

    try {
      await aiService.messageDelete({ id: messageId })
      messageList.value.splice(index, 1)
      bumpMessageRenderVersion()
      showFeedback(t('ai_assistant.robot.message_deleted'), 'success')

      currentChat.value.messageCount = Math.max((currentChat.value.messageCount || 0) - 1, 0)
      const latestEntry = messageList.value[messageList.value.length - 1]
      const latestTimestamp = latestEntry?.createTime ?? currentChat.value.createTime ?? Date.now()
      notifyConversationMetaChange({
        messageCount: currentChat.value.messageCount,
        createTime: latestTimestamp
      })
    } catch (error) {
      logger.error('删除消息失败:', error)
      showFeedback('删除消息失败', 'error')
    }
  }

  return {
    loadingMessages,
    loadMessages,
    handleDeleteMessage,
    notifyConversationMetaChange
  }
}
