import { describe, expect, it } from 'vitest'
import { type DndWindow, isWithinDndWindow } from '../dndWindow'

/** 只用本地时区语义，因此用本地构造函数造时间戳。 */
const at = (hours: number, minutes: number): number => new Date(2026, 5, 15, hours, minutes, 0, 0).getTime()
const nowAt = (hours: number, minutes: number): Date => new Date(2026, 5, 15, hours, minutes, 0, 0)

const dnd = (overrides: Partial<DndWindow> = {}): DndWindow => ({
  enabled: true,
  startTime: at(22, 0),
  endTime: at(8, 0),
  ...overrides
})

describe('isWithinDndWindow', () => {
  it('is off while the switch is disabled', () => {
    expect(isWithinDndWindow(dnd({ enabled: false }), nowAt(23, 0))).toBe(false)
  })

  it('is off when either boundary is missing', () => {
    expect(isWithinDndWindow(dnd({ startTime: null }), nowAt(23, 0))).toBe(false)
    expect(isWithinDndWindow(dnd({ endTime: null }), nowAt(23, 0))).toBe(false)
    expect(isWithinDndWindow(dnd({ startTime: null, endTime: null }), nowAt(23, 0))).toBe(false)
  })

  it('is off when a boundary is not a finite number', () => {
    // 账号数据未校验时可能存进 NaN。旧的跨午夜分支会算成
    // `current >= NaN || current < end` → 上午恒真，静默抑制通知。
    expect(isWithinDndWindow(dnd({ startTime: Number.NaN, endTime: at(8, 0) }), nowAt(3, 0))).toBe(false)
    expect(isWithinDndWindow(dnd({ startTime: Number.NaN, endTime: at(8, 0) }), nowAt(12, 0))).toBe(false)
    expect(isWithinDndWindow(dnd({ startTime: at(22, 0), endTime: Number.NaN }), nowAt(3, 0))).toBe(false)
    expect(isWithinDndWindow(dnd({ startTime: Number.POSITIVE_INFINITY }), nowAt(3, 0))).toBe(false)
  })

  it('treats an identical start and end as all-day', () => {
    const allDay = dnd({ startTime: at(9, 30), endTime: at(9, 30) })
    expect(isWithinDndWindow(allDay, nowAt(3, 0))).toBe(true)
    expect(isWithinDndWindow(allDay, nowAt(9, 30))).toBe(true)
    expect(isWithinDndWindow(allDay, nowAt(23, 59))).toBe(true)
  })

  it('covers a same-day window as [start, end)', () => {
    const window = dnd({ startTime: at(13, 0), endTime: at(15, 0) })
    expect(isWithinDndWindow(window, nowAt(12, 59))).toBe(false)
    expect(isWithinDndWindow(window, nowAt(13, 0))).toBe(true)
    expect(isWithinDndWindow(window, nowAt(14, 59))).toBe(true)
    expect(isWithinDndWindow(window, nowAt(15, 0))).toBe(false)
  })

  it('covers a cross-midnight window as [start, end)', () => {
    const window = dnd({ startTime: at(22, 0), endTime: at(8, 0) })
    expect(isWithinDndWindow(window, nowAt(21, 59))).toBe(false)
    expect(isWithinDndWindow(window, nowAt(22, 0))).toBe(true)
    expect(isWithinDndWindow(window, nowAt(23, 59))).toBe(true)
    expect(isWithinDndWindow(window, nowAt(0, 0))).toBe(true)
    expect(isWithinDndWindow(window, nowAt(7, 59))).toBe(true)
    expect(isWithinDndWindow(window, nowAt(8, 0))).toBe(false)
    expect(isWithinDndWindow(window, nowAt(12, 0))).toBe(false)
  })
})
