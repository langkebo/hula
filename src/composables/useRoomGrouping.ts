import { computed } from 'vue'
import type { Ref } from 'vue'

export interface RoomLike {
  roomId: string
  isDirect?: boolean
  memberCount?: number
  lastMessageTs?: number
  name?: string
  avatarUrl?: string | null
}

export interface SpaceLike {
  roomId: string
  name?: string
  avatarUrl?: string | null
  memberCount?: number
  childCount?: number
}

export function useRoomGrouping(rooms: Ref<RoomLike[]>) {
  const recentRooms = computed(() => {
    return rooms.value
      .filter((r) => r.lastMessageTs)
      .sort((a, b) => (b.lastMessageTs || 0) - (a.lastMessageTs || 0))
      .slice(0, 10)
  })

  const groupRooms = computed(() => {
    return rooms.value.filter((r) => !r.isDirect && (r.memberCount ?? 0) > 2)
  })

  const directRooms = computed(() => {
    return rooms.value.filter((r) => r.isDirect)
  })

  const groupedRooms = computed(() => {
    const groups = new Map<string, RoomLike[]>()
    rooms.value.forEach((room) => {
      const type = room.isDirect ? 'direct' : (room.memberCount ?? 0) > 2 ? 'group' : 'recent'
      if (!groups.has(type)) {
        groups.set(type, [])
      }
      groups.get(type)!.push(room)
    })
    return groups
  })

  return {
    recentRooms,
    groupRooms,
    directRooms,
    groupedRooms
  }
}
