import { matrixClientService } from '@/services/matrix/MatrixClientService'

export interface RoomInfo {
  roomId: string
  name: string
  avatar?: string
  isDirect: boolean
  isEncrypted: boolean
  memberCount: number
}

export async function getRoomInfo(roomId: string): Promise<RoomInfo | null> {
  try {
    const client = matrixClientService.getClient()
    if (!client) return null

    const room = client.getRoom(roomId)
    if (!room) return null

    return {
      roomId: room.roomId,
      name: room.name || room.roomId,
      avatar: room.getAvatarUrl() || undefined,
      isDirect: client.getDMRooms().includes(room.roomId),
      isEncrypted: client.isRoomEncrypted(room.roomId),
      memberCount: room.getJoinedMemberCount()
    }
  } catch (_err) {
    return null
  }
}

export function getRoomDisplayName(roomId: string): string {
  const client = matrixClientService.getClient()
  if (!client) return roomId

  const room = client.getRoom(roomId)
  return room?.name || roomId
}

export function isDirectRoom(roomId: string): boolean {
  const client = matrixClientService.getClient()
  if (!client) return false

  const room = client.getRoom(roomId)
  if (!room) return false

  return client.getDMRooms().includes(room.roomId)
}

export function getRoomMembers(roomId: string): string[] {
  const client = matrixClientService.getClient()
  if (!client) return []

  const room = client.getRoom(roomId)
  if (!room) return []

  return room.getMembers().map((m) => m.userId)
}

export function getRoomAvatar(roomId: string): string | null {
  const client = matrixClientService.getClient()
  if (!client) return null

  const room = client.getRoom(roomId)
  if (!room) return null

  return room.getAvatarUrl() || null
}

export async function resolveMyRoomNickname(roomId: string): Promise<string | null> {
  const client = matrixClientService.getClient()
  if (!client) return null

  const room = client.getRoom(roomId)
  if (!room) return null

  const userId = client.getUserId()
  if (!userId) return null

  const member = room.getMember(userId)
  return member?.rawDisplayName || member?.name || null
}
