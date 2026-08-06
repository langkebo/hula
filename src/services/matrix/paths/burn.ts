export const BURN = {
  STATS: '/user/burn/stats',
  ROOM_BURN: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/burn`
} as const
