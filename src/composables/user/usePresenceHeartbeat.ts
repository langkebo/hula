/**
 * Presence 心跳
 *
 * synapse-rust 默认 5 分钟未收到 presence 上报就会把用户降级为 `unavailable`,
 * 前端挂机不动时在自己和好友侧都会显示成灰色 (见 useOnlineStatus / buildPresenceStorePatch).
 *
 * 本 hook 提供固定间隔的 presence 心跳：每 45 秒刷新一次 (远小于 server idle 阈值),
 * 保证在线状态稳定。初始 online 由登录引导流程 (SessionBootstrapService) 负责,
 * 登出时由 SessionLogoutService 负责 stop 并设置 unavailable, 这里不做任何
 * 事件触发的额外上报, 避免在房间切换/用户交互/sync 时重复发送产生噪音日志。
 *
 * 由 SessionBootstrapService 在登录成功后调用 startPresenceHeartbeat(),
 * 登出或 onUnmounted 调用 stopPresenceHeartbeat().
 */

import { OnlineEnum } from '@/enums'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('usePresenceHeartbeat')

/** 固定心跳间隔：45 秒（Matrix 规范建议的 presence 心跳周期） */
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 45 * 1000

let heartbeatTimer: ReturnType<typeof setInterval> | null = null

async function pushOnline(): Promise<void> {
  // client 未初始化时静默跳过，避免登录时序竞态产生噪音日志
  if (!matrixClientService.getClient()) return
  try {
    await matrixPresenceService.setPresence('online')
    const userStore = useUserStore()
    if (userStore.userInfo) {
      userStore.userInfo.activeStatus = OnlineEnum.ONLINE
      userStore.userInfo.lastOptTime = Date.now()
    }
  } catch (err) {
    // 请求被中止（页面关闭/导航）或 client 未就绪，降级为 warn 避免噪音
    const errMsg = err instanceof Error ? err.message : String(err)
    const isAbort = errMsg.includes('Failed to fetch') || errMsg.includes('Abort')
    if (isAbort) {
      logger.warn(`[PresenceHeartbeat] setPresence(online) 中止: ${errMsg}`)
    } else {
      logger.error(`[PresenceHeartbeat] setPresence(online) 失败: ${err}`)
    }
  }
}

export function startPresenceHeartbeat(): void {
  stopPresenceHeartbeat()

  heartbeatTimer = setInterval(() => {
    void pushOnline()
  }, PRESENCE_HEARTBEAT_INTERVAL_MS)
}

export function stopPresenceHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}
