export const VOICE = {
  CONFIG: '/_matrix/client/v1/voice/config',
  STATS: '/_matrix/client/v1/voice/stats',
  ROOM_STATS: (roomId: string) => `/_matrix/client/v1/voice/room/${encodeURIComponent(roomId)}/stats`,
  UPLOAD: '/_matrix/client/v1/voice/upload',
  ROOM_LIST: (roomId: string) => `/_matrix/client/v1/voice/room/${encodeURIComponent(roomId)}`,
  USER_LIST: (userId: string) => `/_matrix/client/v1/voice/user/${encodeURIComponent(userId)}`,
  USER_STATS: (userId: string) => `/_matrix/client/v1/voice/user/${encodeURIComponent(userId)}/stats`,
  CONTENT: (messageId: string) => `/_matrix/client/v1/voice/${encodeURIComponent(messageId)}`,
  CONVERT: '/_matrix/client/v1/voice/convert',
  OPTIMIZE: '/_matrix/client/v1/voice/optimize',
  TRANSCRIPTION: '/_matrix/client/v1/voice/transcription'
} as const
