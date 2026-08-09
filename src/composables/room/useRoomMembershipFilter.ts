import { computed, type MaybeRefOrGetter, ref, toValue } from 'vue'

export type RoomMembershipFilter = 'all' | 'joined' | 'created'

interface FilterableRoom {
  roomId: string
  membership?: 'join' | 'leave' | 'invite' | 'ban'
  creator?: string | null
}

interface UseRoomMembershipFilterOptions {
  currentUserId: string | null | undefined
}

export function useRoomMembershipFilter<T extends FilterableRoom>(
  sourceRooms: MaybeRefOrGetter<T[]>,
  options: UseRoomMembershipFilterOptions
) {
  const activeFilter = ref<RoomMembershipFilter>('all')

  const filteredRooms = computed(() => {
    const rooms = toValue(sourceRooms)

    if (activeFilter.value === 'joined') {
      return rooms.filter((room) => room.membership === 'join')
    }

    if (activeFilter.value === 'created') {
      const userId = options.currentUserId
      if (!userId) return []
      return rooms.filter((room) => room.creator === userId)
    }

    return rooms
  })

  return {
    activeFilter,
    filteredRooms
  }
}
