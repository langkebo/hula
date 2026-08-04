import { listen } from '@tauri-apps/api/event'
import { ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { MsgEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
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
    const noticeText = useI18nGlobal().t('chat.privacy.screenshot_detected_notice')

    // 1. 以 m.notice 系统通知形式发送到房间，避免被误认为用户输入的 m.text
    try {
      await matrixMessageService.sendStructuredMessage({
        roomId: payload.roomId,
        msgType: MsgEnum.NOTICE,
        body: noticeText
      })
    } catch (e) {
      logger.error('发送截屏系统消息失败:', e)
    }

    // 2. 显示本地 Toast
    const { showFeedback } = useActionFeedback()
    showFeedback(noticeText, 'warning')
  }

  return {
    isWatching,
    startWatch,
    stopWatch
  }
}
