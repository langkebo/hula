import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminRooms } from '../useAdminRooms'

vi.mock('@/services/matrix', () => ({
  adminService: {
    getRooms: vi.fn().mockResolvedValue({ rooms: [] }),
    getRoomMembers: vi.fn().mockResolvedValue([]),
    getRoomState: vi.fn().mockResolvedValue(null),
    deleteRoom: vi.fn().mockResolvedValue(undefined),
    blockRoom: vi.fn().mockResolvedValue(undefined),
    shutdownRoom: vi.fn().mockResolvedValue({ kickedUsers: [], failedToKickUsers: [], localAliases: [] }),
    forceJoinRoom: vi.fn().mockResolvedValue(undefined),
    forceLeaveRoom: vi.fn().mockResolvedValue(undefined)
  }
}))

import { adminService } from '@/services/matrix'

describe('useAdminRooms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadRooms populates rooms ref', async () => {
    vi.mocked(adminService.getRooms).mockResolvedValueOnce({
      rooms: [
        {
          roomId: '!a:s',
          name: 'Alpha',
          joinedMembers: 10,
          joinedLocalMembers: 5,
          invitedMembers: 0,
          invitedLocalMembers: 0
        },
        {
          roomId: '!b:s',
          name: 'Beta',
          joinedMembers: 20,
          joinedLocalMembers: 10,
          invitedMembers: 0,
          invitedLocalMembers: 0
        }
      ]
    })
    const c = useAdminRooms()
    await c.loadRooms()
    expect(c.rooms.value).toHaveLength(2)
  })

  it('filteredRooms matches name/topic/roomId', async () => {
    vi.mocked(adminService.getRooms).mockResolvedValueOnce({
      rooms: [
        {
          roomId: '!alpha:s',
          name: 'Alpha',
          topic: 'chat',
          joinedMembers: 0,
          joinedLocalMembers: 0,
          invitedMembers: 0,
          invitedLocalMembers: 0
        },
        {
          roomId: '!beta:s',
          name: 'Beta',
          topic: 'announcements',
          joinedMembers: 0,
          joinedLocalMembers: 0,
          invitedMembers: 0,
          invitedLocalMembers: 0
        }
      ]
    })
    const c = useAdminRooms()
    await c.loadRooms()
    c.searchQuery.value = 'announce'
    expect(c.filteredRooms.value).toHaveLength(1)
    expect(c.filteredRooms.value[0].name).toBe('Beta')
  })

  it('selectRoom triggers parallel members + state loads', async () => {
    const c = useAdminRooms()
    await c.selectRoom({
      roomId: '!x:s',
      joinedMembers: 1,
      joinedLocalMembers: 1,
      invitedMembers: 0,
      invitedLocalMembers: 0
    })
    expect(adminService.getRoomMembers).toHaveBeenCalledWith('!x:s')
    expect(adminService.getRoomState).toHaveBeenCalledWith('!x:s')
  })

  it('deleteRoom clears selection if the selected room is deleted', async () => {
    const c = useAdminRooms()
    await c.selectRoom({
      roomId: '!x:s',
      joinedMembers: 1,
      joinedLocalMembers: 1,
      invitedMembers: 0,
      invitedLocalMembers: 0
    })
    await c.deleteRoom('!x:s')
    expect(adminService.deleteRoom).toHaveBeenCalledWith('!x:s', undefined)
    expect(c.selectedRoom.value).toBeNull()
  })

  it('blockRoom reloads list', async () => {
    const c = useAdminRooms()
    await c.blockRoom('!x:s', true)
    expect(adminService.blockRoom).toHaveBeenCalledWith('!x:s', true)
    expect(adminService.getRooms).toHaveBeenCalledTimes(1)
  })

  it('shutdownRoom returns kickedUsers and clears selection', async () => {
    vi.mocked(adminService.shutdownRoom).mockResolvedValueOnce({
      kickedUsers: ['@a:s'],
      failedToKickUsers: [],
      localAliases: []
    })
    const c = useAdminRooms()
    await c.selectRoom({
      roomId: '!x:s',
      joinedMembers: 1,
      joinedLocalMembers: 1,
      invitedMembers: 0,
      invitedLocalMembers: 0
    })
    const result = await c.shutdownRoom('!x:s', 'reason')
    expect(result.kickedUsers).toEqual(['@a:s'])
    expect(c.selectedRoom.value).toBeNull()
  })

  it('forceJoinRoom refreshes members only when selection matches', async () => {
    const c = useAdminRooms()
    await c.forceJoinRoom('!x:s', '@u:s')
    expect(adminService.getRoomMembers).not.toHaveBeenCalled()

    await c.selectRoom({
      roomId: '!x:s',
      joinedMembers: 1,
      joinedLocalMembers: 1,
      invitedMembers: 0,
      invitedLocalMembers: 0
    })
    vi.mocked(adminService.getRoomMembers).mockClear()
    await c.forceJoinRoom('!x:s', '@u:s')
    expect(adminService.getRoomMembers).toHaveBeenCalledTimes(1)
  })
})
