import { listen } from '@tauri-apps/api/event'
import { ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import matrixMessageService from '@/services/matrix/messaging/MatrixMessageService'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useScreenshotDetection')

export interface ScreenshotDetectedPayload {
  roomId: string
  timestamp: number
  platform: 'macos' | 'windows' | 'linux'
}

export function useScreenshotDetection() {
  const isWatching = ref(false)
  let unlistenFn: (() => void) | null = null

  async function startWatch(roomId: string) {
    if (isWatching.value) return
    if (!hasTauriRuntime()) {
      logger.info('非 Tauri 环境，跳过截屏检测启动')
      return
    }
    isWatching.value = true

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('start_screenshot_watch', { roomId })

      unlistenFn = await listen<ScreenshotDetectedPayload>('screenshot-detected', async (event) => {
        await handleScreenshotDetected(event.payload)
      })
    } catch (e) {
      logger.error('启动截屏监听失败:', e)
      isWatching.value = false
    }
  }

  async function stopWatch() {
    if (!isWatching.value) return
    isWatching.value = false

    if (unlistenFn) {
      unlistenFn()
      unlistenFn = null
    }

    try {
      if (hasTauriRuntime()) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('stop_screenshot_watch')
      }
    } catch (e) {
      logger.error('停止截屏监听失败:', e)
    }
  }

  async function handleScreenshotDetected(payload: ScreenshotDetectedPayload) {
    // 1. 发送系统消息到房间
    try {
      await matrixMessageService.sendTextMessage(payload.roomId, '截屏行为已被记录')
    } catch (e) {
      logger.error('发送截屏系统消息失败:', e)
    }

    // 2. 显示本地 Toast
    const { showFeedback } = useActionFeedback()
    showFeedback('截屏行为已被记录', 'warning')
  }

  return {
    isWatching,
    startWatch,
    stopWatch
  }
}
