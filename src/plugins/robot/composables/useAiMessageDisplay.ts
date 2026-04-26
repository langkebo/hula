import { type Ref } from 'vue'
import { AiMsgContentTypeEnum } from '@/enums'
import { isLikelyImageUrl } from '@/plugins/robot/utils/aiMediaUrl'
import type { AIModel } from '@/services/matrix'
import type { Message } from './useRobotChat'

const DEFAULT_AVATAR = 'https://img1.baidu.com/it/u=3613958228,3522035000&fm=253&fmt=auto&app=120&f=JPEG?w=500&h=500'
const AI_THINKING_PLACEHOLDER = '正在思考中...'

interface UseAiMessageDisplayOptions {
  isAIStreaming: Ref<boolean>
}

export const useAiMessageDisplay = ({ isAIStreaming }: UseAiMessageDisplayOptions) => {
  const getDefaultAvatar = () => DEFAULT_AVATAR

  const getModelAvatar = (model: AIModel | null) => {
    if (!model) return DEFAULT_AVATAR
    if (model.avatar) return model.avatar
    return DEFAULT_AVATAR
  }

  const isRenderableAiImage = (message: Message) => {
    if (message.type !== 'assistant') return false
    if (!isLikelyImageUrl(message.content)) return false
    return message.msgType === AiMsgContentTypeEnum.IMAGE || message.msgType === undefined || message.msgType === null
  }

  const getMessageBubbleClass = (message: Message) => {
    if (message.type === 'assistant' && isRenderableAiImage(message)) {
      return []
    }
    return ['bubble', message.type === 'user' ? 'bubble-oneself' : 'bubble-ai']
  }

  const getAiPlaceholderText = (message: Message) => {
    if (message.content && message.content.trim()) return message.content
    return isAIStreaming.value ? AI_THINKING_PLACEHOLDER : ''
  }

  return {
    getDefaultAvatar,
    getModelAvatar,
    isRenderableAiImage,
    getMessageBubbleClass,
    getAiPlaceholderText
  }
}
