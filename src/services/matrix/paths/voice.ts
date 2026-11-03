import { PREFIX_VENDOR_V1 } from './prefixes'

export const VOICE = {
  CONFIG: PREFIX_VENDOR_V1 + '/voice/config',
  UPLOAD: PREFIX_VENDOR_V1 + '/voice/upload',
  ROOM_LIST: (roomId: string) => `${PREFIX_VENDOR_V1}/voice/room/${encodeURIComponent(roomId)}`,
  USER_LIST: (userId: string) => `${PREFIX_VENDOR_V1}/voice/user/${encodeURIComponent(userId)}`,
  CONTENT: (messageId: string) => `${PREFIX_VENDOR_V1}/voice/${encodeURIComponent(messageId)}`
} as const
