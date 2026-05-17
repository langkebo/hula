<template>
  <div ref="videoContainerRef" :style="containerStyle" @dblclick="handleOpenVideoViewer">
    <n-image
      v-if="body?.thumbUrl"
      class="video-thumbnail"
      object-fit="cover"
      show-toolbar-tooltip
      preview-disabled
      :img-props="{
        style: {
          ...imageStyle
        }
      }"
      :src="displayThumbSrc"
      @load="handleImageLoad"
      @error="handleImageError">
      <template #placeholder>
        <n-flex
          v-if="!isError"
          align="center"
          justify="center"
          :style="{
            width: `${imageStyle.width}`,
            height: `${imageStyle.height}`,
            backgroundColor: 'var(--hula-surface-sidebar-selected)'
          }"
          class="rounded-10px">
          <img class="size-24px select-none" src="@/assets/img/loading.svg" alt="loading" />
        </n-flex>
      </template>
      <template #error>
        <n-flex
          v-if="isError"
          align="center"
          justify="center"
          class="w-200px h-150px rounded-10px bg-[--hula-surface-sidebar-selected]">
          <svg class="size-34px color-[--hula-text-tertiary]"><use href="#error-picture"></use></svg>
        </n-flex>
      </template>
    </n-image>

    <!-- 视频蒙层 -->
    <div class="video-overlay">
      <!-- 播放/下载按钮 -->
      <div
        class="play-button"
        @click="handlePlayButtonClick"
        :class="{ loading: isOpening || isDownloading || isUploading }">
        <!-- 上传中显示进度 -->
        <div v-if="isUploading" class="upload-progress">
          <div class="progress-circle">
            <svg class="progress-ring" width="44" height="44">
              <circle
                class="progress-ring-circle"
                stroke="color-mix(in srgb, var(--hula-text-inverse) 30%, transparent)"
                stroke-width="3"
                fill="transparent"
                r="18"
                cx="22"
                cy="22" />
              <circle
                class="progress-ring-circle progress-ring-fill"
                stroke="var(--hula-color-primary-500)"
                stroke-width="3"
                fill="transparent"
                r="18"
                cx="22"
                cy="22"
                :stroke-dasharray="`${2 * Math.PI * 18}`"
                :stroke-dashoffset="`${2 * Math.PI * 18 * (1 - currentUploadProgress / 100)}`" />
            </svg>
            <svg class="upload-icon"><use href="#Importing"></use></svg>
          </div>
        </div>
        <!-- 下载中显示进度 -->
        <div v-else-if="isDownloading" class="download-progress">
          <div class="progress-circle">
            <svg class="progress-ring" width="44" height="44">
              <circle
                class="progress-ring-circle"
                stroke="color-mix(in srgb, var(--hula-text-inverse) 30%, transparent)"
                stroke-width="3"
                fill="transparent"
                r="18"
                cx="22"
                cy="22" />
              <circle
                class="progress-ring-circle progress-ring-fill"
                stroke="var(--hula-text-inverse)"
                stroke-width="3"
                fill="transparent"
                r="18"
                cx="22"
                cy="22"
                :stroke-dasharray="`${2 * Math.PI * 18}`"
                :stroke-dashoffset="`${2 * Math.PI * 18 * (1 - process / 100)}`" />
            </svg>
            <svg class="download-icon"><use href="#arrow-down"></use></svg>
          </div>
        </div>
        <!-- 打开中显示加载动画 -->
        <div v-else-if="isOpening" class="loading-spinner"></div>
        <!-- 未检查状态或未下载显示下载图标 -->
        <svg v-else-if="isVideoDownloaded === null || !isVideoDownloaded" class="size-32px color-white">
          <use href="#Importing"></use>
        </svg>
        <!-- 已下载显示播放图标 -->
        <svg v-else class="size-full color-white"><use href="#play"></use></svg>
      </div>

      <!-- 视频信息 -->
      <div class="video-info">
        <div class="video-filename">{{ body?.filename || fallbackVideoName }}</div>
        <div class="video-filesize">{{ formatBytes(body?.size) }}</div>
      </div>

      <!-- 加载提示 -->
      <transition name="fade">
        <div v-if="isUploading" class="loading-tip upload-tip">
          <div class="loading-text">{{ uploadingTip }}</div>
        </div>
        <div v-else-if="isOpening" class="loading-tip">
          <div class="loading-text">{{ openingTip }}</div>
        </div>
      </transition>
    </div>

    <!-- 移动端视频预览 -->
    <component
      :is="VideoPreview"
      v-if="VideoPreview"
      v-model:visible="showVideoPreviewRef"
      :video-url="mobileVideoUrl"
      :message="message" />
  </div>
</template>

<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'
import { appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { BaseDirectory, exists } from '@tauri-apps/plugin-fs'
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessageStatusEnum, TauriCommand } from '@/enums'
import { MittEnum, MsgEnum } from '@/enums/index'
import { useDownload } from '@/hooks/useDownload'
import { useIntersectionTaskQueue } from '@/hooks/useIntersectionTaskQueue'
import { useMitt } from '@/hooks/useMitt'
import { useVideoViewer } from '@/hooks/useVideoViewer'
import type { MsgType, VideoBody } from '@/services/types'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useFileDownloadStore } from '@/stores/domains/widget/fileDownload'
import { useThumbnailCacheStore } from '@/stores/domains/widget/thumbnailCache'
import { useVideoViewer as useVideoViewerStore } from '@/stores/domains/widget/videoViewer'
import type { MatrixEncryptedAttachmentLike } from '@/types/matrix-services'
import { extractFileName, formatBytes } from '@/utils/Formatting.ts'
import { createLogger } from '@/utils/Logger'
import { safeExistsPath } from '@/utils/PathUtil'
import { isMobile } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'

const logger = createLogger('Video')
const { openVideoViewer, getLocalVideoPath, checkVideoDownloaded } = useVideoViewer()
const VideoPreview = isMobile() ? defineAsyncComponent(() => import('@/mobile/components/VideoPreview.vue')) : void 0
const videoViewerStore = useVideoViewerStore()
const chatStore = useChatStore()
const fileDownloadStore = useFileDownloadStore()
const { downloadFile, isDownloading, process } = useDownload()
const { t } = useI18n()
const props = defineProps<{
  body: VideoBody
  messageStatus?: MessageStatusEnum
  uploadProgress?: number
  onVideoClick?: (url: string) => void
  message?: MsgType
}>()

// 视频容器引用
const videoContainerRef = ref<HTMLElement | null>(null)
const MOBILE_MAX_WIDTH_RATIO = 0.7
const MAX_WIDTH = isMobile()
  ? Math.round((typeof window !== 'undefined' ? window.innerWidth : 0) * MOBILE_MAX_WIDTH_RATIO) || 320
  : 400
// 错误状态控制
const isError = ref(false)
// 视频打开状态
const isOpening = ref(false)
// 视频下载状态（延迟加载，只在需要时检查）
const isVideoDownloaded = ref<boolean | null>(null)
// 是否已检查过下载状态
const hasCheckedDownloadStatus = ref(false)
// 视频上传状态
const isUploading = computed(() => props.messageStatus === MessageStatusEnum.SENDING)
const currentUploadProgress = computed(() => {
  return props.uploadProgress || 0
})
const fallbackVideoName = computed(() => t('message.video.unknown_video'))
const resolvedVideoFileName = computed(() => {
  const explicitName = props.body?.filename || (props.body as Record<string, unknown>)?.fileName
  if (typeof explicitName === 'string' && explicitName) {
    return explicitName
  }

  const extracted = extractFileName(props.body?.url || '')
  return extracted || 'video.mp4'
})
const resolvedThumbnailFileName = computed(() => {
  const extracted = extractFileName(props.body?.thumbUrl || '')
  if (extracted?.includes('.')) {
    return extracted
  }

  return `${props.message?.id || 'video'}-thumb.jpg`
})
const uploadingTip = computed(() => t('message.video.uploading', { progress: currentUploadProgress.value }))
const openingTip = computed(() => t('message.video.opening'))
const thumbnailStore = useThumbnailCacheStore()
const { observe: observeVideoVisibility, disconnect: disconnectVideoVisibility } = useIntersectionTaskQueue({
  threshold: 0.5
})
const showVideoPreviewRef = ref(false)
const mobileVideoUrl = ref('')

const hasEncryptedFile = computed(() => {
  const encryptedFile = props.body?.encryptedFile
  if (!encryptedFile || typeof encryptedFile !== 'object') {
    return false
  }

  return typeof encryptedFile.url === 'string' && typeof encryptedFile.v === 'string'
})

const hasEncryptedThumbnailFile = computed(() => {
  const encryptedFile = props.body?.thumbnailEncryptedFile
  if (!encryptedFile || typeof encryptedFile !== 'object') {
    return false
  }

  return typeof encryptedFile.url === 'string' && typeof encryptedFile.v === 'string'
})

const persistVideoBodyPatch = async (patch: Partial<VideoBody>) => {
  if (!props.message?.id) return
  const target = chatStore.getMessage(props.message.id)
  if (!target) return

  const currentBody = (target.message.body || {}) as Record<string, unknown>
  const hasChanges = Object.entries(patch).some(([key, value]) => currentBody[key] !== value)
  if (!hasChanges) return

  const nextBody = { ...currentBody, ...patch }

  chatStore.updateMsg({
    msgId: target.message.id,
    status: target.message.status ?? MessageStatusEnum.SUCCESS,
    body: nextBody
  })
  const updated = { ...target, message: { ...target.message, body: nextBody } }
  await invokeSilently(TauriCommand.SAVE_MSG, { data: updated })
}

const persistVideoLocalPath = async (absolutePath: string) => {
  if (!absolutePath) return
  await persistVideoBodyPatch({ localPath: absolutePath })
}

const persistVideoThumbnailPath = async (absolutePath: string) => {
  if (!absolutePath) return
  await persistVideoBodyPatch({ thumbnailPath: absolutePath })
}
const localVideoThumbSrc = ref<string | null>(null)

// 视频缩略图实际加载的尺寸（用于 props 中没有宽高的情况）
const loadedThumbWidth = ref(0)
const loadedThumbHeight = ref(0)

const imageStyle = computed(() => {
  // 优先使用加载后的图片尺寸（更准确），如果没有则使用 props 中的原始尺寸
  let width = loadedThumbWidth.value || props.body?.thumbWidth
  let height = loadedThumbHeight.value || props.body?.thumbHeight

  // 基础最大尺寸配置
  const BASE_MAX_WIDTH = MAX_WIDTH
  // 纵向视频固定尺寸（PC 高度再减 30px）
  const VERTICAL_MAX_WIDTH = isMobile() ? 170 : 150
  const VERTICAL_MAX_HEIGHT = isMobile() ? 300 : 290
  // 横向视频固定尺寸（保持横向，不变成正方形或纵向）
  const HORIZONTAL_FIXED_WIDTH = isMobile() ? 350 : 320
  const HORIZONTAL_FIXED_HEIGHT = isMobile() ? 160 : 170

  // 如果没有原始尺寸，使用默认尺寸
  if (!width || !height) {
    width = HORIZONTAL_FIXED_WIDTH
    height = HORIZONTAL_FIXED_HEIGHT
  }

  const isVertical = height > width

  // 固定尺寸：纵向与横向分别锁定宽高，避免横向变成正方形或纵向
  const limitedHorizontalWidth = Math.min(HORIZONTAL_FIXED_WIDTH, BASE_MAX_WIDTH)
  const limitedVerticalWidth = Math.min(VERTICAL_MAX_WIDTH, BASE_MAX_WIDTH)
  const finalWidth = isVertical ? limitedVerticalWidth : limitedHorizontalWidth
  const finalHeight = isVertical ? VERTICAL_MAX_HEIGHT : HORIZONTAL_FIXED_HEIGHT
  // 向上取整避免小数导致的抖动
  return {
    width: `${Math.ceil(finalWidth)}px`,
    height: `${Math.ceil(finalHeight)}px`
  }
})

// 处理图片加载完成，获取实际宽高
const handleImageLoad = (e: Event) => {
  const target = e.target as HTMLImageElement
  if (target) {
    loadedThumbWidth.value = target.naturalWidth
    loadedThumbHeight.value = target.naturalHeight
  }
}

const containerStyle = computed(() => {
  const style = imageStyle.value
  return `width: ${style.width}; height: ${style.height}; position: relative; border-radius: 8px; overflow: hidden; cursor: pointer;`
})

const remoteThumbSrc = computed(() => {
  if (hasEncryptedThumbnailFile.value) return ''
  return props.body?.thumbUrl || ''
})
const downloadKey = computed(() => remoteThumbSrc.value || '')
const displayThumbSrc = computed(() => localVideoThumbSrc.value || remoteThumbSrc.value || '')

const requestVideoThumbnailDownload = () => {
  if (!downloadKey.value || !props.message) return
  void thumbnailStore
    .enqueueThumbnail({ url: downloadKey.value, msgId: props.message.id, roomId: props.message.roomId, kind: 'video' })
    .then((path) => {
      if (!path) return
      localVideoThumbSrc.value = convertFileSrc(path)
    })
}

const ensureLocalVideoThumbnail = async () => {
  if (hasEncryptedThumbnailFile.value && props.body?.thumbUrl) {
    try {
      if (props.body.thumbnailPath) {
        const existsFlag = await safeExistsPath(props.body.thumbnailPath)
        if (existsFlag) {
          localVideoThumbSrc.value = convertFileSrc(props.body.thumbnailPath)
          return
        }
      }

      const absolutePath = await fileDownloadStore.downloadEncryptedFile(
        props.body.thumbUrl,
        resolvedThumbnailFileName.value,
        props.body.thumbnailEncryptedFile as MatrixEncryptedAttachmentLike
      )
      if (absolutePath) {
        localVideoThumbSrc.value = convertFileSrc(absolutePath)
        await persistVideoThumbnailPath(absolutePath)
      }
      return
    } catch (error) {
      logger.error('下载加密视频缩略图失败:', error)
      localVideoThumbSrc.value = null
      return
    }
  }

  const localPath = props.body?.thumbnailPath
  if (!localPath) {
    localVideoThumbSrc.value = null
    return
  }

  try {
    const existsFlag = await safeExistsPath(localPath)
    if (existsFlag) {
      localVideoThumbSrc.value = convertFileSrc(localPath)
      return
    }
  } catch (error) {
    logger.warn('检查缩略图文件失败:', error)
  }

  localVideoThumbSrc.value = null
  thumbnailStore.invalidate(downloadKey.value)
  requestVideoThumbnailDownload()
}

watch(
  () => props.body?.thumbnailPath,
  () => {
    void ensureLocalVideoThumbnail()
  },
  { immediate: true }
)

watch(
  () => props.body?.localPath,
  async (path) => {
    if (!path) return
    try {
      const existsFlag = await safeExistsPath(path)
      if (existsFlag) {
        isVideoDownloaded.value = true
        if (isMobile()) {
          mobileVideoUrl.value = convertFileSrc(path)
        }
      }
    } catch (error) {
      logger.warn('本地视频校验失败:', error)
    }
  },
  { immediate: true }
)

watch(
  () => downloadKey.value,
  () => {
    if (!props.body?.thumbnailPath) {
      requestVideoThumbnailDownload()
    }
  }
)

// 检查视频下载状态（延迟加载）
const checkDownloadStatusLazy = async () => {
  if (!props.body?.url || hasCheckedDownloadStatus.value) return
  hasCheckedDownloadStatus.value = true
  if (hasEncryptedFile.value) {
    if (props.body.localPath) {
      try {
        const existsFlag = await safeExistsPath(props.body.localPath)
        isVideoDownloaded.value = existsFlag
        return
      } catch (error) {
        logger.warn('检查加密视频本地文件失败:', error)
      }
    }

    const status = fileDownloadStore.getFileStatus(props.body.url)
    isVideoDownloaded.value = !!status.isDownloaded
    return
  }

  isVideoDownloaded.value = await checkVideoDownloaded(props.body.url)
}

// 使用 IntersectionObserver 在视频进入视口时检查下载状态
const setupIntersectionObserver = () => {
  if (!videoContainerRef.value || hasCheckedDownloadStatus.value) return

  observeVideoVisibility(videoContainerRef.value, () => {
    void checkDownloadStatusLazy()
  })
}

// 处理图片加载错误
const handleImageError = () => {
  isError.value = true
}

// 下载视频
const downloadVideo = async () => {
  if (!props.body?.url || isDownloading.value) return

  try {
    if (hasEncryptedFile.value) {
      const absolutePath = await fileDownloadStore.downloadEncryptedFile(
        props.body.url,
        resolvedVideoFileName.value,
        props.body.encryptedFile as MatrixEncryptedAttachmentLike
      )
      isVideoDownloaded.value = !!absolutePath

      if (absolutePath) {
        videoViewerStore.updateVideoPath(props.body.url, absolutePath)
        await persistVideoLocalPath(absolutePath)
        if (isMobile()) {
          mobileVideoUrl.value = convertFileSrc(absolutePath)
        }
      }
      return
    }

    const localPath = await getLocalVideoPath(props.body?.url)
    if (localPath) {
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
      await downloadFile(props.body.url, localPath, baseDir)
      isVideoDownloaded.value = await checkVideoDownloaded(props.body.url)

      // 下载完成后，更新videoViewer store中的视频路径
      if (isVideoDownloaded.value) {
        const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
        const path = await join(baseDirPath, localPath)
        videoViewerStore.updateVideoPath(props.body.url, path)
        void persistVideoLocalPath(path)
      }
    }
  } catch (error) {
    logger.error('下载视频失败:', error)
  }
}

const resolveMobilePlayableUrl = async () => {
  if (!props.body?.url) return ''
  const url = props.body.localPath || ''
  if (url) {
    return convertFileSrc(url)
  }
  if (hasEncryptedFile.value) {
    await downloadVideo()
    return props.body.localPath ? convertFileSrc(props.body.localPath) : mobileVideoUrl.value
  }
  const downloaded = await checkVideoDownloaded(props.body.url)
  if (!downloaded) return ''
  const relative = await getLocalVideoPath(props.body.url)
  const baseDirPath = await appDataDir()
  const absolute = await join(baseDirPath, relative)
  return convertFileSrc(absolute)
}

// 处理播放按钮点击
const handlePlayButtonClick = async () => {
  if (!props.body?.url) return

  // 如果正在上传，不允许点击
  if (isUploading.value) return

  // 首次点击时检查下载状态
  if (!hasCheckedDownloadStatus.value) {
    await checkDownloadStatusLazy()
  }

  // 如果视频未下载，先下载
  if (!isVideoDownloaded.value) {
    await downloadVideo()
    isVideoDownloaded.value = await checkVideoDownloaded(props.body.url)
    if (!isVideoDownloaded.value) return
  }

  // 如果已下载，直接播放
  await handleOpenVideoViewer()
}

// 处理打开视频查看器
const handleOpenVideoViewer = async () => {
  if (props.body?.url && !isOpening.value) {
    // 如果有自定义视频点击处理函数，使用它
    if (props.onVideoClick) {
      props.onVideoClick(props.body.url)
      return
    }

    try {
      isOpening.value = true

      if (hasEncryptedFile.value) {
        if (!props.body.localPath) {
          await downloadVideo()
        }

        const localExists = props.body.localPath ? await safeExistsPath(props.body.localPath) : false
        isVideoDownloaded.value = localExists
        if (!localExists) {
          logger.error('加密视频下载失败，无法打开')
          return
        }
      }

      // 检查视频是否已下载
      const isDownloaded = hasEncryptedFile.value ? true : await checkVideoDownloaded(props.body.url)
      isVideoDownloaded.value = isDownloaded

      // 如果视频未下载，先下载
      if (!isDownloaded) {
        await downloadVideo()
        // 下载完成后重新检查状态
        isVideoDownloaded.value = await checkVideoDownloaded(props.body.url)

        // 如果下载失败，不继续打开视频
        if (!isVideoDownloaded.value) {
          logger.error('视频下载失败，无法打开')
          return
        }
      }

      if (isMobile()) {
        const playableUrl = await resolveMobilePlayableUrl()
        if (!playableUrl) {
          logger.error('未找到可播放的视频地址')
          return
        }
        mobileVideoUrl.value = playableUrl
        showVideoPreviewRef.value = true
        return
      }

      await openVideoViewer(props.body.url, [MsgEnum.VIDEO])
    } catch (error) {
      logger.error('打开视频失败:', error)
    } finally {
      isOpening.value = false
    }
  }
}

// 监听视频下载状态更新事件
const handleVideoDownloadStatusUpdate = (data: { url: string; downloaded: boolean }) => {
  if (data.url === props.body?.url) {
    isVideoDownloaded.value = data.downloaded
  }
}

onMounted(() => {
  // 监听视频下载状态更新事件
  useMitt.on(MittEnum.VIDEO_DOWNLOAD_STATUS_UPDATED, handleVideoDownloadStatusUpdate)

  // 设置视口观察器
  nextTick(() => {
    setupIntersectionObserver()
  })

  if (!props.body?.thumbnailPath) {
    requestVideoThumbnailDownload()
  }
})

onUnmounted(() => {
  // 清理事件监听
  useMitt.off(MittEnum.VIDEO_DOWNLOAD_STATUS_UPDATED, handleVideoDownloadStatusUpdate)

  disconnectVideoVisibility()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/renderMessage/video.scss';
</style>
