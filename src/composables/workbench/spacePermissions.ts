type SpaceMemberLike = {
  powerLevel?: number
  getPowerLevel?: () => number
}

type SpaceRoomLike = {
  getMyMembership?: () => string | undefined
  getMember?: (userId: string) => SpaceMemberLike | null | undefined
  currentState?: {
    getMember?: (userId: string) => SpaceMemberLike | null | undefined
  } | null
}

type MatrixClientLike = {
  getUserId?: () => string | null | undefined
  getRoom?: (roomId: string) => SpaceRoomLike | null | undefined
}

export const SPACE_MANAGE_POWER_LEVEL = 50

export function canManageSpaceByPowerLevel(client: MatrixClientLike | null | undefined, spaceId: string): boolean {
  if (!client || !spaceId) {
    return false
  }

  const userId = client.getUserId?.()
  const room = client.getRoom?.(spaceId)
  if (!userId || !room || room.getMyMembership?.() !== 'join') {
    return false
  }

  const member = room.getMember?.(userId) ?? room.currentState?.getMember?.(userId)
  const powerLevel = member?.powerLevel ?? member?.getPowerLevel?.() ?? 0
  return powerLevel >= SPACE_MANAGE_POWER_LEVEL
}
