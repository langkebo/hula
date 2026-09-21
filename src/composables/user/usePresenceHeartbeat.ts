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
 * 「允许其他用户看到您的在线状态」关闭时心跳不上报 online, 而是下发一次 offline
 * 降级 (见 pushOfflineDowngrade), 让对端在一个心跳周期内同步为离线。
 *
 * 由 SessionBootstrapService 在登录成功后调用 startPresenceHeartbeat(),
 * 登出或 onUnmounted 调用 stopPresenceHeartbeat().
 */

import { OnlineEnum } from '@/enums'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('usePresenceHeartbeat')

/** 固定心跳间隔：45 秒（Matrix 规范建议的 presence 心跳周期） */
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 45 * 1000

let heartbeatTimer: ReturnType<typeof setInterval> | null = null

/**
 * 本会话是否已下发过「开关关闭 → offline」的降级。
 * online 心跳必须每 45s 重复（对抗服务端 idle 降级），但降级只需要一次；
 * 失败时不置位，下一个心跳周期自动重试。登出时由 stopPresenceHeartbeat 复位。
 */
let offlineDowngradeSent = false

async function pushOfflineDowngrade(): Promise<void> {
  if (offlineDowngradeSent) return

  // client 未初始化时静默跳过，避免登录时序竞态产生噪音日志
  if (!matrixClientService.getClient()) return
  try {
    await matrixPresenceService.setPresence('offline')
    offlineDowngradeSent = true
    const userStore = useUserStore()
    if (userStore.userInfo) {
      userStore.userInfo.activeStatus = OnlineEnum.OFFLINE
      userStore.userInfo.lastOptTime = Date.now()
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.warn(`[PresenceHeartbeat] setPresence(offline) 降级失败: ${errMsg}`)
  }
}

async function pushOnline(): Promise<void> {
  // 关闭「显示在线状态」后不再心跳上报 online；同时主动降级为 offline，
  // 让对端在一个心跳周期内停止看到在线，而不是等 service 侧 presence 超时。
  if (!useSettingStore().showOnlineStatusEnabled) {
    await pushOfflineDowngrade()
    return
  }

  // 开关重新打开后，下一次关闭需要重新降级
  offlineDowngradeSent = false

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

/**
 * 仅供测试：绕过 45 秒定时器直接触发一次心跳（开关开启时上报 online，
 * 关闭时执行 offline 降级）。生产路径只经由 startPresenceHeartbeat 的定时器调用 pushOnline。
 */
export async function pushOnlineForTest(): Promise<void> {
  await pushOnline()
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
  // 登出（或重新登录）后若开关仍关闭，需要重新下发一次 offline 降级
  offlineDowngradeSent = false
}
