/**
 * §9.4.2 统一上传进度 composable
 *
 * 为图片/视频/语音/文档上传提供统一的进度状态管理：
 * - 进度百分比 (0-100)
 * - 上传速率 (bytes/s)
 * - 状态机 (pending → uploading → done/error/cancelled)
 * - 取消回调
 *
 * 供统一的上传进度组件消费，消除各上传场景进度反馈不一致问题。
 */
import { computed, ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useUploadProgress')

type UploadStatus = 'pending' | 'uploading' | 'done' | 'error' | 'cancelled'

interface UseUploadProgressOptions {
  fileId: string
  fileName: string
  /** 文件总字节数 */
  total: number
  /** 取消上传回调 */
  onCancel?: () => void
}

export function useUploadProgress(options: UseUploadProgressOptions) {
  const fileName = ref(options.fileName)
  const total = options.total
  const status = ref<UploadStatus>('pending')
  const loaded = ref(0)
  const speed = ref(0)

  let startTime = 0
  let lastLoaded = 0
  let lastTime = 0

  const progress = computed<number>(() => {
    if (total <= 0) return 0
    const pct = (loaded.value / total) * 100
    return Math.min(100, Math.max(0, pct))
  })

  const isTerminal = computed<boolean>(
    () => status.value === 'done' || status.value === 'error' || status.value === 'cancelled'
  )

  const start = (): void => {
    status.value = 'uploading'
    startTime = Date.now()
    lastTime = startTime
    lastLoaded = 0
    loaded.value = 0
    speed.value = 0
  }

  const updateProgress = (bytesLoaded: number): void => {
    if (status.value !== 'uploading') return
    loaded.value = bytesLoaded

    const now = Date.now()
    const elapsed = now - lastTime
    if (elapsed > 0) {
      const delta = bytesLoaded - lastLoaded
      speed.value = Math.max(0, Math.round((delta / elapsed) * 1000))
      lastTime = now
      lastLoaded = bytesLoaded
    }
  }

  const markDone = (): void => {
    status.value = 'done'
    loaded.value = total
    speed.value = 0
  }

  const markError = (): void => {
    status.value = 'error'
    speed.value = 0
    logger.warn(`上传失败: ${options.fileId}`)
  }

  const cancel = (): void => {
    if (isTerminal.value) return
    status.value = 'cancelled'
    speed.value = 0
    try {
      options.onCancel?.()
    } catch (err) {
      logger.error('取消回调异常', err)
    }
  }

  const reset = (): void => {
    status.value = 'pending'
    loaded.value = 0
    speed.value = 0
    startTime = 0
    lastTime = 0
    lastLoaded = 0
  }

  return {
    fileName,
    status,
    progress,
    speed,
    isTerminal,
    start,
    updateProgress,
    markDone,
    markError,
    cancel,
    reset
  }
}
