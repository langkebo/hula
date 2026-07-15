/**
 * AI 图像 / 视频 / 音频生成参数族 + 视频参考图上传。
 *
 * 从 `useRobotChat` 抽离的自包含三组生成参数：尺寸 / 时长 / 声音 / 速度选项与
 * 当前选择 ref，加上视频参考图上传的本地 file ref + 预览 url + 上传中标志，
 * 以及配套工具：`loadAudioVoices`（按模型同步声音列表）/ `clearVideoImage` /
 * `handleVideoImageUpload`（10MB JPG/PNG/WEBP 校验 + 走 useUpload 的 CHAT scene）。
 *
 * 外部仅依赖 `aiService.audioGetVoices` 与 `useUpload`，无需注入。
 */

import type { UploadFileInfo } from 'naive-ui'
import { computed, ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { UploadProviderEnum, useUpload } from '@/composables/common/useUpload'
import { UploadSceneEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import { aiService } from '@/services/matrix/ai/AIService'
import type { AIModel } from '@/services/matrix/ai/ModelService'
import type { AIVoice } from '@/types/matrix-api'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AiGenerationParams')

export interface VideoImageUploadPayload {
  file: UploadFileInfo
  onFinish: () => void
  onError: () => void
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

export const useAiGenerationParams = () => {
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()
  const imageParams = ref({
    size: '1024x1024'
  })
  const imageSizeOptions = computed(() => [
    { label: `1024x1024 (${t('ai_assistant.robot.size_square')})`, value: '1024x1024' },
    { label: `1024x1792 (${t('ai_assistant.robot.size_portrait')})`, value: '1024x1792' },
    { label: `1792x1024 (${t('ai_assistant.robot.size_landscape')})`, value: '1792x1024' }
  ])

  const videoParams = ref({
    size: '1280x720',
    duration: 5,
    image: null as string | null
  })
  const videoSizeOptions = computed(() => [
    { label: `1280x720 (${t('ai_assistant.robot.size_landscape')})`, value: '1280x720' },
    { label: `720x1280 (${t('ai_assistant.robot.size_portrait')})`, value: '720x1280' },
    { label: `960x960 (${t('ai_assistant.robot.size_square')})`, value: '960x960' }
  ])
  const videoDurationOptions = computed(() => [
    { label: t('ai_assistant.robot.duration_seconds', { seconds: 5 }), value: 5 },
    { label: t('ai_assistant.robot.duration_seconds', { seconds: 10 }), value: 10 }
  ])

  const audioParams = ref({
    voice: 'alloy',
    speed: 1.0
  })
  const audioVoiceOptions = ref([
    { label: `Alloy (${t('ai_assistant.robot.voice_neutral')})`, value: 'alloy' },
    { label: `Echo (${t('ai_assistant.robot.voice_male')})`, value: 'echo' },
    { label: `Fable (${t('ai_assistant.robot.voice_male')})`, value: 'fable' },
    { label: `Onyx (${t('ai_assistant.robot.voice_male')})`, value: 'onyx' },
    { label: `Nova (${t('ai_assistant.robot.voice_female')})`, value: 'nova' },
    { label: `Shimmer (${t('ai_assistant.robot.voice_female')})`, value: 'shimmer' }
  ])
  const audioSpeedOptions = computed(() => [
    { label: `0.5x (${t('ai_assistant.robot.speed_slow')})`, value: 0.5 },
    { label: '0.75x', value: 0.75 },
    { label: `1.0x (${t('ai_assistant.robot.speed_normal')})`, value: 1.0 },
    { label: '1.25x', value: 1.25 },
    { label: `1.5x (${t('ai_assistant.robot.speed_fast')})`, value: 1.5 },
    { label: `2.0x (${t('ai_assistant.robot.speed_extreme')})`, value: 2.0 }
  ])

  const videoImageFileRef = ref<{ clear?: () => void } | null>(null)
  const videoImagePreview = ref<string | null>(null)
  const isUploadingVideoImage = ref(false)
  const { uploadFile: uploadReferenceImage, fileInfo } = useUpload()

  const loadAudioVoices = async (model: AIModel) => {
    try {
      if (!model?.model) return

      const voices = await aiService.audioGetVoices({ model: model.model })
      if (voices && voices.length > 0) {
        audioVoiceOptions.value = voices.map((voice: AIVoice | string) => {
          const rawVoice = typeof voice === 'string' ? voice : voice.name
          const voiceName = rawVoice.includes(':') ? rawVoice.split(':')[1] : rawVoice
          return {
            label: voiceName.charAt(0).toUpperCase() + voiceName.slice(1),
            value: rawVoice
          }
        })
        if (audioVoiceOptions.value.length > 0) {
          audioParams.value.voice = audioVoiceOptions.value[0].value
        }
      } else {
        audioVoiceOptions.value = [{ label: 'Default', value: 'default' }]
        audioParams.value.voice = 'default'
      }
    } catch (error) {
      logger.error('加载声音列表失败:', error)
    }
  }

  const clearVideoImage = () => {
    videoParams.value.image = null
    videoImagePreview.value = null
    videoImageFileRef.value?.clear?.()
  }

  const handleVideoImageUpload = async (payload: VideoImageUploadPayload) => {
    const file = payload.file.file as File
    if (!file) {
      payload.onError()
      return
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showFeedback(t('ai_assistant.robot.image_format_not_supported'), 'error')
      payload.onError()
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      showFeedback(t('ai_assistant.robot.image_size_exceeded'), 'error')
      payload.onError()
      return
    }

    try {
      isUploadingVideoImage.value = true
      await uploadReferenceImage(file, {
        provider: UploadProviderEnum.DEFAULT,
        scene: UploadSceneEnum.CHAT,
        enableDeduplication: true
      })

      const uploadedUrl = fileInfo.value?.downloadUrl
      if (!uploadedUrl) {
        throw new Error(t('ai_assistant.robot.image_url_not_found'))
      }

      videoParams.value.image = uploadedUrl
      videoImagePreview.value = uploadedUrl
      payload.onFinish()
    } catch (error) {
      logger.error('图片上传失败:', error)
      payload.onError()
    } finally {
      isUploadingVideoImage.value = false
    }
  }

  return {
    imageParams,
    imageSizeOptions,
    videoParams,
    videoSizeOptions,
    videoDurationOptions,
    audioParams,
    audioVoiceOptions,
    audioSpeedOptions,
    videoImageFileRef,
    videoImagePreview,
    isUploadingVideoImage,
    loadAudioVoices,
    clearVideoImage,
    handleVideoImageUpload
  }
}
