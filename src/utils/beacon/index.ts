import type { BeaconBody } from '@/services/types'

/**
 * Beacon（MSC3672 实时位置共享）状态判定与剩余时长格式化工具。
 *
 * 桌面端 `Beacon.vue` 与移动端 `BeaconMessage.vue` 对「是否仍在共享」与
 * 「剩余时长文本」的判定逻辑相同，收敛到此处避免双实现漂移。
 */

/**
 * 判断 beacon 当前是否仍在共享（`isLive` 为真且未超过 `timeout` 窗口）。
 * @param body beacon 消息体
 * @param now 当前时间戳（毫秒），由调用方传入以便复用同一计时 tick
 */
export function isBeaconActive(body: BeaconBody | undefined, now: number): boolean {
  if (!body?.isLive) return false
  const startTime = body.lastUpdateTs || now
  return now < startTime + (body.timeout || 0)
}

/**
 * 将 beacon 剩余时长格式化为 `HH:MM:SS`（不足 1 小时时为 `MM:SS`）。
 * @param body beacon 消息体
 * @param now 当前时间戳（毫秒）
 */
export function formatBeaconRemainingTime(body: BeaconBody | undefined, now: number): string {
  if (!body) return '00:00'
  const startTime = body.lastUpdateTs || now
  const endTime = startTime + (body.timeout || 0)
  const diff = Math.max(0, Math.floor((endTime - now) / 1000))

  if (diff <= 0) return '00:00'

  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
