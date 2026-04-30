import { type Ref, ref } from 'vue'
import { AiMsgContentTypeEnum } from '@/enums'
import type { AIModel } from '@/services/matrix'
import { aiService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'
import type { ConversationMeta, Message } from './useRobotChat'

const logger = createLogger('AiStreaming')
const AI_THINKING_PLACEHOLDER = '正在思考中...'

interface ConversationUsage {
  tokenUsage?: number
}

interface AIConversationMessage {
  type?: 'user' | 'assistant'
  role?: 'user' | 'assistant' | 'system'
  reasoningContent?: string
}

interface UseAiStreamingOptions {
  currentChat: Ref<ConversationMeta>
  messageList: Ref<Message[]>
  conversationTokens: Ref<number>
  reasoningEnabled: Ref<boolean>
  msgInputRef: Ref<{ clearInput?: () => void } | undefined>
  isOpenClawConnected: Ref<boolean>
  bumpMessageRenderVersion: () => void
  notifyConversationMetaChange: (payload: { messageCount?: number; createTime: number }) => void
  loadRemainingUsage: (modelId: string) => Promise<void>
  sendOpenClawMessage: (content: string, onChunk: (text: string) => void) => AsyncIterable<unknown>
  onTokenUsageUpdate: (usage: number) => void
}

export const useAiStreaming = ({
  currentChat,
  messageList,
  conversationTokens,
  reasoningEnabled,
  msgInputRef,
  isOpenClawConnected,
  bumpMessageRenderVersion,
  notifyConversationMetaChange,
  loadRemainingUsage,
  sendOpenClawMessage,
  onTokenUsageUpdate
}: UseAiStreamingOptions) => {
  const isAIStreaming = ref(false)
  const currentAiRequestId = ref<string | null>(null)
  const currentAiAccumulatedContent = ref('')
  const lastAiPrompt = ref('')

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
              if (data?.success && data.data?.receive) {
                if (data.data.receive.content) {
                  const incrementalContent = data.data.receive.content
                  if (
                    messageList.value[aiMessageIndex].content === AI_THINKING_PLACEHOLDER &&
                    accumulatedContent === ''
                  ) {
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
                    onTokenUsageUpdate(conversation.tokenUsage)
                  }
                })
                .catch(() => {})

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

              if (model.id) {
                void loadRemainingUsage(String(model.id))
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
        lastMessage &&
        lastMessage.type === 'assistant' &&
        lastMessage.content &&
        lastMessage.content !== AI_THINKING_PLACEHOLDER
          ? lastMessage.content
          : currentAiAccumulatedContent.value
      if (latest?.trim()) {
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

  return {
    isAIStreaming,
    currentAiRequestId,
    currentAiAccumulatedContent,
    lastAiPrompt,
    sendAIMessage,
    handleStopAIStream,
    handleOpenClawSend
  }
}
