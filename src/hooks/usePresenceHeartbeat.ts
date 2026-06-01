/**
 * Presence 心跳
 *
 * synapse-rust 默认 5 分钟未收到 presence 上报就会把用户降级为 `unavailable`,
 * 前端挂机不动时在自己和好友侧都会显示成灰色 (见 useOnlineStatus / buildPresenceStorePatch).
 *
 * 本 hook 提供:
 *   1. 固定 4 分钟一次的 presence 刷新 (< server idle 阈值);
 *   2. 用户有交互 (mouse/keyboard/touch) 时, 节流刷新一次, 保证活跃用户永远是 online;
 *   3. 页面 hidden 时暂停, 再 visible 时立即补一次;
 *   4. 失败时静默重试 (下次心跳到达会再试).
 *
 * 由 App.vue 在登录成功后调用 startPresenceHeartbeat(), 登出或 onUnmounted 调用 stopPresenceHeartbeat().
 */

import { OnlineEnum } from '@/enums'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('usePresenceHeartbeat')

const HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000
const ACTIVITY_THROTTLE_MS = 60 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'] as const

let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let lastActivityPush = 0
let activityListenerRegistered = false
let visibilityListenerRegistered = false

async function pushOnline(): Promise<void> {
  try {
    await matrixPresenceService.setPresence('online')
    const userStore = useUserStore()
    if (userStore.userInfo) {
      userStore.userInfo.activeStatus = OnlineEnum.ONLINE
      userStore.userInfo.lastOptTime = Date.now()
    }
  } catch (err) {
    logger.error(`[PresenceHeartbeat] setPresence(online) 失败: ${err}`)
  }
}

function handleActivity(): void {
  const now = Date.now()
  if (now - lastActivityPush < ACTIVITY_THROTTLE_MS) return
  lastActivityPush = now
  void pushOnline()
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    lastActivityPush = 0
    void pushOnline()
  }
}

export function startPresenceHeartbeat(): void {
  stopPresenceHeartbeat()

  heartbeatTimer = setInterval(() => {
    void pushOnline()
  }, HEARTBEAT_INTERVAL_MS)

  if (!activityListenerRegistered && typeof window !== 'undefined') {
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, handleActivity, { passive: true })
    }
    activityListenerRegistered = true
  }

  if (!visibilityListenerRegistered && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    visibilityListenerRegistered = true
  }
}

export function stopPresenceHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }

  if (activityListenerRegistered && typeof window !== 'undefined') {
    for (const evt of ACTIVITY_EVENTS) {
      window.removeEventListener(evt, handleActivity)
    }
    activityListenerRegistered = false
  }

  if (visibilityListenerRegistered && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    visibilityListenerRegistered = false
  }

  lastActivityPush = 0
}
