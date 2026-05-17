import { type Ref, ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { AiMsgContentTypeEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import { aiService } from '@/services/matrix/ai/AIService'
import type { AIModel } from '@/services/matrix/ai/ModelService'
import { createLogger } from '@/utils/Logger'
import type { ConversationMeta, Message } from './useRobotChat'

const logger = createLogger('AiStreaming')

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
  const { t } = useI18nGlobal()
  const { showFeedback, showProgressFeedback, clearFeedback } = useActionFeedback()
  const isAIStreaming = ref(false)
  const currentAiRequestId = ref<string | null>(null)
  const currentAiAccumulatedContent = ref('')
  const lastAiPrompt = ref('')

  const handleOpenClawSend = async (content: string) => {
    if (!isOpenClawConnected.value) {
      showFeedback(t('ai_assistant.robot.openclaw_not_connected'), 'warning')
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
      messageList.value[aiMessageIndex].content = t('ai_assistant.robot.send_failed_with_error', {
        error: error instanceof Error ? error.message : t('ai_assistant.robot.unknown_error')
      })
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
        showFeedback(t('ai_assistant.robot.token_budget_exceeded', { budget: tokenBudget }), 'warning')
        return
      }

      showProgressFeedback(t('ai_assistant.robot.ai_thinking'), 'loading', 'polite', { duration: 0 })
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
        content: t('ai_assistant.robot.thinking'),
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
                    messageList.value[aiMessageIndex].content === t('ai_assistant.robot.thinking') &&
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
              if (
                messageList.value[aiMessageIndex].content === t('ai_assistant.robot.thinking') &&
                accumulatedContent === ''
              ) {
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
                .catch(() => {
                  /* token usage fetch is best-effort */
                })

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
                  .catch(() => {
                    /* reasoning content fetch is best-effort */
                  })
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
      showFeedback(t('ai_assistant.robot.send_failed_network'), 'error')
    } finally {
      clearFeedback()
    }
  }

  const handleStopAIStream = async () => {
    if (!isAIStreaming.value || !currentAiRequestId.value) return
    try {
      clearFeedback()
      await aiService.messageCancelStream(currentAiRequestId.value)
      await new Promise((resolve) => setTimeout(resolve, 180))
      const lastMessage = messageList.value[messageList.value.length - 1]
      if (lastMessage && lastMessage.type === 'assistant' && lastMessage.content === t('ai_assistant.robot.thinking')) {
        lastMessage.content = ''
      }
      const latest =
        lastMessage &&
        lastMessage.type === 'assistant' &&
        lastMessage.content &&
        lastMessage.content !== t('ai_assistant.robot.thinking')
          ? lastMessage.content
          : currentAiAccumulatedContent.value
      if (latest?.trim()) {
        await aiService.messageSaveGeneratedContent({
          conversationId: currentChat.value.id,
          prompt: lastAiPrompt.value,
          generatedContent: latest
        })
      }
      showFeedback(t('ai_assistant.robot.generation_stopped'), 'success')
    } catch (error) {
      logger.error('停止生成失败:', error)
      showFeedback(t('ai_assistant.robot.stop_generation_failed'), 'error')
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
