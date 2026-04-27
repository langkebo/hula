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
import { ref } from 'vue'
import type { UploadFileInfo } from 'naive-ui'
import { aiService } from '@/services/matrix'
import type { AIModel } from '@/services/matrix'
import type { AIVoice } from '@/types/matrix-api'
import { useUpload, UploadProviderEnum } from '@/hooks/useUpload'
import { UploadSceneEnum } from '@/enums'
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
  const imageParams = ref({
    size: '1024x1024'
  })
  const imageSizeOptions = [
    { label: '1024x1024 (正方形)', value: '1024x1024' },
    { label: '1024x1792 (竖屏)', value: '1024x1792' },
    { label: '1792x1024 (横屏)', value: '1792x1024' }
  ]

  const videoParams = ref({
    size: '1280x720',
    duration: 5,
    image: null as string | null
  })
  const videoSizeOptions = [
    { label: '1280x720 (横屏)', value: '1280x720' },
    { label: '720x1280 (竖屏)', value: '720x1280' },
    { label: '960x960 (正方形)', value: '960x960' }
  ]
  const videoDurationOptions = [
    { label: '5秒', value: 5 },
    { label: '10秒', value: 10 }
  ]

  const audioParams = ref({
    voice: 'alloy',
    speed: 1.0
  })
  const audioVoiceOptions = ref([
    { label: 'Alloy (中性)', value: 'alloy' },
    { label: 'Echo (男性)', value: 'echo' },
    { label: 'Fable (男性)', value: 'fable' },
    { label: 'Onyx (男性)', value: 'onyx' },
    { label: 'Nova (女性)', value: 'nova' },
    { label: 'Shimmer (女性)', value: 'shimmer' }
  ])
  const audioSpeedOptions = [
    { label: '0.5x (慢速)', value: 0.5 },
    { label: '0.75x', value: 0.75 },
    { label: '1.0x (正常)', value: 1.0 },
    { label: '1.25x', value: 1.25 },
    { label: '1.5x (快速)', value: 1.5 },
    { label: '2.0x (极快)', value: 2.0 }
  ]

  const videoImageFileRef = ref<{ clear?: () => void } | null>(null)
  const videoImagePreview = ref<string | null>(null)
  const isUploadingVideoImage = ref(false)
  const { uploadFile: uploadReferenceImage, fileInfo } = useUpload()

  const loadAudioVoices = async (model: AIModel) => {
    try {
      if (!model || !model.model) return

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
      window.$message.error('只支持 JPG、PNG、WEBP 格式的图片')
      payload.onError()
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      window.$message.error('图片大小不能超过 10MB')
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
        throw new Error('未获取到图片URL')
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
