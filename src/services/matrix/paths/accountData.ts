export const ACCOUNT_DATA = {
  ROOM_ACCOUNT_DATA: (userId: string, roomId: string, type: string) =>
    `/user/${encodeURIComponent(userId)}/rooms/${encodeURIComponent(roomId)}/account_data/${encodeURIComponent(type)}`,
  USER_ACCOUNT_DATA: (userId: string, type: string) =>
    `/user/${encodeURIComponent(userId)}/account_data/${encodeURIComponent(type)}`
} as const
