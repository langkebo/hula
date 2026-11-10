import {
  startSecretChatAutoLock,
  stopSecretChatAutoLock,
  touchSecretChatSession
} from '@/stores/domains/settings/secretChatSession'
import { useSettingStore } from '@/stores/domains/settings/setting'

/** 自动锁关闭时注入的极大超时（分钟）：巡检照常运行，但永不命中。 */
const NEVER_TIMEOUT_MINUTES = Number.MAX_SAFE_INTEGER

/**
 * 接通私密聊天的「离开自动锁定」。
 *
 * `secretChatSession` 已实现空闲巡检与活动刷新，但此前**生产代码从未调用 start/touch**，
 * 导致设置页的开关与超时选项完全空转。这里只做接线：超时读法接到 store，
 * 用户活动接到 `touchSecretChatSession`，不新造任何锁逻辑。
 *
 * 返回 `dispose()` 由调用方清理。刻意不用 `onUnmounted` 自动清理：
 * 调用点通常在 `onMounted` 内，此时 `onUnmounted` 已无法再注册。
 */
export function useSecretChatAutoLock(): { dispose: () => void } {
  const settingStore = useSettingStore()

  // 关闭开关时让巡检永不命中——不改 store 语义（关闭时超时会被复位为默认值）。
  startSecretChatAutoLock(() =>
    settingStore.secretChatAutoLock ? settingStore.secretChatLockTimeout : NEVER_TIMEOUT_MINUTES
  )

  // 非浏览器/WebView 环境没有 document：只保留定时器逻辑，跳过监听注册。
  const hasDocument = typeof document !== 'undefined'

  const handleActivity = () => {
    touchSecretChatSession()
  }
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      touchSecretChatSession()
    }
  }

  if (hasDocument) {
    document.addEventListener('pointerdown', handleActivity, { capture: true, passive: true })
    document.addEventListener('keydown', handleActivity, { capture: true, passive: true })
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  const dispose = () => {
    if (hasDocument) {
      document.removeEventListener('pointerdown', handleActivity, true)
      document.removeEventListener('keydown', handleActivity, true)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    stopSecretChatAutoLock()
  }

  return { dispose }
}
