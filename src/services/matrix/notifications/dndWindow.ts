/**
 * 勿扰时段（Do Not Disturb）。
 *
 * 表示沿用设置窗口既有的本地时间戳（`n-time-picker` 的值），不引入第二份字符串表示。
 */
export interface DndWindow {
  enabled: boolean
  startTime: number | null
  endTime: number | null
  /**
   * 最后一次写入时间戳，用于跨设备冲突判定（新者胜）。
   *
   * 由 `MatrixNotificationService.setDndSettings` 打点并随账号数据 / localStorage 镜像携带；
   * 读取旧账号数据或旧镜像时缺失按 0 处理。
   */
  updatedAt: number
}

/** `setDndSettings` 的入参：`updatedAt` 由服务自己打，调用方不需要（也不能）伪造。 */
export type DndWindowInput = Omit<DndWindow, 'updatedAt'>

/** 时间戳 → 本地时区当天分钟数。非法时间戳得到 NaN，由调用方先做有限性校验。 */
function minutesOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  return date.getHours() * 60 + date.getMinutes()
}

/**
 * 判断 now（本地时区）是否落在 [startTime, endTime) 内。
 *
 * - `enabled` 为假，或 `startTime` / `endTime` 任一为 null（配置不完整）→ false，不抑制；
 * - `startTime` / `endTime` 不是有限数（账号数据里可能出现 NaN）→ false，不抑制：
 *   否则 `start=NaN, end=08:00` 会走跨午夜分支 `current >= NaN || current < end`
 *   在上午误判为"在勿扰窗口内"，把正常通知静默吃掉；
 * - 起止同一时刻视为全天勿扰；
 * - 跨午夜按 [start, end) 处理（如 22:00 -> 08:00）。
 */
export function isWithinDndWindow(window: DndWindow, now: Date): boolean {
  if (!window.enabled) {
    return false
  }

  if (window.startTime === null || window.endTime === null) {
    return false
  }

  if (!Number.isFinite(window.startTime) || !Number.isFinite(window.endTime)) {
    return false
  }

  const start = minutesOfDay(window.startTime)
  const end = minutesOfDay(window.endTime)
  const current = now.getHours() * 60 + now.getMinutes()

  if (start === end) {
    return true
  }

  if (start < end) {
    return current >= start && current < end
  }

  return current >= start || current < end
}
