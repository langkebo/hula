/**
 * 勿扰时段（Do Not Disturb）。
 *
 * 表示沿用设置窗口既有的本地时间戳（`n-time-picker` 的值），不引入第二份字符串表示。
 */
export interface DndWindow {
  enabled: boolean
  startTime: number | null
  endTime: number | null
}

/** 时间戳 → 本地时区当天分钟数。非法时间戳得到 NaN，后续比较一律为 false（不抑制）。 */
function minutesOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  return date.getHours() * 60 + date.getMinutes()
}

/**
 * 判断 now（本地时区）是否落在 [startTime, endTime) 内。
 *
 * - `enabled` 为假，或 `startTime` / `endTime` 任一为 null（配置不完整）→ false，不抑制；
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
