import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatChatTime, formatDateLabel } from '../ComputedTime'

// Mock useI18nGlobal to avoid i18n setup in unit tests
vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'common.just_now': '刚刚',
        'common.minutes_ago': `${params?.count ?? 0} 分钟前`,
        'menu.today': '今天',
        'menu.yesterday': '昨天'
      }
      return map[key] ?? key
    }
  })
}))

describe('formatChatTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty string for invalid timestamp', () => {
    expect(formatChatTime(0)).toBe('')
    expect(formatChatTime(-1)).toBe('')
    expect(formatChatTime(NaN)).toBe('')
  })

  it('returns absolute time for future timestamps', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const future = new Date('2026-08-05T12:01:00').getTime()
    expect(formatChatTime(future)).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/)
  })

  it('shows "刚刚" for less than 1 minute ago', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-08-05T11:59:30').getTime()
    expect(formatChatTime(ts)).toBe('刚刚')
  })

  it('shows "X 分钟前" for less than 1 hour ago', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-08-05T11:50:00').getTime()
    expect(formatChatTime(ts)).toBe('10 分钟前')
  })

  it('shows HH:mm for today', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-08-05T10:30:00').getTime()
    expect(formatChatTime(ts)).toBe('10:30')
  })

  it('shows "昨天 HH:mm" for yesterday', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-08-04T10:30:00').getTime()
    expect(formatChatTime(ts)).toBe('昨天 10:30')
  })

  it('shows weekday HH:mm within this week', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00')) // Tuesday
    const ts = new Date('2026-08-03T10:30:00').getTime() // Sunday
    // \S accommodates both English ("Monday") and Chinese ("星期一") weekday names
    expect(formatChatTime(ts)).toMatch(/\S+ 10:30/)
  })

  it('shows YYYY-MM-DD HH:mm for older dates', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-07-01T10:30:00').getTime()
    expect(formatChatTime(ts)).toBe('2026-07-01 10:30')
  })

  it('detail mode shows full date-time for today', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-08-05T10:30:00').getTime()
    expect(formatChatTime(ts, { detail: true })).toBe('10:30:00')
  })

  it('detail mode shows YYYY-MM-DD HH:mm:ss for cross-year', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2025-06-15T10:30:00').getTime()
    expect(formatChatTime(ts, { detail: true })).toBe('2025-06-15 10:30:00')
  })

  it('detail mode shows MM-DD HH:mm:ss for same year non-today', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-06-15T10:30:00').getTime()
    expect(formatChatTime(ts, { detail: true })).toBe('06-15 10:30:00')
  })

  it('non-detail mode shows YYYY-MM-DD for cross-year', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2025-06-15T10:30:00').getTime()
    expect(formatChatTime(ts)).toBe('2025-06-15')
  })
})

describe('formatDateLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows "今天" for today', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-08-05T10:00:00').getTime()
    expect(formatDateLabel(ts)).toBe('今天')
  })

  it('shows "昨天" for yesterday', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-08-04T10:00:00').getTime()
    expect(formatDateLabel(ts)).toBe('昨天')
  })

  it('shows MM-DD for older dates', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-06-15T10:00:00').getTime()
    expect(formatDateLabel(ts)).toBe('06-15')
  })
})
