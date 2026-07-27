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

const _MatrixPresence = {
  ONLINE: 'online',
  UNAVAILABLE: 'unavailable',
  OFFLINE: 'offline'
} as const

const _MatrixPowerLevel = {
  ADMIN: 100,
  MODERATOR: 50,
  DEFAULT: 0
} as const

export const MatrixBurnDuration = {
  SEC_30: 30,
  SEC_300: 300,
  SEC_3600: 3600,
  SEC_86400: 86400,
  DEFAULT_MS: 60000
} as const

const _MatrixSync = {
  SLIDING_SYNC_RANGE_END: 20,
  TIMELINE_LIMIT: 10,
  POLL_TIMEOUT_MS: 30000,
  INITIAL_SYNC_LIMIT: 20
} as const

const _MatrixCache = {
  DEFAULT_TTL_MS: 30000,
  ROOM_DETAIL_MAX_SIZE: 50,
  MESSAGE_CACHE_MAX_ROOMS: 20
} as const

const _MatrixMedia = {
  DEFAULT_IMAGE_QUALITY: 0.8,
  DEFAULT_MAX_WIDTH: 1920,
  DEFAULT_MAX_HEIGHT: 1920,
  DEFAULT_MAX_SIZE_KB: 1024
} as const

const _ERROR_CLIENT_NOT_INITIALIZED = '客户端未初始化'
export const ERROR_CLIENT_NOT_INITIALIZED_EN = 'Matrix client not initialized'

export function isMessageEventType(eventType: string): boolean {
  return eventType === MatrixEventType.ROOM_MESSAGE || eventType === MatrixEventType.ROOM_ENCRYPTED
}
