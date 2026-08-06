export const NOTIFICATION = {
  PUSH_RULES: '/pushrules/',
  NOTIFICATIONS: '/notifications',
  NOTIFICATIONS_ACK: (notificationId: string) => `/notifications/${encodeURIComponent(notificationId)}/ack`,
  PUSHERS: '/pushers',
  PUSHERS_SET: '/pushers/set'
} as const
