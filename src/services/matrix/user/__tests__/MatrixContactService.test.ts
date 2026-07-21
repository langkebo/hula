import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'
import matrixClientService from '../../MatrixClientService'

const mockDirectMessageService = {
  getOrCreateDmRoom: vi.fn(),
  getDMRooms: vi.fn(),
  getDmForUser: vi.fn()
}

const mockFriendService = {
  sendFriendRequest: vi.fn()
}

const mockSynapseExtensionsService = {
  searchFriends: vi.fn()
}

const mockRoomService = {
  inviteUser: vi.fn(),
  kickUser: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  getMembers: vi.fn(),
  getRoomState: vi.fn()
}

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../../room/MatrixDirectMessageService', () => ({
  matrixDirectMessageService: mockDirectMessageService
}))

vi.mock('../../friends/MatrixFriendService', () => ({
  matrixFriendService: mockFriendService
}))

vi.mock('../../SynapseRustExtensionsService', () => ({
  synapseRustExtensionsService: mockSynapseExtensionsService
}))

vi.mock('../../room/ActionFacade', () => ({
  matrixRoomActionFacade: mockRoomService
}))

vi.mock('../../room/QueryFacade', () => ({
  matrixRoomQueryFacade: mockRoomService
}))

vi.mock('../../room/ReadFacade', () => ({
  matrixRoomReadFacade: mockRoomService
}))

const { matrixContactService } = await import('../MatrixContactService')

describe('MatrixContactService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    vi.spyOn(matrixClientService, 'getUserId').mockReturnValue('@testuser:test.com')
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('getOrCreateDirectChat delegates to direct message service', async () => {
    mockDirectMessageService.getOrCreateDmRoom.mockResolvedValueOnce('!dm:example.com')

    const result = await matrixContactService.getOrCreateDirectChat('@alice:example.com')

    expect(mockDirectMessageService.getOrCreateDmRoom).toHaveBeenCalledWith('@alice:example.com')
    expect(result).toEqual({ roomId: '!dm:example.com' })
  })

  it('searchUsers returns an empty list when matrix client is not initialized', async () => {
    mockSynapseExtensionsService.searchFriends.mockResolvedValue([])

    await expect(matrixContactService.searchUsers('alice')).resolves.toEqual([])
    await expect(matrixContactService.searchFriend('alice')).resolves.toEqual([])
  })

  it('searchUsers prefers friends/search exact mode and returns mapped profile', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getUserId: vi.fn(() => '@self:matrix.test')
    } as unknown as MatrixClient)
    mockSynapseExtensionsService.searchFriends
      .mockResolvedValueOnce([
        {
          user_id: '@ljf1:matrix.test',
          username: 'ljf1',
          displayname: 'LJF One',
          avatar_url: 'mxc://avatar/1'
        }
      ])
      .mockResolvedValueOnce([])

    const result = await matrixContactService.searchUsers('ljf1')

    expect(mockSynapseExtensionsService.searchFriends).toHaveBeenCalledWith('ljf1', {
      limit: 10,
      mode: 'exact'
    })
    expect(result).toEqual([
      {
        userId: '@ljf1:matrix.test',
        displayName: 'LJF One',
        avatarUrl: 'mxc://avatar/1'
      }
    ])
  })

  it('getDMRooms maps direct message room ids', async () => {
    mockDirectMessageService.getDMRooms.mockResolvedValueOnce([
      { roomId: '!dm1:example.com' },
      { roomId: '!dm2:example.com' }
    ])

    const result = await matrixContactService.getDMRooms()

    expect(mockDirectMessageService.getDMRooms).toHaveBeenCalledWith(false)
    expect(result).toEqual(['!dm1:example.com', '!dm2:example.com'])
  })

  it('sendAddFriendRequest delegates to friend service without creating a dm', async () => {
    mockFriendService.sendFriendRequest.mockResolvedValueOnce(undefined)
    mockDirectMessageService.getDmForUser.mockResolvedValueOnce(null)
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getUserId: vi.fn(() => '@self:matrix.test')
    } as unknown as MatrixClient)

    const result = await matrixContactService.sendAddFriendRequest('alice', 'hello')

    expect(mockFriendService.sendFriendRequest).toHaveBeenCalledWith('@alice:test.com', 'hello')
    expect(mockDirectMessageService.getDmForUser).toHaveBeenCalledWith('@alice:test.com', false)
    expect(mockDirectMessageService.getOrCreateDmRoom).not.toHaveBeenCalled()
    expect(result).toEqual({ roomId: '' })
  })

  it('inviteUser delegates room membership changes to room service', async () => {
    mockRoomService.inviteUser.mockResolvedValueOnce(undefined)

    await matrixContactService.inviteUser('!room:example.com', '@alice:example.com')

    expect(mockRoomService.inviteUser).toHaveBeenCalledWith('!room:example.com', '@alice:example.com')
  })

  it('getRoomState filters delegated room state by event type', async () => {
    const memberEvent = { getType: vi.fn(() => 'm.room.member') }
    const topicEvent = { getType: vi.fn(() => 'm.room.topic') }
    mockRoomService.getRoomState.mockResolvedValueOnce([memberEvent, topicEvent])

    const result = await matrixContactService.getRoomState('!room:example.com', 'm.room.member')

    expect(mockRoomService.getRoomState).toHaveBeenCalledWith('!room:example.com')
    expect(result).toEqual([memberEvent])
  })

  it('getUserByIds returns cached users first and falls back to profile lookup', async () => {
    const cachedUser = {
      userId: '@cached:example.com',
      displayName: 'Cached User',
      avatarUrl: 'mxc://cached/avatar'
    }
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getUser: vi.fn().mockImplementation((userId: string) => (userId === '@cached:example.com' ? cachedUser : null)),
      getUserProfile: vi.fn().mockResolvedValue({
        displayname: 'Fetched User',
        avatar_url: 'mxc://fetched/avatar'
      })
    } as unknown as MatrixClient)

    const result = await matrixContactService.getUserByIds(['@cached:example.com', '@fetched:example.com'])

    expect(result).toEqual([
      {
        uid: '@cached:example.com',
        name: 'Cached User',
        avatar: 'mxc://cached/avatar',
        activeStatus: 0,
        lastOptTime: 0
      },
      {
        uid: '@fetched:example.com',
        name: 'Fetched User',
        avatar: 'mxc://fetched/avatar',
        activeStatus: 0,
        lastOptTime: 0
      }
    ])
  })

  it('getUserByIds skips users whose profile lookup fails', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getUser: vi.fn(() => null),
      getUserProfile: vi.fn().mockRejectedValue(new Error('not found'))
    } as unknown as MatrixClient)

    const result = await matrixContactService.getUserByIds(['@missing:example.com'])

    expect(result).toEqual([])
  })

  it('getUserByIds returns an empty list when matrix client is not initialized', async () => {
    await expect(matrixContactService.getUserByIds(['@missing:example.com'])).resolves.toEqual([])
  })
})
