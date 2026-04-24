import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockClientService = {
  getClient: vi.fn()
}

const mockDirectMessageService = {
  getOrCreateDmRoom: vi.fn(),
  getDMRooms: vi.fn(),
  getDmForUser: vi.fn()
}

const mockFriendService = {
  sendFriendRequest: vi.fn()
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

vi.mock('../MatrixClientService', () => ({
  matrixClientService: mockClientService
}))

vi.mock('../MatrixDirectMessageService', () => ({
  matrixDirectMessageService: mockDirectMessageService
}))

vi.mock('../friends/MatrixFriendService', () => ({
  matrixFriendService: mockFriendService
}))

vi.mock('../MatrixRoomService', () => ({
  matrixRoomService: mockRoomService
}))

const { matrixContactService } = await import('../MatrixContactService')

describe('MatrixContactService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    const result = await matrixContactService.sendAddFriendRequest('@alice:example.com', 'hello')

    expect(mockFriendService.sendFriendRequest).toHaveBeenCalledWith('@alice:example.com', 'hello')
    expect(mockDirectMessageService.getDmForUser).toHaveBeenCalledWith('@alice:example.com', false)
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
    mockClientService.getClient.mockReturnValue({
      getUser: vi.fn().mockImplementation((userId: string) => (userId === '@cached:example.com' ? cachedUser : null)),
      getUserProfile: vi.fn().mockResolvedValue({
        displayname: 'Fetched User',
        avatar_url: 'mxc://fetched/avatar'
      })
    })

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
    mockClientService.getClient.mockReturnValue({
      getUser: vi.fn(() => null),
      getUserProfile: vi.fn().mockRejectedValue(new Error('not found'))
    })

    const result = await matrixContactService.getUserByIds(['@missing:example.com'])

    expect(result).toEqual([])
  })
})
