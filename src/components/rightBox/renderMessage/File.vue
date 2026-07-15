<template>
  <div
    class="file-container select-none"
    :class="{ downloading: isDownloading, uploading: isUploading }"
    @dblclick="handleFileClick">
    <!-- 文件信息 -->
    <div class="file-info select-none">
      <div class="file-name" :title="body?.fileName">
        <n-highlight
          v-if="props.searchKeyword"
          :text="truncateFileName(body?.fileName || fallbackFileName)"
          :patterns="[props.searchKeyword]"
          :highlight-style="{
            padding: '0 4px',
            borderRadius: '6px',
            color: 'var(--hula-text-inverse)',
            background: 'var(--hula-color-primary-500)'
          }" />
        <template v-else>
          {{ truncateFileName(body?.fileName || fallbackFileName) }}
        </template>
      </div>
      <div class="file-size">
        {{ formatBytes(body?.size != null && !isNaN(body.size) ? body.size : 0) }}
        <span class="download-status" :class="{ downloaded: fileStatus?.isDownloaded }">
          {{ fileStatus?.isDownloaded ? t('message.file.status.downloaded') : t('message.file.status.not_downloaded') }}
        </span>
      </div>
    </div>

    <!-- 文件图标区域 -->
    <div :title="body?.fileName" class="file-icon-wrapper select-none cursor-pointer" @click="handleIconClick">
      <!-- 文件图标 -->
      <img
        :src="`/file/${getFileSuffix(body?.fileName || '')}.svg`"
        :alt="getFileSuffix(body?.fileName || '')"
        @error="handleIconError"
        @load="handleIconLoad"
        class="file-icon-img" />

      <!-- 蒙层和操作图标 -->
      <div v-if="isUploading || isDownloading || needsDownload" class="file-overlay" :style="overlayStyle">
        <!-- 上传中显示进度 -->
        <div v-if="isUploading" class="upload-progress">
          <div class="progress-circle">
            <svg class="progress-ring" width="24" height="24">
              <circle
                class="progress-ring-circle"
                stroke="color-mix(in srgb, var(--hula-color-primary-500) 40%, transparent)"
                stroke-width="2"
                fill="transparent"
                r="10"
                cx="12"
                cy="12" />
              <circle
                class="progress-ring-circle progress-ring-fill"
                stroke="var(--hula-color-primary-500)"
                stroke-width="2"
                fill="transparent"
                r="10"
                cx="12"
                cy="12"
                :stroke-dasharray="`${2 * Math.PI * 10}`"
                :stroke-dashoffset="`${2 * Math.PI * 10 * (1 - (isUploading ? currentUploadProgress : downloadProgress) / 100)}`" />
            </svg>
          </div>
          <!-- 上传进度 -->
          <!-- <div class="progress-text">{{ isUploading ? uploadProgress : downloadProgress }}%</div> -->
        </div>
        <!-- 下载中显示进度 -->
        <div v-else-if="isDownloading" class="download-progress">
          <div class="progress-circle">
            <svg class="progress-ring" width="24" height="24">
              <circle
                class="progress-ring-circle"
                stroke="color-mix(in srgb, var(--hula-text-inverse) 30%, transparent)"
                stroke-width="2"
                fill="transparent"
                r="10"
                cx="12"
                cy="12" />
              <circle
                class="progress-ring-circle progress-ring-fill"
                stroke="var(--hula-text-inverse)"
                stroke-width="2"
                fill="transparent"
                r="10"
                cx="12"
                cy="12"
                :stroke-dasharray="`${2 * Math.PI * 10}`"
                :stroke-dashoffset="`${2 * Math.PI * 10 * (1 - downloadProgress / 100)}`" />
            </svg>
          </div>
          <!-- 下载进度 -->
          <!-- <div class="progress-text">{{ downloadProgress }}%</div> -->
        </div>
        <!-- 需要下载显示下载图标 -->
        <div v-else-if="needsDownload" class="download-icon">
          <div class="download-circle">
            <svg class="download-btn-icon">
              <use href="#arrow-down"></use>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { join } from '@tauri-apps/api/path'
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useDownload } from '@/composables/common/useDownload'
import { MessageStatusEnum, TauriCommand } from '@/enums'
import type { FileBody, FilesMeta, MsgType } from '@/services/types'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useUserStore } from '@/stores/domains/user/user'
import { useFileDownloadStore } from '@/stores/domains/widget/fileDownload'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { formatBytes, getFileSuffix } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'
import { getFilesMeta } from '@/utils/PathUtil'
import { invokeSilently } from '@/utils/TauriInvokeHandler'

const logger = createLogger('File')
const userStore = useUserStore()
const globalStore = useGlobalStore()
const chatStore = useChatStore()
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const { isDownloading: legacyIsDownloading } = useDownload()
const fileDownloadStore = useFileDownloadStore()
const fallbackFileName = computed(() => t('message.file.unknown_file'))

const props = defineProps<{
  body: FileBody
  messageStatus?: MessageStatusEnum
  uploadProgress?: number
  searchKeyword?: string
  message?: MsgType
}>()

// 图标尺寸状态
const iconDimensions = ref({ width: 40, height: 40 })

// 上传状态
const isUploading = computed(() => props.messageStatus === MessageStatusEnum.SENDING)
const currentUploadProgress = computed(() => props.uploadProgress || 0)
const hasEncryptedFile = computed(() => {
  const encryptedFile = props.body?.encryptedFile
  if (!encryptedFile || typeof encryptedFile !== 'object') {
    return false
  }

  return typeof encryptedFile.url === 'string' && typeof encryptedFile.v === 'string'
})

// 文件下载状态
const fileStatus = computed(() => {
  if (!props.body?.url) return null
  return fileDownloadStore.getFileStatus(props.body.url)
})

// 是否正在下载
const isDownloading = computed(() => {
  return fileStatus.value?.status === 'downloading' || legacyIsDownloading.value
})

// 下载进度
const downloadProgress = computed(() => {
  return fileStatus.value?.progress || 0
})

const persistFileLocalPath = async (absolutePath: string) => {
  if (!props.message?.id || !absolutePath) return
  const target = chatStore.getMessage(props.message.id)
  if (!target) return

  const body = target.message.body
  const currentBody = typeof body === 'object' && body !== null ? body : { content: String(body) }
  if (currentBody.localPath === absolutePath) return

  const nextBody = { ...currentBody, localPath: absolutePath }
  chatStore.updateMsg({
    msgId: target.message.id,
    status: target.message.status ?? MessageStatusEnum.SUCCESS,
    body: nextBody
  })
  const updated = { ...target, message: { ...target.message, body: nextBody } }
  await invokeSilently(TauriCommand.SAVE_MSG, { data: updated })
}

const revealInDirSafely = async (targetPath?: string | null) => {
  if (!targetPath) {
    showFeedback(t('message.file.toast.missing_local'), 'error')
    return
  }
  try {
    await revealItemInDir(targetPath)
  } catch (error) {
    logger.error('在文件夹中显示文件失败:', error)
    showFeedback(t('message.file.toast.reveal_fail'), 'error')
  }
}

// 是否需要下载（文件未下载到本地且不是上传/下载状态）
const needsDownload = computed(() => {
  if (isUploading.value || isDownloading.value) return false
  if (!props.body?.url) return false
  if (props.body.localPath) return false

  // 如果是本地文件路径，不需要下载
  if (props.body.url.startsWith('file://') || props.body.url.startsWith('/')) return false

  // 检查文件是否已下载
  const status = fileStatus.value
  return !status?.isDownloaded
})

// 计算overlay样式
const overlayStyle = computed(() => {
  const { width, height } = iconDimensions.value
  const overlayWidth = Math.max(width - 4, 38)
  const overlayHeight = Math.max(height, 42)
  return {
    width: `${overlayWidth}px`,
    height: `${overlayHeight}px`,
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    position: 'absolute' as const
  }
})

// 监听 props 变化，重新检查文件状态
watch(
  () => [props.body?.url, props.body?.fileName],
  async ([newUrl, newFileName]) => {
    if (newUrl && newFileName) {
      try {
        await fileDownloadStore.checkFileExists(newUrl, newFileName)
      } catch (error) {
        logger.error('检查文件状态失败:', error)
      }
    }
  },
  { immediate: false }
)

watch(
  fileStatus,
  (status) => {
    if (status?.isDownloaded && status.absolutePath) {
      void persistFileLocalPath(status.absolutePath)
    }
  },
  { immediate: true }
)

// 截断文件名，保留后缀
const truncateFileName = (fileName?: string): string => {
  if (!fileName) return fallbackFileName.value

  const maxWidth = 160 // 最大宽度像素
  const averageCharWidth = 9 // 平均字符宽度（基于14px Arial字体）
  const maxChars = Math.floor(maxWidth / averageCharWidth)

  if (fileName.length <= maxChars) {
    return fileName
  }

  // 获取文件扩展名
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex === -1) {
    // 没有扩展名，直接截断
    return fileName.substring(0, maxChars - 3) + '...'
  }

  const name = fileName.substring(0, lastDotIndex)
  const extension = fileName.substring(lastDotIndex)

  // 计算可用于文件名的字符数（保留扩展名和省略号的空间）
  const availableChars = maxChars - extension.length - 3 // 3 是省略号的长度

  if (availableChars <= 0) {
    // 如果扩展名太长，只显示扩展名
    return '...' + extension
  }

  return name.substring(0, availableChars) + '...' + extension
}

// 处理图标加载
const handleIconLoad = (event: Event) => {
  const target = event.target as HTMLImageElement
  // 获取图标的实际显示尺寸
  const rect = target.getBoundingClientRect()
  iconDimensions.value = {
    width: rect.width,
    height: rect.height
  }
}

// 处理图标加载错误
const handleIconError = (event: Event) => {
  const target = event.target as HTMLImageElement
  target.src = '/file/other.svg'
}

// 处理文件点击
const handleFileClick = async () => {
  if (!props.body?.url || !props.body?.fileName || isUploading.value) return

  try {
    // 检查文件是否已下载
    const status = fileStatus.value

    if (status?.isDownloaded && status.absolutePath) {
      // 文件已下载，尝试打开本地文件
      try {
        await openPath(status.absolutePath)
      } catch (openError) {
        await revealInDirSafely(status.absolutePath)
      }
    } else if (needsDownload.value) {
      // 需要下载文件
      await downloadAndOpenFile()
    } else {
      // 本地文件路径，尝试打开
      try {
        await openPath(props.body.url)
      } catch (openError) {
        logger.warn('无法直接打开文件，尝试在文件管理器中显示:', openError)
        await revealInDirSafely(props.body.url)
      }
    }
  } catch (error) {
    logger.error('打开文件失败:', error)
    const errorMessage = error instanceof Error ? error.message : t('message.file.unknown_error')
    if (errorMessage.includes('Not allowed to open path') || errorMessage.includes('revealItemInDir')) {
      logger.error('无法打开或显示文件。请手动在文件管理器中找到并打开文件。')
    } else {
      logger.error(`打开文件失败: ${errorMessage}`)
    }
  } finally {
    const currentChatRoomId = globalStore.currentSessionRoomId // 这个id可能为群id可能为用户uid，所以不能只用用户uid
    const currentUserUid = userStore.userInfo?.uid ?? ''

    const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
    const absolutePath = await join(resourceDirPath, props.body.fileName)

    const [fileMeta] = await getFilesMeta<FilesMeta>([absolutePath || props.body.url])

    await fileDownloadStore.refreshFileDownloadStatus({
      fileUrl: props.body.url,
      roomId: currentChatRoomId,
      userId: currentUserUid,
      fileName: props.body.fileName,
      exists: fileMeta.exists
    })
  }
}

const downloadCurrentFile = async (fileName: string) => {
  if (!props.body?.url) return null

  if (hasEncryptedFile.value) {
    if (!props.body.encryptedFile) return null
    return fileDownloadStore.downloadEncryptedFile(props.body.url, fileName, props.body.encryptedFile)
  }

  return fileDownloadStore.downloadFile(props.body.url, fileName)
}

// 下载并打开文件
const downloadAndOpenFile = async () => {
  if (!props.body?.url || !props.body?.fileName) return

  try {
    const fileName = props.body.fileName
    const absolutePath = await downloadCurrentFile(fileName)

    if (absolutePath) {
      void persistFileLocalPath(absolutePath)
      // 下载成功后尝试打开文件
      try {
        await openPath(absolutePath)
      } catch (openError) {
        logger.warn('无法直接打开文件，尝试在文件管理器中显示:', openError)
        await revealInDirSafely(absolutePath)
      }
    }
  } catch (error) {
    logger.error('下载文件失败:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    if (errorMessage.includes('Not allowed to open path') || errorMessage.includes('revealItemInDir')) {
      showFeedback(t('message.file.toast.download_open_fail'), 'error')
    } else {
      showFeedback(t('message.file.toast.download_failed', { reason: errorMessage }), 'error')
    }
  }
}

// 下载文件但不打开
const downloadFileOnly = async () => {
  if (!props.body?.url || !props.body?.fileName) return

  try {
    const fileName = props.body.fileName
    const absolutePath = await downloadCurrentFile(fileName)
    if (absolutePath) {
      void persistFileLocalPath(absolutePath)
    }
  } catch (error) {
    logger.error('下载文件失败:', error)
  } finally {
    // 刷新文件状态
    const currentChatRoomId = globalStore.currentSessionRoomId
    const currentUserUid = userStore.userInfo?.uid ?? ''

    const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
    const absolutePath = await join(resourceDirPath, props.body.fileName)

    const [fileMeta] = await getFilesMeta<FilesMeta>([absolutePath || props.body.url])

    await fileDownloadStore.refreshFileDownloadStatus({
      fileUrl: props.body.url,
      roomId: currentChatRoomId,
      userId: currentUserUid,
      fileName: props.body.fileName,
      exists: fileMeta.exists
    })
  }
}

// 处理图标单击（下载文件）
const handleIconClick = async (event: Event) => {
  event.stopPropagation() // 阻止事件冒泡，防止触发双击事件

  if (!props.body?.url || !props.body?.fileName || isUploading.value || isDownloading.value) return

  const status = fileStatus.value

  // 如果文件已下载，显示提示
  if (status?.isDownloaded) {
    return
  }

  // 如果需要下载，执行下载
  if (needsDownload.value) {
    await downloadFileOnly()
  }
}

// 组件挂载时检查文件状态
onMounted(async () => {
  if (props.body?.url && props.body?.fileName) {
    try {
      // 检查文件是否已存在于本地
      await fileDownloadStore.checkFileExists(props.body.url, props.body.fileName)
    } catch (error) {
      logger.error('检查文件状态失败:', error)
    }
  }
})
</script>

<style scoped lang="scss">
.file-container {
  @apply relative custom-shadow bg-[--hula-surface-panel-muted] w-225px h-70px rounded-8px px-14px py-4px flex-y-center;
  cursor: default !important;
  user-select: none !important;
  transition: all 0.2s ease;

  &.downloading {
    opacity: 0.7;
  }

  &.uploading {
    opacity: 0.8;
  }
}

.file-info {
  flex: 1;
  min-width: 0;
  margin-right: 10px;
}

.file-name {
  font-size: 14px;
  color: var(--hula-text-primary);
  line-height: 1.2;
  margin-bottom: 8px;
  white-space: nowrap;
  padding: 2px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 170px;
}

.file-size {
  font-size: 12px;
  color: var(--hula-text-tertiary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.download-status {
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--hula-text-tertiary) 16%, transparent);
  color: var(--hula-text-tertiary);

  &.downloaded {
    background: color-mix(in srgb, var(--hula-color-primary-500) 30%, transparent);
    color: var(--hula-color-primary-500);
  }
}

.file-icon-wrapper {
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  width: 39px;
  height: 41px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-icon-img {
  width: 42px;
  height: 42px;
  object-fit: contain;
}

.file-overlay {
  background: var(--hula-overlay-inverse-strong);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.upload-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.download-progress,
.download-icon {
  @apply flex-center;
}

.download-circle {
  width: 22px;
  height: 22px;
  background: var(--hula-overlay-inverse-strong);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--hula-border-inverse-muted);
}

.download-circle .download-btn-icon {
  width: 14px;
  height: 14px;
  color: color-mix(in srgb, var(--hula-text-inverse) 80%, transparent);
}

.progress-circle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-ring {
  transform: rotate(-90deg);
}

.progress-ring-circle {
  transition: stroke-dashoffset 0.3s ease;
}

.progress-text {
  font-size: 8px;
  color: var(--hula-text-inverse);
  text-align: center;
  font-weight: 500;
  text-shadow: 0 1px 2px color-mix(in srgb, var(--hula-surface-media-preview) 50%, transparent);
}

.loading-icon {
  width: 20px;
  height: 20px;
  color: var(--hula-text-inverse);
  animation: spin 1s linear infinite;
}

.download-btn-icon {
  width: 16px;
  height: 16px;
  color: var(--hula-text-inverse);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
