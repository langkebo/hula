import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTIFICATION_CONFIG, sanitizeNotificationEvents } from '../notificationConfig'

/**
 * `events` 的逐键清洗：只保留布尔值条目，非法条目视为**缺省（开启）**。
 *
 * 这条规则是安全侧取向：坏配置不能静默把通知关掉（用户会以为「没人找我」），
 * 也不能因为一条脏数据把整份配置判废。所以逐键丢弃、合法兄弟键保留。
 */
describe('sanitizeNotificationEvents', () => {
  it('保留布尔值条目', () => {
    expect(sanitizeNotificationEvents({ thread_mention: true, other: false })).toEqual({
      thread_mention: true,
      other: false
    })
  })

  it('丢弃非布尔值条目（字符串 "false" / 0 / null 都不算）', () => {
    expect(
      sanitizeNotificationEvents({
        thread_mention: 'false',
        other: 0,
        yet_another: null,
        ok: true
      })
    ).toEqual({ ok: true })
  })

  it('嵌套对象/数组作为值同样丢弃', () => {
    expect(sanitizeNotificationEvents({ a: { nested: true }, b: [true], c: false })).toEqual({ c: false })
  })

  it('非对象输入一律 undefined（表示「用户没写过」）', () => {
    expect(sanitizeNotificationEvents(null)).toBeUndefined()
    expect(sanitizeNotificationEvents(undefined)).toBeUndefined()
    expect(sanitizeNotificationEvents('{"a":true}')).toBeUndefined()
    expect(sanitizeNotificationEvents(42)).toBeUndefined()
  })

  it('数组不算对象（避免把列表误当配置）', () => {
    expect(sanitizeNotificationEvents([true, false])).toBeUndefined()
  })

  it('空对象合法，返回空表（不是 undefined）', () => {
    expect(sanitizeNotificationEvents({})).toEqual({})
  })

  it('默认配置的 events 为空表（缺省即全部开启）', () => {
    expect(DEFAULT_NOTIFICATION_CONFIG.events).toEqual({})
  })
})
