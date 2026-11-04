export interface MobileNavItem {
  labelKey: string
  path: string
  icon: string
  actionIcon: string
  testId: string
  unreadKey?: 'messageUnreadCount' | 'contactUnreadCount'
}

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  {
    labelKey: 'mobile_tabbar.items.messages',
    path: '/mobile/message',
    icon: 'message',
    actionIcon: 'message-action',
    testId: 'mobile-tab-message',
    unreadKey: 'messageUnreadCount'
  },
  {
    labelKey: 'mobile_tabbar.items.contacts',
    path: '/mobile/friends',
    icon: 'avatar',
    actionIcon: 'avatar-action',
    testId: 'mobile-tab-friends',
    unreadKey: 'contactUnreadCount'
  },
  {
    labelKey: 'mobile_tabbar.items.rooms',
    path: '/mobile/rooms',
    icon: 'room',
    actionIcon: 'room-action',
    testId: 'mobile-tab-rooms'
  },
  {
    labelKey: 'mobile_tabbar.items.spaces',
    path: '/mobile/space',
    icon: 'space',
    actionIcon: 'space',
    testId: 'mobile-tab-space'
  },
  {
    labelKey: 'mobile_tabbar.items.me',
    path: '/mobile/my',
    icon: 'wode',
    actionIcon: 'wode-action',
    testId: 'mobile-tab-my'
  }
]

export const resolveNavItems = (t: (key: string) => string) =>
  MOBILE_NAV_ITEMS.map((item) => ({ ...item, label: t(item.labelKey) }))
