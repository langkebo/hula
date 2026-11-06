import type { RouteLocationNormalized } from 'vue-router'

/**
 * 私密聊天路由门禁（方案 P0-0-c）。
 *
 * 两个入口都必须挡：
 * 1. **私密会话列表页** `/secretChat`；
 * 2. **具体房间** `/message/:roomId`、`/window/chat/:roomId` —— 这是关键兜底。
 *    好友详情「发消息」、搜索结果、通知点击、独立窗口、手动输 URL 全都汇到这两条路由，
 *    只在列表页加守卫等于没加（任何直达链接都绕过）。
 *
 * 守卫不能阻塞等待用户输入，因此采用「记录意图 → 挡回 → 解锁后回跳」：
 * pendingPath 交给解锁对话框 consume，解锁成功后 `router.replace(pendingPath)`。
 */

interface SecretChatGuardLogger {
  warn(message: string): void
}

interface CreateSecretChatGuardOptions {
  logger: SecretChatGuardLogger
  /** 被挡回时去哪个路径（桌面 /message，移动端 /mobile/message）。 */
  fallbackPath: string
  isConfigured: () => Promise<boolean>
  isUnlocked: () => Promise<boolean>
  /** 该房间是否被标记为私密房（需先 await ensureRegistryReady）。 */
  isPrivateRoom: (roomId: string) => Promise<boolean>
  /** 确保登记表已按当前账号加载（冷启动时本地缓存可能还是空）。 */
  ensureRegistryReady: () => Promise<void>
  openUnlock: (pendingPath: string) => Promise<void>
  /** 未配置密码时的用户提示。 */
  warnNotConfigured: () => Promise<void>
}

/** 承载「具体房间」的路由名；`:roomId` 是它们的公共参数。 */
const ROOM_ROUTE_NAMES = new Set(['message', 'windowChat'])

/** 取路由上的房间 ID；非房间路由返回 null。 */
export const extractRoomId = (to: RouteLocationNormalized): string | null => {
  const name = typeof to.name === 'string' ? to.name : null
  if (!name || !ROOM_ROUTE_NAMES.has(name)) {
    return null
  }
  const roomId = to.params?.roomId
  const value = Array.isArray(roomId) ? roomId[0] : roomId
  return typeof value === 'string' && value.length > 0 ? value : null
}

const isSecretChatListRoute = (path: string): boolean => path === '/secretChat' || path.startsWith('/secretChat/')

export const createSecretChatGuard = ({
  logger,
  fallbackPath,
  isConfigured,
  isUnlocked,
  isPrivateRoom,
  ensureRegistryReady,
  openUnlock,
  warnNotConfigured
}: CreateSecretChatGuardOptions) => {
  return async (to: RouteLocationNormalized) => {
    if (isSecretChatListRoute(to.path)) {
      if (!(await isConfigured())) {
        logger.warn('私密聊天未配置密码，已拦截访问')
        await warnNotConfigured()
        return fallbackPath
      }
      if (!(await isUnlocked())) {
        logger.warn('私密聊天处于锁定态，已请求解锁')
        await openUnlock(to.fullPath)
        return fallbackPath
      }
      return true
    }

    const roomId = extractRoomId(to)
    if (!roomId) {
      return true
    }

    // 冷启动深链：此时本地缓存可能还没按当前账号加载，先确保登记表就绪再判定，
    // 否则会把私密房当普通房放行（房间已渲染，遮不住了）。
    await ensureRegistryReady()
    if (!(await isPrivateRoom(roomId))) {
      return true
    }

    // 私密房存在但当前账号没设密码 = 数据不一致（换设备 / 清除过密码）。
    // 不放行，否则等于私密房退化成普通房。
    if (!(await isConfigured())) {
      logger.warn(`私密房间 ${roomId} 无可用密码配置，已拦截进入`)
      await warnNotConfigured()
      return fallbackPath
    }
    if (!(await isUnlocked())) {
      logger.warn(`私密房间 ${roomId} 处于锁定态，已请求解锁`)
      await openUnlock(to.fullPath)
      return fallbackPath
    }
    return true
  }
}
