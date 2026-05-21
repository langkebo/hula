export const BURN = {
  STATS: '/_matrix/client/v3/user/burn/stats',
  ROOM_BURN: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/burn`
} as const
