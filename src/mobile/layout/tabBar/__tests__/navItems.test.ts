import { describe, expect, it } from 'vitest'
import { MOBILE_NAV_ITEMS, resolveNavItems } from '../navItems'

describe('mobile nav items', () => {
  it('keeps five primary tabs', () => {
    expect(MOBILE_NAV_ITEMS.map((item) => item.path)).toEqual([
      '/mobile/message',
      '/mobile/friends',
      '/mobile/rooms',
      '/mobile/space',
      '/mobile/my'
    ])
  })

  it('resolves labels through t() so locale switches are reactive', () => {
    const zh = resolveNavItems((key) => `zh:${key}`)
    const en = resolveNavItems((key) => `en:${key}`)
    expect(zh[0].label).toBe('zh:mobile_tabbar.items.messages')
    expect(en[0].label).toBe('en:mobile_tabbar.items.messages')
  })

  it('declares unread sources by key instead of translated label', () => {
    expect(MOBILE_NAV_ITEMS[0].unreadKey).toBe('messageUnreadCount')
    expect(MOBILE_NAV_ITEMS[1].unreadKey).toBe('contactUnreadCount')
    expect(MOBILE_NAV_ITEMS[2].unreadKey).toBeUndefined()
  })
})
