import type { Ref } from 'vue'
import { AiMsgContentTypeEnum } from '@/enums'
import {
  buildAudioGenerationRequest,
  buildImageGenerationRequest,
  buildVideoGenerationRequest
} from '@/plugins/robot/composables/useAiGenerationRequests'
import type { AIAsyncGenerationResponse } from '@/services/matrix/ai/AIService'
import { aiService } from '@/services/matrix/ai/AIService'
import type { AIModel } from '@/services/matrix/ai/ModelService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AiMediaGeneration')
const AI_THINKING_PLACEHOLDER = '正在思考中...'

interface MediaGenerationMessage {
  type: 'user' | 'assistant'
  content: string
  msgType?: AiMsgContentTypeEnum
  createTime?: number
  isGenerating?: boolean
}

interface ConversationRef {
  id: string
}

interface ReadonlyValueRef<T> {
  readonly value: T
}

interface InputRefValue {
  clearInput?: () => void
}

interface ImageParams {
  size: string
}

interface VideoParams {
  size: string
  duration: number
  image?: string | null
}

interface AudioParams {
  voice: string
  speed: number
}

interface UseAiMediaGenerationOptions {
  currentChat: ReadonlyValueRef<ConversationRef>
  conversationTokens: ReadonlyValueRef<number>
  messageList: Ref<MediaGenerationMessage[]>
  msgInputRef: Ref<InputRefValue | undefined>
  imageParams: ReadonlyValueRef<ImageParams>
  videoParams: ReadonlyValueRef<VideoParams>
  audioParams: ReadonlyValueRef<AudioParams>
  bumpMessageRenderVersion: () => void
  clearVideoImage: () => void
  pollImageStatus: (
    taskId: number,
    messageIndex: number,
    prompt: string,
    width: number,
    height: number,
    modelName: string
  ) => void
  pollVideoStatus: (
    taskId: number,
    messageIndex: number,
    prompt: string,
    width: number,
    height: number,
    modelName: string
  ) => void
  pollAudioStatus: (taskId: number, messageIndex: number, prompt: string, modelName: string) => void
}

const extractGenerationTaskId = (result: AIAsyncGenerationResponse) => {
  if (typeof result === 'number') return result
  if (typeof result === 'string') return Number(result)
  return Number(result.id)
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return '未知错误'
}

const getExceededTokenBudget = (model: AIModel, conversationTokens: number) => {
  const tokenBudget = Number(model?.maxTokens || 0)
  return tokenBudget > 0 && conversationTokens >= tokenBudget ? tokenBudget : null
}

const appendGenerationMessages = (
  messageList: Ref<MediaGenerationMessage[]>,
  prompt: string,
  msgType: AiMsgContentTypeEnum,
  bumpMessageRenderVersion: () => void
) => {
  messageList.value.push({
    type: 'user',
    content: prompt,
    msgType,
    createTime: Date.now()
  })

  const aiMessageIndex = messageList.value.length
  messageList.value.push({
    type: 'assistant',
    msgType,
    content: AI_THINKING_PLACEHOLDER,
    createTime: Date.now(),
    isGenerating: true
  })
  bumpMessageRenderVersion()

  return aiMessageIndex
}

const handleGenerationError = (messageList: Ref<MediaGenerationMessage[]>, label: string, error: unknown) => {
  logger.error(`${label}生成失败:`, error)
  const lastMessage = messageList.value[messageList.value.length - 1]
  if (lastMessage?.isGenerating) {
    lastMessage.content = `${label}生成失败: ${getErrorMessage(error)}`
    lastMessage.isGenerating = false
  }
  window.$message.error(`${label}生成失败，请检查网络连接`)
}

export const useAiMediaGeneration = (options: UseAiMediaGenerationOptions) => {
  const {
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
  } = options

  const guardTokenBudget = (model: AIModel) => {
    const exceededTokenBudget = getExceededTokenBudget(model, conversationTokens.value)
    if (exceededTokenBudget === null) return false
    window.$message.warning(`本会话 Token 已用完（${exceededTokenBudget}），请新建会话或更换模型`)
    return true
  }

  const clearInput = () => {
    msgInputRef.value?.clearInput?.()
  }

  const generateImage = async (prompt: string, model: AIModel) => {
    if (guardTokenBudget(model)) return

    const aiMessageIndex = appendGenerationMessages(
      messageList,
      prompt,
      AiMsgContentTypeEnum.IMAGE,
      bumpMessageRenderVersion
    )

    try {
      const imageRequest = buildImageGenerationRequest({
        modelId: String(model.id),
        prompt,
        size: imageParams.value.size,
        conversationId: currentChat.value.id
      })
      const imageResult = await aiService.generateImage(imageRequest.request)
      const imageId = extractGenerationTaskId(imageResult)
      void pollImageStatus(
        imageId,
        aiMessageIndex,
        prompt,
        imageRequest.size.width,
        imageRequest.size.height,
        model.name
      )
      clearInput()
    } catch (error) {
      handleGenerationError(messageList, '图片', error)
    }
  }

  const generateVideo = async (prompt: string, model: AIModel) => {
    if (guardTokenBudget(model)) return

    const aiMessageIndex = appendGenerationMessages(
      messageList,
      prompt,
      AiMsgContentTypeEnum.VIDEO,
      bumpMessageRenderVersion
    )

    try {
      const videoRequest = buildVideoGenerationRequest({
        modelId: String(model.id),
        prompt,
        size: videoParams.value.size,
        duration: videoParams.value.duration,
        conversationId: currentChat.value.id,
        image: videoParams.value.image
      })
      const videoResult = await aiService.videoGenerate(videoRequest.request)
      const videoId = extractGenerationTaskId(videoResult)
      void pollVideoStatus(
        videoId,
        aiMessageIndex,
        prompt,
        videoRequest.size.width,
        videoRequest.size.height,
        model.name
      )
      clearInput()
      clearVideoImage()
    } catch (error) {
      handleGenerationError(messageList, '视频', error)
    }
  }

  const generateAudio = async (prompt: string, model: AIModel) => {
    if (guardTokenBudget(model)) return

    const aiMessageIndex = appendGenerationMessages(
      messageList,
      prompt,
      AiMsgContentTypeEnum.AUDIO,
      bumpMessageRenderVersion
    )

    try {
      const audioResult = await aiService.audioGenerate(
        buildAudioGenerationRequest({
          modelId: String(model.id),
          prompt,
          conversationId: currentChat.value.id,
          voice: audioParams.value.voice,
          speed: audioParams.value.speed
        })
      )
      const audioId = extractGenerationTaskId(audioResult)
      void pollAudioStatus(audioId, aiMessageIndex, prompt, model.name)
      clearInput()
    } catch (error) {
      handleGenerationError(messageList, '音频', error)
    }
  }

  return {
    generateImage,
    generateVideo,
    generateAudio
  }
}
