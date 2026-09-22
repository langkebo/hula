import { createLogger } from '@/utils/Logger'

const logger = createLogger('DndMirror')

/**
 * 设备本地勿扰时段（DND）镜像的 storage key。
 *
 * 镜像不是账号数据，而是「账号数据可用前的本地水合 + 跨窗口刷新」缓存。
 * 正因为它跨会话存在，必须带 `owner` 归属：否则同设备换账号后，上一个账号较新的
 * `updatedAt` 会在「本地新者胜」规则下把新账号的服务端值永久挡住。
 */
export const DND_MIRROR_STORAGE_KEYS = {
  enabled: 'tjg-push-dnd',
  start: 'tjg-push-dnd-start',
  end: 'tjg-push-dnd-end',
  updatedAt: 'tjg-push-dnd-updated-at',
  owner: 'tjg-push-dnd-owner'
} as const

/** 清空设备本地 DND 镜像（登出 / 账号重置时会话级回收，见 `SessionLogoutService`）。 */
export function clearDndMirrorCache(): void {
  try {
    for (const key of Object.values(DND_MIRROR_STORAGE_KEYS)) {
      localStorage.removeItem(key)
    }
  } catch (err) {
    logger.warn('清理勿扰时段镜像失败:', err)
  }
}

/**
 * 账号隔离：镜像记录了写入时的 uid（`owner`）。
 *
 * 当前 uid 与 owner 不一致说明换了账号，必须作废整份镜像：否则上一个账号较新的
 * `updatedAt` 会挡住新账号的服务端值（与 `invitePolicy` 的按账号缓存同一处置）。
 * 返回 `true` 表示镜像已因换号被清除。
 */
export function clearDndMirrorIfAccountChanged(currentUserId: string | null): boolean {
  if (!currentUserId) {
    return false
  }

  let owner: string | null = null
  try {
    owner = localStorage.getItem(DND_MIRROR_STORAGE_KEYS.owner)
  } catch (err) {
    logger.warn('读取勿扰时段镜像归属失败:', err)
    return false
  }

  if (owner && owner !== currentUserId) {
    clearDndMirrorCache()
    logger.info('[DndMirror] 检测到账号切换，已作废上一个账号的勿扰镜像')
    return true
  }
  return false
}

/** 记录镜像归属账号。uid 缺失时跳过：没有身份就没有隔离维度，不写无主镜像。 */
export function markDndMirrorOwner(currentUserId: string | null): void {
  if (!currentUserId) {
    return
  }
  try {
    localStorage.setItem(DND_MIRROR_STORAGE_KEYS.owner, currentUserId)
  } catch (err) {
    logger.warn('记录勿扰时段镜像归属失败:', err)
  }
}
