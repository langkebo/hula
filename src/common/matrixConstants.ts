export const MatrixEventType = {
  ROOM_MESSAGE: 'm.room.message',
  ROOM_ENCRYPTED: 'm.room.encrypted',
  ROOM_MEMBER: 'm.room.member',
  ROOM_REDACTION: 'm.room.redaction',
  ROOM_CREATE: 'm.room.create',
  ROOM_NAME: 'm.room.name',
  ROOM_TOPIC: 'm.room.topic',
  ROOM_AVATAR: 'm.room.avatar',
  ROOM_PINNED_EVENTS: 'm.room.pinned_events',
  ROOM_POWER_LEVELS: 'm.room.power_levels',
  ROOM_JOIN_RULES: 'm.room.join_rules',
  ROOM_HISTORY_VISIBILITY: 'm.room.history_visibility',
  ROOM_GUEST_ACCESS: 'm.room.guest_access',
  ROOM_SERVER_ACL: 'm.room.server_acl',
  REACTION: 'm.reaction',
  KEY_VERIFICATION_START: 'm.key.verification.start',
  KEY_VERIFICATION_DONE: 'm.key.verification.done',
  KEY_VERIFICATION_CANCEL: 'm.key.verification.cancel'
} as const

// m.room.create 事件的 content.type：标识房间用途，缺省即普通聊天房间
export const MatrixRoomType = {
  SPACE: 'm.space',
  /** 后端用于存放好友关系（m.friends.list）的私有容器房间，不是聊天会话 */
  FRIENDS: 'm.friends'
} as const

export const MatrixMsgType = {
  TEXT: 'm.text',
  NOTICE: 'm.notice',
  IMAGE: 'm.image',
  FILE: 'm.file',
  AUDIO: 'm.audio',
  VIDEO: 'm.video',
  LOCATION: 'm.location',
  BEACON_INFO: 'm.beacon_info',
  BEACON: 'm.beacon',
  BAD_ENCRYPTED: 'm.bad.encrypted',
  SERVER_NOTICE: 'm.server_notice'
} as const

export const MatrixRelType = {
  THREAD: 'm.thread',
  REPLACES: 'm.replace',
  REFERENCE: 'm.reference',
  ANNOTATION: 'm.annotation'
} as const

export const MatrixContentField = {
  RELATES_TO: 'm.relates_to',
  FORMATTED_BODY: 'formatted_body',
  FORMAT: 'format'
} as const

export const MatrixFormat = {
  HTML: 'org.matrix.custom.html'
} as const

export const MatrixBurnDuration = {
  SEC_30: 30,
  SEC_300: 300,
  SEC_3600: 3600,
  SEC_86400: 86400,
  DEFAULT_MS: 60000
} as const

export const ERROR_CLIENT_NOT_INITIALIZED_EN = 'Matrix client not initialized'

export function isMessageEventType(eventType: string): boolean {
  return eventType === MatrixEventType.ROOM_MESSAGE || eventType === MatrixEventType.ROOM_ENCRYPTED
}
