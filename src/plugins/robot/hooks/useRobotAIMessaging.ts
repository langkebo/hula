import { ref } from 'vue'
import { matrixAIService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'
import { AiMsgContentTypeEnum } from '@/enums'
import type { Message, ModelInfo, AIProvider } from './useRobotChat'

const logger = createLogger('useRobotAIMessaging')

const AI_THINKING_PLACEHOLDER = '正在思考中...'

export interface AIMessagingOptions {
  aiProvider: AIProvider
  selectedModel: ModelInfo | null
  currentChatId: string
  conversationTokens: number
  isOpenClawConnected: boolean
  sendOpenClawMessage: (content: string, onChunk: (text: string) => void) => AsyncGenerator<string, void, unknown>
}

export function useRobotAIMessaging() {
  const isAIStreaming = ref(false)
  const currentAiRequestId = ref<string | null>(null)
  const currentAiAccumulatedContent = ref('')
  const lastAiPrompt = ref('')

  const isLikelyImageUrl = (value?: string): boolean => {
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

  const isLikelyMediaUrl = (value?: string): boolean => {
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

  const isRenderableAiImage = (message: Message): boolean => {
    if (message.type !== 'assistant') return false
    if (!isLikelyImageUrl(message.content)) return false
    return message.msgType === AiMsgContentTypeEnum.IMAGE || message.msgType === undefined || message.msgType === null
  }

  const getAiPlaceholderText = (message: Message, streaming: boolean): string => {
    if (message.content && message.content.trim()) return message.content
    return streaming ? AI_THINKING_PLACEHOLDER : ''
  }

  const createMessage = (
    type: 'user' | 'assistant',
    content: string,
    msgType = AiMsgContentTypeEnum.TEXT
  ): Message => ({
    type,
    msgType,
    content,
    createTime: Date.now()
  })

  const handleOpenClawSend = async (
    content: string,
    messageList: Message[],
    isOpenClawConnected: boolean,
    sendOpenClawMessage: (content: string, onChunk: (text: string) => void) => AsyncGenerator<string, void, unknown>,
    onMessageUpdate: (index: number, content: string) => void,
    scrollToBottom: () => void
  ): Promise<boolean> => {
    if (!isOpenClawConnected) {
      window.$message.warning('OpenClaw 未连接，请检查 Gateway')
      return false
    }

    messageList.push(createMessage('user', content))

    const aiMessageIndex = messageList.length
    messageList.push(createMessage('assistant', ''))

    scrollToBottom()
    isAIStreaming.value = true

    try {
      for await (const _ of sendOpenClawMessage(content, (text) => {
        onMessageUpdate(aiMessageIndex, text)
        scrollToBottom()
      })) {
        // 流式接收中
      }
      return true
    } catch (e) {
      logger.error('OpenClaw 发送失败:', e)
      onMessageUpdate(aiMessageIndex, '发送失败: ' + (e instanceof Error ? e.message : '未知错误'))
      return false
    } finally {
      isAIStreaming.value = false
    }
  }

  const sendAIMessage = async (
    content: string,
    model: ModelInfo,
    chatId: string,
    messageList: Message[],
    conversationTokens: number,
    onMessageUpdate: (index: number, updates: Partial<Message>) => void,
    scrollToBottom: () => void,
    onConversationUpdate?: (updates: { messageCount?: number; createTime?: number }) => void
  ): Promise<boolean> => {
    lastAiPrompt.value = content
    currentAiAccumulatedContent.value = ''

    const tokenBudget = Number(model?.maxTokens || 0)
    if (tokenBudget > 0 && conversationTokens >= tokenBudget) {
      window.$message.warning(`本会话 Token 已用完（${tokenBudget}），请新建会话或更换模型`)
      return false
    }

    window.$message.loading('AI思考中...', { duration: 0 })

    logger.debug('开始发送AI消息:', {
      内容: content,
      模型: model.name,
      会话ID: chatId
    })

    messageList.push(createMessage('user', content))

    const aiMessageIndex = messageList.length
    messageList.push({
      ...createMessage('assistant', AI_THINKING_PLACEHOLDER),
      msgType: AiMsgContentTypeEnum.TEXT
    })

    scrollToBottom()
    let accumulatedContent = ''
    let accumulatedReasoningContent = ''

    onConversationUpdate?.({
      messageCount: (messageList.length / 2) * 2,
      createTime: Date.now()
    })

    isAIStreaming.value = true

    try {
      await matrixAIService.messageSendStream(chatId, content, {
        onStart: (rid: string) => {
          currentAiRequestId.value = rid
        },
        onChunk: (chunk: string) => {
          let handled = false
          try {
            const data = JSON.parse(chunk)
            if (data && data.success && data.data?.receive) {
              if (data.data.receive.content) {
                const incrementalContent = data.data.receive.content
                if (messageList[aiMessageIndex].content === AI_THINKING_PLACEHOLDER && accumulatedContent === '') {
                  onMessageUpdate(aiMessageIndex, { content: '' })
                }
                accumulatedContent += incrementalContent
                onMessageUpdate(aiMessageIndex, { content: accumulatedContent })
                currentAiAccumulatedContent.value = accumulatedContent
              }
              if (data.data.receive.reasoningContent) {
                const incrementalReasoningContent = data.data.receive.reasoningContent
                accumulatedReasoningContent += incrementalReasoningContent
                onMessageUpdate(aiMessageIndex, { reasoningContent: accumulatedReasoningContent })
              }
              if (data.data.receive.msgType !== undefined) {
                onMessageUpdate(aiMessageIndex, { msgType: data.data.receive.msgType })
              }
              handled = true
            }
          } catch {
            // JSON 解析失败，作为普通文本处理
          }

          if (!handled) {
            const incrementalContent = chunk || ''
            if (messageList[aiMessageIndex].content === AI_THINKING_PLACEHOLDER && accumulatedContent === '') {
              onMessageUpdate(aiMessageIndex, { content: '' })
            }
            accumulatedContent += incrementalContent
            onMessageUpdate(aiMessageIndex, { content: accumulatedContent })
            currentAiAccumulatedContent.value = accumulatedContent
          }

          scrollToBottom()
        },
        onDone: () => {
          isAIStreaming.value = false
          currentAiRequestId.value = null
          scrollToBottom()
          onConversationUpdate?.({ createTime: Date.now() })
          window.$message.destroyAll()
        },
        onError: (error: string) => {
          logger.error('AI消息发送失败:', error)
          isAIStreaming.value = false
          currentAiRequestId.value = null
          onMessageUpdate(aiMessageIndex, { content: '发送失败: ' + error })
          window.$message.destroyAll()
          window.$message.error('AI消息发送失败')
        }
      })

      return true
    } catch (e) {
      logger.error('AI消息发送异常:', e)
      isAIStreaming.value = false
      onMessageUpdate(aiMessageIndex, { content: '发送失败: ' + (e instanceof Error ? e.message : '未知错误') })
      window.$message.destroyAll()
      return false
    }
  }

  const stopAIStream = () => {
    if (currentAiRequestId.value) {
      isAIStreaming.value = false
      currentAiRequestId.value = null
      window.$message.destroyAll()
    }
  }

  return {
    isAIStreaming,
    currentAiRequestId,
    currentAiAccumulatedContent,
    lastAiPrompt,
    AI_THINKING_PLACEHOLDER,
    isLikelyImageUrl,
    isLikelyMediaUrl,
    isRenderableAiImage,
    getAiPlaceholderText,
    createMessage,
    handleOpenClawSend,
    sendAIMessage,
    stopAIStream
  }
}
