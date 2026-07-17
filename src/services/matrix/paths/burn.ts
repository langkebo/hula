export const BURN = {
  STATS: '/user/burn/stats',
  ROOM_BURN: (roomId: string) => `/rooms/${roomId}/burn`
} as const
