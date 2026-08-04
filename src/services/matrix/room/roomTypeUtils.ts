import type { MatrixClient, Room } from 'matrix-js-sdk'

/**
 * 判断房间是否为 DM（直接消息）房间。
 *
 * 统一封装 m.direct account data 检查逻辑，避免在 RealtimeService、useRoomType、
 * RoomOperations 等多处重复实现。
 *
 * @param client Matrix 客户端实例
 * @param roomId 房间 ID
 * @returns 是否为 DM 房间
 */
export function isDirectMessageRoom(client: MatrixClient | null | undefined, roomId: string): boolean {
  if (!client || !roomId) return false

  // 1. 检查 m.direct account data
  const directAccount = client.getAccountData('m.direct')
  const directMap = directAccount?.getContent() as Record<string, { room_id: string }[]> | undefined
  if (directMap) {
    const isDm = Object.values(directMap).some((rooms) => rooms?.some((r) => r?.room_id === roomId))
    if (isDm) return true
  }

  // 2. 检查 Room 对象的 DM 标记（SDK 内部状态）
  const room = client.getRoom(roomId)
  if (room) {
    const dmInviter = room.getDMInviter?.()
    if (dmInviter) return true
  }

  return false
}

/**
 * 判断房间是否为 DM 房间（基于 Room 对象）。
 * 用于 convertRoomToSession 等场景，已有 Room 对象时无需再查 client。
 */
export function isDirectMessageRoomFromRoom(client: MatrixClient | null | undefined, room: Room): boolean {
  if (!client) return false

  // 1. 检查 m.direct account data
  const directAccount = client.getAccountData('m.direct')
  const directMap = directAccount?.getContent() as Record<string, { room_id: string }[]> | undefined
  if (directMap) {
    const isDm = Object.values(directMap).some((rooms) => rooms?.some((r) => r?.room_id === room.roomId))
    if (isDm) return true
  }

  // 2. 检查 Room 对象的 DM 标记
  const dmInviter = room.getDMInviter?.()
  if (dmInviter) return true

  return false
}
