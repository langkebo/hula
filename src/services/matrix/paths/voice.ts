import { PREFIX_VENDOR_V1 } from './prefixes'

export const VOICE = {
  CONFIG: PREFIX_VENDOR_V1 + '/voice/config',
  UPLOAD: PREFIX_VENDOR_V1 + '/voice/upload',
  /** 注册加密语音到 voice_usage_stats 表（Phase 2.3） */
  REGISTER_ENCRYPTED: PREFIX_VENDOR_V1 + '/voice/register',
  ROOM_LIST: (roomId: string) => `${PREFIX_VENDOR_V1}/voice/room/${encodeURIComponent(roomId)}`,
  USER_LIST: (userId: string) => `${PREFIX_VENDOR_V1}/voice/user/${encodeURIComponent(userId)}`,
  CONTENT: (messageId: string) => `${PREFIX_VENDOR_V1}/voice/${encodeURIComponent(messageId)}`,
  CONVERT: PREFIX_VENDOR_V1 + '/voice/convert',
  OPTIMIZE: PREFIX_VENDOR_V1 + '/voice/optimize',
  TRANSCRIPTION: PREFIX_VENDOR_V1 + '/voice/transcription',
  /** MSC4143 RTC 传输协议信息（FT-096） */
  RTC_TRANSPORTS: '/_matrix/client/unstable/org.matrix.msc4143/rtc/transports'
} as const
