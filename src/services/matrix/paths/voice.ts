import { PREFIX_V1 } from './prefixes'

export const VOICE = {
  CONFIG: PREFIX_V1 + '/voice/config',
  UPLOAD: PREFIX_V1 + '/voice/upload',
  ROOM_LIST: (roomId: string) => `${PREFIX_V1}/voice/room/${encodeURIComponent(roomId)}`,
  USER_LIST: (userId: string) => `${PREFIX_V1}/voice/user/${encodeURIComponent(userId)}`,
  CONTENT: (messageId: string) => `${PREFIX_V1}/voice/${encodeURIComponent(messageId)}`,
  CONVERT: PREFIX_V1 + '/voice/convert',
  OPTIMIZE: PREFIX_V1 + '/voice/optimize',
  TRANSCRIPTION: PREFIX_V1 + '/voice/transcription',
  /** MSC4143 RTC 传输协议信息（FT-096） */
  RTC_TRANSPORTS: '/_matrix/client/unstable/org.matrix.msc4143/rtc/transports'
} as const
