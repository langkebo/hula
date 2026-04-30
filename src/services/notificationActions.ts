import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onAction, onNotificationReceived } from '@tauri-apps/plugin-notification'
import router from '@/router'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('NotificationActions')

async function focusHomeWindow(): Promise<void> {
  const home = await WebviewWindow.getByLabel('home')
  if (!home) return
  try {
    await home.show()
    await home.unminimize()
    await home.setFocus()
  } catch (err) {
    logger.warn('focus home window failed', err)
  }
}

function navigateToRoom(roomId: string): void {
  const globalStore = useGlobalStore()
  globalStore.updateCurrentSessionRoomId(roomId)
  void router.push({ name: 'message' }).catch(() => {})
}

export async function installNotificationActionListener(): Promise<void> {
  if (!hasTauriRuntime()) return

  try {
    await onAction((notification) => {
      void focusHomeWindow()
      const roomId = (notification.extra as { roomId?: string } | undefined)?.roomId
      if (typeof roomId === 'string' && roomId.length > 0) {
        navigateToRoom(roomId)
      }
    })

    await onNotificationReceived(() => {
      // Reserved for future analytics; intentionally a no-op.
    })
  } catch (err) {
    logger.warn('注册通知动作监听失败', err)
  }
}
