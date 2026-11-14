import { describe, expect, it } from 'vitest'
import {
  filterUnreadNotifications,
  getNotificationId,
  isNotificationRead,
  notificationKey
} from '../notificationHistoryPresentation'

describe('notificationHistoryPresentation', () => {
  it('isNotificationRead 只认严格 true', () => {
    expect(isNotificationRead({ read: true })).toBe(true)
    expect(isNotificationRead({ read: false })).toBe(false)
    expect(isNotificationRead({ read: 1 })).toBe(false)
    expect(isNotificationRead({})).toBe(false)
  })

  it('filterUnreadNotifications 移除已读条目并保持原顺序', () => {
    const list = [
      { notification_id: 1, read: false },
      { notification_id: 2, read: true },
      { notification_id: 3 },
      { notification_id: 4, read: true }
    ]

    expect(filterUnreadNotifications(list).map((notif) => notif.notification_id)).toEqual([1, 3])
  })

  it('filterUnreadNotifications 不修改入参', () => {
    const list = [{ notification_id: 1, read: false }]
    filterUnreadNotifications(list)
    expect(list).toHaveLength(1)
  })

  it('getNotificationId 兼容数字与字符串，其余返回 null', () => {
    expect(getNotificationId({ notification_id: 42 })).toBe('42')
    expect(getNotificationId({ notification_id: '42' })).toBe('42')
    expect(getNotificationId({ notification_id: null })).toBeNull()
    expect(getNotificationId({})).toBeNull()
  })

  it('notificationKey 优先通知 ID，缺失时退回事件 ID，再退回序号', () => {
    expect(notificationKey({ notification_id: 7, event_id: '$e' }, 0)).toBe('7')
    expect(notificationKey({ event_id: '$e' }, 1)).toBe('$e')
    expect(notificationKey({}, 2)).toBe('2')
  })
})
