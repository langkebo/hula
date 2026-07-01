import { type MatrixClient, Preset, type Room, Visibility } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn()
}))

const mockCreateRoom = vi.fn()
const mockLeaveRoom = vi.fn()
const mockSetRoomName = vi.fn()
const mockInviteUser = vi.fn()
const mockKickUser = vi.fn()

vi.mock('../MatrixRoomService', () => ({
  matrixRoomService: {
    createRoom: mockCreateRoom,
    leaveRoom: mockLeaveRoom,
    setRoomName: mockSetRoomName,
    inviteUser: mockInviteUser,
    kickUser: mockKickUser
  }
}))

const mockGetClient = vi.fn()
const mockJoinRoom = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    joinRoom: mockJoinRoom,
    getClient: mockGetClient
  },
  default: {
    joinRoom: mockJoinRoom,
    getClient: mockGetClient
  }
}))

const matrixClientService = (await import('../../MatrixClientService')).default
const { matrixGroupService } = await import('../MatrixGroupService')

describe('MatrixGroupService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create group chat with Matrix room preset options', async () => {
    mockCreateRoom.mockResolvedValueOnce({
      roomId: '!group:example.com'
    } as unknown as Room)

    const result = await matrixGroupService.createGroupChat(['@a:example.com', '@b:example.com'])

    expect(result).toEqual({ roomId: '!group:example.com' })
    expect(mockCreateRoom).toHaveBeenCalledWith({
      invite: ['@a:example.com', '@b:example.com'],
      is_direct: false,
      preset: Preset.PrivateChat,
      visibility: Visibility.Private
    })
  })

  it('should delegate room management operations to room service', async () => {
    await matrixGroupService.leaveRoom('!room:example.com')
    await matrixGroupService.updateRoomName('!room:example.com', 'New Room')
    await matrixGroupService.inviteGroupMember('!room:example.com', '@user:example.com')
    await matrixGroupService.removeGroupMember('!room:example.com', '@user:example.com')

    expect(mockLeaveRoom).toHaveBeenCalledWith('!room:example.com')
    expect(mockSetRoomName).toHaveBeenCalledWith('!room:example.com', 'New Room')
    expect(mockInviteUser).toHaveBeenCalledWith('!room:example.com', '@user:example.com')
    expect(mockKickUser).toHaveBeenCalledWith('!room:example.com', '@user:example.com')
  })

  it('should join group through client service when applying group', async () => {
    vi.mocked(matrixClientService.joinRoom).mockResolvedValueOnce({ roomId: '!target:example.com' } as unknown as Room)

    await matrixGroupService.applyGroup('!target:example.com')

    expect(matrixClientService.joinRoom).toHaveBeenCalledWith('!target:example.com')
  })

  it('should search joined rooms by trimmed keyword and room id', async () => {
    const mockClient = {
      getRooms: vi.fn(
        () =>
          [
            {
              roomId: '!alpha:example.com',
              name: 'Alpha Team',
              getMxcAvatarUrl: () => 'mxc://example.com/alpha'
            },
            {
              roomId: '!beta:example.com',
              name: 'Project Beta',
              getMxcAvatarUrl: () => undefined
            }
          ] as unknown as Room[]
      )
    } as unknown as MatrixClient

    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient)

    const byName = await matrixGroupService.searchGroup('  alpha ')
    const byRoomId = await matrixGroupService.searchGroup('BETA:EXAMPLE')

    expect(byName).toEqual([
      {
        account: '!alpha:example.com',
        name: 'Alpha Team',
        avatar: 'mxc://example.com/alpha',
        roomId: '!alpha:example.com'
      }
    ])
    expect(byRoomId).toEqual([
      {
        account: '!beta:example.com',
        name: 'Project Beta',
        avatar: undefined,
        roomId: '!beta:example.com'
      }
    ])
  })

  it('should return empty result for blank keyword or missing client', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    await expect(matrixGroupService.searchGroup('   ')).resolves.toEqual([])
    await expect(matrixGroupService.searchGroup('alpha')).resolves.toEqual([])
  })
})
