import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock useI18nGlobal，避免依赖真实 i18n 实例
vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'common.just_now') return '刚刚'
      if (key === 'common.minutes_ago') return `${params?.count} 分钟前`
      if (key === 'menu.yesterday') return '昨天'
      return key
    }
  })
}))

import { formatMessageTime } from '../ComputedTime'

describe('formatMessageTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty string for invalid timestamp (0, negative, NaN)', () => {
    expect(formatMessageTime(0)).toBe('')
    expect(formatMessageTime(-1)).toBe('')
    expect(formatMessageTime(Number.NaN)).toBe('')
  })

  it('returns absolute time for future timestamps', () => {
    // 设定当前时间为 2026-07-26 12:00:00
    const now = new Date(2026, 6, 26, 12, 0, 0).getTime()
    vi.setSystemTime(now)

    // 未来 1 小时
    const future = now + 3_600_000
    const result = formatMessageTime(future)
    // 应返回绝对时间格式 YYYY-MM-DD HH:mm
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it('returns "刚刚" for timestamps less than 1 minute ago', () => {
    const now = new Date(2026, 6, 26, 12, 0, 0).getTime()
    vi.setSystemTime(now)

    // 30 秒前
    expect(formatMessageTime(now - 30_000)).toBe('刚刚')
    // 59 秒前
    expect(formatMessageTime(now - 59_000)).toBe('刚刚')
  })

  it('returns "X 分钟前" for timestamps less than 1 hour ago', () => {
    const now = new Date(2026, 6, 26, 12, 0, 0).getTime()
    vi.setSystemTime(now)

    // 1 分钟前
    expect(formatMessageTime(now - 60_000)).toBe('1 分钟前')
    // 5 分钟前
    expect(formatMessageTime(now - 5 * 60_000)).toBe('5 分钟前')
    // 59 分钟前
    expect(formatMessageTime(now - 59 * 60_000)).toBe('59 分钟前')
  })

  it('returns "HH:mm" for today timestamps (>= 1 hour ago)', () => {
    const now = new Date(2026, 6, 26, 12, 0, 0).getTime()
    vi.setSystemTime(now)

    // 2 小时前（今天）
    const twoHoursAgo = now - 2 * 3_600_000
    const result = formatMessageTime(twoHoursAgo)
    expect(result).toMatch(/^\d{2}:\d{2}$/)
    expect(result).toBe('10:00')
  })

  it('returns "昨天 HH:mm" for yesterday timestamps', () => {
    const now = new Date(2026, 6, 26, 12, 0, 0).getTime()
    vi.setSystemTime(now)

    // 昨天 10:30
    const yesterday = new Date(2026, 6, 25, 10, 30, 0).getTime()
    expect(formatMessageTime(yesterday)).toBe('昨天 10:30')
  })

  it('returns "星期几 HH:mm" for timestamps within this week (after yesterday)', () => {
    const now = new Date(2026, 6, 26, 12, 0, 0).getTime() // 2026-07-26 周日
    vi.setSystemTime(now)

    // 3 天前（2026-07-23 周四）
    const threeDaysAgo = new Date(2026, 6, 23, 14, 0, 0).getTime()
    const result = formatMessageTime(threeDaysAgo)
    // 应返回 "星期四 14:00" 或 "Thursday 14:00"（取决于 locale）
    expect(result).toMatch(/\d{2}:\d{2}$/)
    expect(result).not.toContain('昨天')
  })

  it('returns "YYYY-MM-DD HH:mm" for timestamps older than 1 week', () => {
    const now = new Date(2026, 6, 26, 12, 0, 0).getTime()
    vi.setSystemTime(now)

    // 10 天前
    const tenDaysAgo = new Date(2026, 6, 16, 9, 15, 0).getTime()
    expect(formatMessageTime(tenDaysAgo)).toBe('2026-07-16 09:15')
  })

  it('handles boundary between "刚刚" and "X 分钟前" correctly', () => {
    const now = new Date(2026, 6, 26, 12, 0, 0).getTime()
    vi.setSystemTime(now)

    // 刚好 60 秒前（边界，应属于"1 分钟前"）
    expect(formatMessageTime(now - 60_000)).toBe('1 分钟前')
  })

  it('handles boundary between "X 分钟前" and "HH:mm" correctly', () => {
    const now = new Date(2026, 6, 26, 12, 0, 0).getTime()
    vi.setSystemTime(now)

    // 刚好 60 分钟前 = 1 小时前（今天，应返回 HH:mm）
    const oneHourAgo = now - 3_600_000
    const result = formatMessageTime(oneHourAgo)
    expect(result).toBe('11:00')
  })
})
