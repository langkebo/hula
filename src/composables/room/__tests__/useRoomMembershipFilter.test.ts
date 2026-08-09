import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useRoomMembershipFilter } from '../useRoomMembershipFilter'

interface TestRoom {
  roomId: string
  name: string
  membership: 'join' | 'leave' | 'invite' | 'ban'
  creator?: string
}

const currentUserId = '@me:matrix.test'

const sampleRooms: TestRoom[] = [
  { roomId: '!room1:matrix.test', name: 'Joined Room', membership: 'join', creator: '@other:matrix.test' },
  { roomId: '!room2:matrix.test', name: 'Created Room', membership: 'join', creator: currentUserId },
  { roomId: '!room3:matrix.test', name: 'Invited Room', membership: 'invite', creator: '@other:matrix.test' },
  { roomId: '!room4:matrix.test', name: 'Left Room', membership: 'leave', creator: '@other:matrix.test' }
]

describe('useRoomMembershipFilter', () => {
  it('returns all rooms when filter is "all"', () => {
    const source = ref(sampleRooms)
    const { activeFilter, filteredRooms } = useRoomMembershipFilter(source, { currentUserId })
    activeFilter.value = 'all'
    expect(filteredRooms.value).toHaveLength(4)
  })

  it('filters to joined rooms when filter is "joined"', () => {
    const source = ref(sampleRooms)
    const { activeFilter, filteredRooms } = useRoomMembershipFilter(source, { currentUserId })
    activeFilter.value = 'joined'
    const roomIds = filteredRooms.value.map((r) => r.roomId)
    expect(roomIds).toContain('!room1:matrix.test')
    expect(roomIds).toContain('!room2:matrix.test')
    expect(roomIds).not.toContain('!room3:matrix.test')
    expect(roomIds).not.toContain('!room4:matrix.test')
  })

  it('filters to created rooms when filter is "created"', () => {
    const source = ref(sampleRooms)
    const { activeFilter, filteredRooms } = useRoomMembershipFilter(source, { currentUserId })
    activeFilter.value = 'created'
    const roomIds = filteredRooms.value.map((r) => r.roomId)
    expect(roomIds).toEqual(['!room2:matrix.test'])
  })

  it('defaults to "all" filter', () => {
    const source = ref(sampleRooms)
    const { activeFilter, filteredRooms } = useRoomMembershipFilter(source, { currentUserId })
    expect(activeFilter.value).toBe('all')
    expect(filteredRooms.value).toHaveLength(4)
  })

  it('reacts to source changes', () => {
    const source = ref(sampleRooms)
    const { activeFilter, filteredRooms } = useRoomMembershipFilter(source, { currentUserId })
    activeFilter.value = 'joined'
    expect(filteredRooms.value).toHaveLength(2)
    source.value = [sampleRooms[0]]
    expect(filteredRooms.value).toHaveLength(1)
  })

  it('rooms without creator field are not included in "created" filter', () => {
    const roomsWithoutCreator: TestRoom[] = [{ roomId: '!room5:matrix.test', name: 'No Creator', membership: 'join' }]
    const source = ref(roomsWithoutCreator)
    const { activeFilter, filteredRooms } = useRoomMembershipFilter(source, { currentUserId })
    activeFilter.value = 'created'
    expect(filteredRooms.value).toHaveLength(0)
  })
})
