import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminRooms } from '../useAdminRooms'

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getRooms: vi.fn().mockResolvedValue({ rooms: [] }),
    getRoomMembers: vi.fn().mockResolvedValue([]),
    getRoomState: vi.fn().mockResolvedValue(null),
    deleteRoom: vi.fn().mockResolvedValue(undefined),
    blockRoom: vi.fn().mockResolvedValue(undefined),
    shutdownRoom: vi.fn().mockResolvedValue({ kickedUsers: [], failedToKickUsers: [] }),
    forceJoinRoom: vi.fn().mockResolvedValue(undefined),
    forceLeaveRoom: vi.fn().mockResolvedValue(undefined),
    purgeRoom: vi.fn().mockResolvedValue(undefined),
    getRoomBlockStatus: vi.fn().mockResolvedValue(false),
    unblockRoom: vi.fn().mockResolvedValue(undefined),
    getRoomStats: vi.fn().mockResolvedValue(null),
    getRoomListings: vi.fn().mockResolvedValue(null),
    setRoomPublicListing: vi.fn().mockResolvedValue(undefined),
    getRoomEventContext: vi.fn().mockResolvedValue(null),
    searchInRoom: vi.fn().mockResolvedValue({ results: [] }),
    getRoomForwardExtremities: vi.fn().mockResolvedValue([])
  }
}))

import { adminService } from '@/services/matrix/admin'

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
      failedToKickUsers: []
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

  it('purgeRoom calls adminService and reloads rooms', async () => {
    const c = useAdminRooms()
    await c.purgeRoom('!x:s')
    expect(adminService.purgeRoom).toHaveBeenCalledWith('!x:s')
    expect(adminService.getRooms).toHaveBeenCalled()
  })

  // ---- ADM-11: 房间治理（封禁 / 公开目录 / 事件上下文 / 房间内搜索 / 前向极值）----

  const roomInfo = {
    roomId: '!x:s',
    joinedMembers: 1,
    joinedLocalMembers: 1,
    invitedMembers: 0,
    invitedLocalMembers: 0
  }

  it('loadServerRoomStats 保存服务端房间统计', async () => {
    vi.mocked(adminService.getRoomStats).mockResolvedValueOnce({ rooms: 5 } as never)
    const c = useAdminRooms()
    await c.loadServerRoomStats()
    expect(c.serverRoomStats.value).toEqual({ rooms: 5 })
    expect(c.serverStatsLoading.value).toBe(false)
  })

  it('loadServerRoomStats 失败时抛出并复位 loading', async () => {
    vi.mocked(adminService.getRoomStats).mockRejectedValueOnce(new Error('boom'))
    const c = useAdminRooms()
    await expect(c.loadServerRoomStats()).rejects.toThrow('boom')
    expect(c.serverStatsLoading.value).toBe(false)
  })

  it('selectRoom 并行加载封禁状态、公开目录与前向极值', async () => {
    vi.mocked(adminService.getRoomBlockStatus).mockResolvedValueOnce(true)
    vi.mocked(adminService.getRoomListings).mockResolvedValueOnce({ room_id: '!x:s' })
    vi.mocked(adminService.getRoomForwardExtremities).mockResolvedValueOnce([{ event_id: '$e:s' }])
    const c = useAdminRooms()
    await c.selectRoom(roomInfo)
    expect(adminService.getRoomBlockStatus).toHaveBeenCalledWith('!x:s')
    expect(adminService.getRoomListings).toHaveBeenCalledWith('!x:s')
    expect(adminService.getRoomForwardExtremities).toHaveBeenCalledWith('!x:s')
    expect(c.roomBlockStatus.value).toBe(true)
    expect(c.roomListings.value).toEqual({ room_id: '!x:s' })
    expect(c.forwardExtremities.value).toHaveLength(1)
  })

  it('selectRoom(null) 清空治理状态', async () => {
    const c = useAdminRooms()
    await c.selectRoom(roomInfo)
    await c.selectRoom(null)
    expect(c.roomBlockStatus.value).toBeNull()
    expect(c.roomListings.value).toBeNull()
    expect(c.roomEventContext.value).toBeNull()
    expect(c.roomSearchResults.value).toEqual([])
    expect(c.forwardExtremities.value).toEqual([])
  })

  it('unblockRoom 调用服务、刷新列表并回读封禁状态', async () => {
    const c = useAdminRooms()
    await c.selectRoom(roomInfo)
    vi.mocked(adminService.getRoomBlockStatus).mockClear()
    vi.mocked(adminService.unblockRoom).mockResolvedValueOnce(undefined)
    await c.unblockRoom('!x:s')
    expect(adminService.unblockRoom).toHaveBeenCalledWith('!x:s')
    expect(adminService.getRooms).toHaveBeenCalled()
    expect(adminService.getRoomBlockStatus).toHaveBeenCalledWith('!x:s')
  })

  it('setRoomPublicListing 以 true 调用服务并在命中选中房间时回读目录', async () => {
    const c = useAdminRooms()
    await c.selectRoom(roomInfo)
    vi.mocked(adminService.getRoomListings).mockClear()
    await c.setRoomPublicListing('!x:s')
    expect(adminService.setRoomPublicListing).toHaveBeenCalledWith('!x:s', true)
    expect(adminService.getRoomListings).toHaveBeenCalledWith('!x:s')
  })

  it('loadRoomEventContext 忽略空白事件 ID 并在有效时透传房间与事件', async () => {
    const c = useAdminRooms()
    await c.selectRoom(roomInfo)
    await c.loadRoomEventContext('   ')
    expect(adminService.getRoomEventContext).not.toHaveBeenCalled()

    vi.mocked(adminService.getRoomEventContext).mockResolvedValueOnce({ events_before: [] })
    await c.loadRoomEventContext(' $e:s ')
    expect(adminService.getRoomEventContext).toHaveBeenCalledWith('!x:s', '$e:s')
    expect(c.roomEventContext.value).toEqual({ events_before: [] })
    expect(c.eventContextLoading.value).toBe(false)
  })

  it('searchInRoom 写入搜索结果并忽略空白关键词', async () => {
    const c = useAdminRooms()
    await c.selectRoom(roomInfo)
    await c.searchInRoom('  ')
    expect(adminService.searchInRoom).not.toHaveBeenCalled()

    vi.mocked(adminService.searchInRoom).mockResolvedValueOnce({
      results: [{ event_id: '$e:s', sender: '@a:s' }]
    } as never)
    await c.searchInRoom('hello')
    expect(adminService.searchInRoom).toHaveBeenCalledWith('!x:s', 'hello')
    expect(c.roomSearchResults.value).toHaveLength(1)
    expect(c.roomSearchLoading.value).toBe(false)
  })

  it('loadForwardExtremities 直接写入服务返回数组', async () => {
    const c = useAdminRooms()
    await c.selectRoom(roomInfo)
    vi.mocked(adminService.getRoomForwardExtremities).mockResolvedValueOnce([{ event_id: '$a:s' }])
    await c.loadForwardExtremities()
    expect(c.forwardExtremities.value).toEqual([{ event_id: '$a:s' }])
    expect(c.forwardExtremitiesLoading.value).toBe(false)
  })
})
