import type { Ref } from 'vue'
import { AiMsgContentTypeEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import { aiService } from '@/services/matrix/ai/AIService'
import type { AIAudio, AIImage, AIVideo } from '@/types/matrix-api'
import { createLogger } from '@/utils/Logger'
import { usePollingTasks } from './usePollingTasks'
import type { Message } from './useRobotChat'

const logger = createLogger('AiGenerationPolling')
const MAX_POLL_DURATION = 5 * 60 * 1000

interface PollingRecord {
  status?: number
  errorMessage?: string
}

interface UseAiGenerationPollingOptions {
  currentChat: Ref<{ id: string }>
  messageList: Ref<Message[]>
  bumpMessageRenderVersion: () => void
  ensureLocalAiImage: (url: string, messageIndex: number) => Promise<void>
  ensureLocalAiVideo: (url: string, messageIndex: number) => Promise<void>
  ensureLocalAiAudio: (url: string, messageIndex: number) => Promise<void>
  getCurrentAudioInfo: () => { voice: string; speed: number }
}

interface PollGenerationOptions<T extends PollingRecord> {
  taskId: number
  interval: number
  conversationId: string
  messageIndex: number
  timeoutContent: string
  timeoutToast: string
  missingContent: string
  errorLogLabel: string
  fetchRecords: () => Promise<T[]>
  handleSuccess: (record: T) => void
  resolveFailureContent: (record: T) => string
  failureToast: string
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return useI18nGlobal().t('ai_assistant.robot.unknown_error')
}

export const useAiGenerationPolling = ({
  currentChat,
  messageList,
  bumpMessageRenderVersion,
  ensureLocalAiImage,
  ensureLocalAiVideo,
  ensureLocalAiAudio,
  getCurrentAudioInfo
}: UseAiGenerationPollingOptions) => {
  const { t } = useI18nGlobal()
  const pollingTasks = usePollingTasks()

  const markMessageFailed = (messageIndex: number, content: string) => {
    const targetMessage = messageList.value[messageIndex]
    if (!targetMessage) return
    targetMessage.content = content
    targetMessage.isGenerating = false
  }

  const pollGeneration = async <T extends PollingRecord>({
    taskId,
    interval,
    conversationId,
    messageIndex,
    timeoutContent,
    timeoutToast,
    missingContent,
    errorLogLabel,
    fetchRecords,
    handleSuccess,
    resolveFailureContent,
    failureToast
  }: PollGenerationOptions<T>) => {
    const poll = async () => {
      const task = pollingTasks.get(taskId)
      if (!task) return

      if (Date.now() - task.startedAt > MAX_POLL_DURATION) {
        pollingTasks.stop(taskId)
        markMessageFailed(messageIndex, timeoutContent)
        window.$message.warning(timeoutToast)
        return
      }

      try {
        if (!pollingTasks.has(taskId)) return

        const records = await fetchRecords()
        if (!Array.isArray(records) || records.length === 0) {
          markMessageFailed(messageIndex, missingContent)
          pollingTasks.stop(taskId)
          return
        }

        const record = records[0]
        if (record.status === 20) {
          handleSuccess(record)
          pollingTasks.stop(taskId)
          return
        }

        if (record.status === 30) {
          markMessageFailed(messageIndex, resolveFailureContent(record))
          window.$message.error(failureToast)
          pollingTasks.stop(taskId)
        }
      } catch (error) {
        logger.error(errorLogLabel, error)
        markMessageFailed(messageIndex, t('ai_assistant.robot.query_status_failed', { error: getErrorMessage(error) }))
        pollingTasks.stop(taskId)
      }
    }

    const timerId = window.setInterval(() => {
      void poll()
    }, interval)

    pollingTasks.register(taskId, conversationId, timerId)
    await poll()
  }

  const pollImageStatus = async (
    imageId: number,
    messageIndex: number,
    prompt: string,
    width: number,
    height: number,
    modelName: string
  ) => {
    await pollGeneration<AIImage>({
      taskId: imageId,
      interval: 3000,
      conversationId: currentChat.value.id,
      messageIndex,
      timeoutContent: t('ai_assistant.robot.image_generation_timeout_retry'),
      timeoutToast: t('ai_assistant.robot.image_generation_timeout_stopped'),
      missingContent: t('ai_assistant.robot.image_generation_failed_no_record'),
      errorLogLabel: '轮询图片状态失败:',
      fetchRecords: () => aiService.imageMyListByIds({ ids: imageId.toString() }),
      handleSuccess: (image) => {
        messageList.value[messageIndex] = {
          type: 'assistant',
          content: image.picUrl || image.url,
          msgType: AiMsgContentTypeEnum.IMAGE,
          createTime: Date.now(),
          isGenerating: false,
          imageUrl: image.picUrl || image.url,
          imageInfo: {
            prompt,
            width,
            height,
            model: modelName
          }
        }
        void ensureLocalAiImage(image.picUrl || image.url, messageIndex)
        window.$message.success(t('ai_assistant.robot.image_generation_success'))
        bumpMessageRenderVersion()
      },
      resolveFailureContent: (image) =>
        t('ai_assistant.robot.image_generation_failed_error', {
          error: image.errorMessage || t('ai_assistant.robot.unknown_error')
        }),
      failureToast: t('ai_assistant.robot.image_generation_failed')
    })
  }

  const pollVideoStatus = async (
    videoId: number,
    messageIndex: number,
    prompt: string,
    width: number,
    height: number,
    modelName: string
  ) => {
    await pollGeneration<AIVideo>({
      taskId: videoId,
      interval: 5000,
      conversationId: currentChat.value.id,
      messageIndex,
      timeoutContent: t('ai_assistant.robot.video_generation_timeout_retry'),
      timeoutToast: t('ai_assistant.robot.video_generation_timeout_stopped'),
      missingContent: t('ai_assistant.robot.video_generation_failed_no_record'),
      errorLogLabel: '轮询视频状态失败:',
      fetchRecords: () => aiService.videoMyListByIds({ ids: videoId.toString() }),
      handleSuccess: (video) => {
        messageList.value[messageIndex] = {
          type: 'assistant',
          content: video.videoUrl || video.url,
          msgType: AiMsgContentTypeEnum.VIDEO,
          createTime: Date.now(),
          isGenerating: false,
          videoUrl: video.videoUrl || video.url,
          videoInfo: {
            prompt,
            width,
            height,
            model: modelName
          }
        }
        void ensureLocalAiVideo(video.videoUrl || video.url, messageIndex)
        window.$message.success('视频生成成功')
        bumpMessageRenderVersion()
      },
      resolveFailureContent: (video) =>
        t('ai_assistant.robot.video_generation_failed_error', {
          error: video.errorMessage || t('ai_assistant.robot.unknown_error')
        }),
      failureToast: t('ai_assistant.robot.video_generation_failed')
    })
  }

  const pollAudioStatus = async (audioId: number, messageIndex: number, prompt: string, modelName: string) => {
    await pollGeneration<AIAudio>({
      taskId: audioId,
      interval: 3000,
      conversationId: currentChat.value.id,
      messageIndex,
      timeoutContent: '音频生成超时，请重试',
      timeoutToast: '音频生成超时，已停止轮询',
      missingContent: '音频生成失败: 记录不存在',
      errorLogLabel: '轮询音频状态失败:',
      fetchRecords: () => aiService.audioMyListByIds({ ids: audioId.toString() }),
      handleSuccess: (audio) => {
        const audioInfo = getCurrentAudioInfo()
        messageList.value[messageIndex] = {
          type: 'assistant',
          content: audio.audioUrl || audio.url,
          msgType: AiMsgContentTypeEnum.AUDIO,
          createTime: Date.now(),
          isGenerating: false,
          audioUrl: audio.audioUrl || audio.url,
          audioInfo: {
            prompt,
            model: modelName,
            voice: audioInfo.voice,
            speed: audioInfo.speed
          }
        }
        void ensureLocalAiAudio(audio.audioUrl || audio.url, messageIndex)
        window.$message.success(t('ai_assistant.robot.audio_generation_success'))
        bumpMessageRenderVersion()
      },
      resolveFailureContent: (audio) =>
        t('ai_assistant.robot.audio_generation_failed_error', {
          error: audio.errorMessage || t('ai_assistant.robot.unknown_error')
        }),
      failureToast: t('ai_assistant.robot.audio_generation_failed')
    })
  }

  return {
    stopAllPolling: pollingTasks.stopAll,
    stopConversationPolling: pollingTasks.stopByConversation,
    pollImageStatus,
    pollVideoStatus,
    pollAudioStatus
  }
}
