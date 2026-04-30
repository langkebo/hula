import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { synapseRustExtensionsService } from '../../SynapseRustExtensionsService'
import { matrixRoomService } from '../MatrixRoomService'

const originalFetch = globalThis.fetch

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null),
    isLoggedIn: vi.fn(() => false),
    createRoom: vi.fn(() => {
      throw new Error('客户端未初始化')
    }),
    joinRoom: vi.fn(() => {
      throw new Error('客户端未初始化')
    }),
    leaveRoom: vi.fn(() => {
      throw new Error('客户端未初始化')
    })
  }
}))

vi.mock('../../SynapseRustExtensionsService', () => ({
  synapseRustExtensionsService: {
    getRoomSummary: vi.fn()
  }
}))

describe('MatrixRoomService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
    globalThis.fetch = originalFetch
  })

  describe('getRooms', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.getRooms()).rejects.toThrow('客户端未初始化')
    })

    it('should return rooms from client', async () => {
      const rooms = [{ roomId: '!room:id' }]
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRooms: vi.fn(() => rooms)
      } as any)

      await expect(matrixRoomService.getRooms()).resolves.toBe(rooms as any)
    })
  })

  describe('getRoom', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.getRoom('!room:id')).rejects.toThrow('客户端未初始化')
    })

    it('should throw error when room is missing by default', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => null)
      } as any)

      await expect(matrixRoomService.getRoom('!missing:room')).rejects.toThrow('房间不存在: !missing:room')
    })

    it('should return null when room is missing and throwOnError is false', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => null)
      } as any)

      await expect(matrixRoomService.getRoom('!missing:room', false)).resolves.toBeNull()
    })
  })

  describe('getServerDomain', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.getServerDomain()).rejects.toThrow('客户端未初始化')
    })

    it('should return homeserver domain from client', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getDomain: vi.fn(() => 'example.com')
      } as any)

      await expect(matrixRoomService.getServerDomain()).resolves.toBe('example.com')
    })

    it('should fallback to matrix.org when domain is empty', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getDomain: vi.fn(() => '')
      } as any)

      await expect(matrixRoomService.getServerDomain()).resolves.toBe('matrix.org')
    })
  })

  describe('createRoom', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.createRoom({})).rejects.toThrow('客户端未初始化')
    })

    it('should delegate room creation to client service', async () => {
      const createdRoom = { roomId: '!created:room' }
      vi.mocked(matrixClientService.createRoom).mockResolvedValue(createdRoom as any)

      await expect(matrixRoomService.createRoom({ name: 'Room' })).resolves.toBe(createdRoom as any)
      expect(matrixClientService.createRoom).toHaveBeenCalledWith({ name: 'Room' })
    })
  })

  describe('joinRoom', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.joinRoom('!room:id')).rejects.toThrow('客户端未初始化')
    })

    it('should delegate join room to client service', async () => {
      const joinedRoom = { roomId: '!joined:room' }
      vi.mocked(matrixClientService.joinRoom).mockResolvedValue(joinedRoom as any)

      await expect(matrixRoomService.joinRoom('!room:id')).resolves.toBe(joinedRoom as any)
      expect(matrixClientService.joinRoom).toHaveBeenCalledWith('!room:id')
    })
  })

  describe('leaveRoom', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.leaveRoom('!room:id')).rejects.toThrow('客户端未初始化')
    })

    it('should delegate leave room to client service', async () => {
      vi.mocked(matrixClientService.leaveRoom).mockResolvedValue(undefined)

      await expect(matrixRoomService.leaveRoom('!room:id')).resolves.toBeUndefined()
      expect(matrixClientService.leaveRoom).toHaveBeenCalledWith('!room:id')
    })
  })

  describe('createDirectRoom', () => {
    it('should create a trusted private direct room', async () => {
      const createRoom = vi.fn().mockResolvedValue({ room_id: '!dm:id' })
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        createRoom
      } as any)

      await expect(matrixRoomService.createDirectRoom('@user:matrix.org')).resolves.toBe('!dm:id')
      expect(createRoom).toHaveBeenCalledWith({
        is_direct: true,
        invite: ['@user:matrix.org'],
        preset: 'trusted_private_chat',
        visibility: 'private'
      })
    })
  })

  describe('getMembers', () => {
    it('should return joined members from room', async () => {
      const members = [{ userId: '@a:example.com' }, { userId: '@b:example.com' }]
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => ({
          getJoinedMembers: vi.fn(() => members)
        }))
      } as any)

      await expect(matrixRoomService.getMembers('!room:id')).resolves.toBe(members as any)
    })
  })

  describe('inviteUser', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.inviteUser('!room:id', '@user:matrix.org')).rejects.toThrow('客户端未初始化')
    })

    it('should invite user with client api', async () => {
      const invite = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ invite } as any)

      await expect(matrixRoomService.inviteUser('!room:id', '@user:matrix.org')).resolves.toBeUndefined()
      expect(invite).toHaveBeenCalledWith('!room:id', '@user:matrix.org')
    })
  })

  describe('kickUser', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.kickUser('!room:id', '@user:matrix.org')).rejects.toThrow('客户端未初始化')
    })

    it('should kick user with optional reason', async () => {
      const kick = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ kick } as any)

      await expect(matrixRoomService.kickUser('!room:id', '@user:matrix.org', 'spam')).resolves.toBeUndefined()
      expect(kick).toHaveBeenCalledWith('!room:id', '@user:matrix.org', 'spam')
    })
  })

  describe('banUser', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.banUser('!room:id', '@user:matrix.org')).rejects.toThrow('客户端未初始化')
    })

    it('should ban user with optional reason', async () => {
      const ban = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ ban } as any)

      await expect(matrixRoomService.banUser('!room:id', '@user:matrix.org', 'abuse')).resolves.toBeUndefined()
      expect(ban).toHaveBeenCalledWith('!room:id', '@user:matrix.org', 'abuse')
    })
  })

  describe('unbanUser', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.unbanUser('!room:id', '@user:matrix.org')).rejects.toThrow('客户端未初始化')
    })

    it('should unban user with client api', async () => {
      const unban = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ unban } as any)

      await expect(matrixRoomService.unbanUser('!room:id', '@user:matrix.org')).resolves.toBeUndefined()
      expect(unban).toHaveBeenCalledWith('!room:id', '@user:matrix.org')
    })
  })

  describe('setRoomName', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.setRoomName('!room:id', 'New Room Name')).rejects.toThrow('客户端未初始化')
    })

    it('should set room name with client api', async () => {
      const setRoomName = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ setRoomName } as any)

      await expect(matrixRoomService.setRoomName('!room:id', 'New Room Name')).resolves.toBeUndefined()
      expect(setRoomName).toHaveBeenCalledWith('!room:id', 'New Room Name')
    })
  })

  describe('setRoomTopic', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.setRoomTopic('!room:id', 'New Topic')).rejects.toThrow('客户端未初始化')
    })

    it('should set room topic with client api', async () => {
      const setRoomTopic = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ setRoomTopic } as any)

      await expect(matrixRoomService.setRoomTopic('!room:id', 'New Topic')).resolves.toBeUndefined()
      expect(setRoomTopic).toHaveBeenCalledWith('!room:id', 'New Topic')
    })
  })

  describe('setRoomAvatar', () => {
    it('should set room avatar state event', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ sendStateEvent } as any)

      await expect(matrixRoomService.setRoomAvatar('!room:id', 'mxc://avatar')).resolves.toBeUndefined()
      expect(sendStateEvent).toHaveBeenCalledWith('!room:id', 'm.room.avatar', { url: 'mxc://avatar' }, '')
    })
  })

  describe('getRoomState', () => {
    it('should return current room state events', async () => {
      const stateEvents = [{ type: 'm.room.name' }]
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => ({
          currentState: {
            getStateEvents: vi.fn(() => stateEvents)
          }
        }))
      } as any)

      await expect(matrixRoomService.getRoomState('!room:id')).resolves.toBe(stateEvents as any)
    })

    it('should throw when room state room is missing', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => null)
      } as any)

      await expect(matrixRoomService.getRoomState('!room:id')).rejects.toThrow('房间不存在: !room:id')
    })
  })

  describe('setPushRule', () => {
    it('should delete push rule when enabling notifications', async () => {
      const deletePushRule = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ deletePushRule } as any)

      await expect(matrixRoomService.setPushRule('!room:id', true)).resolves.toBeUndefined()
      expect(deletePushRule).toHaveBeenCalledWith('global', 'override', '!room:id')
    })

    it('should add push rule when disabling notifications', async () => {
      const addPushRule = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ addPushRule } as any)

      await expect(matrixRoomService.setPushRule('!room:id', false)).resolves.toBeUndefined()
      expect(addPushRule).toHaveBeenCalledWith('global', 'override', '!room:id', {
        conditions: [
          {
            kind: 'event_match',
            key: 'room_id',
            pattern: '!room:id'
          }
        ],
        actions: []
      })
    })
  })

  describe('getDirectRooms', () => {
    it('should parse direct room account data', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getAccountData: vi.fn(() => ({
          getContent: vi.fn(() => ({
            '@alice:example.com': ['!dm1:id', '!dm2:id'],
            '@bob:example.com': ['!dm3:id', 1],
            '@charlie:example.com': 'invalid'
          }))
        }))
      } as any)

      await expect(matrixRoomService.getDirectRooms()).resolves.toEqual(
        new Map([
          ['@alice:example.com', ['!dm1:id', '!dm2:id']],
          ['@bob:example.com', ['!dm3:id']]
        ])
      )
    })

    it('should return empty map when account data is missing', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getAccountData: vi.fn(() => null)
      } as any)

      await expect(matrixRoomService.getDirectRooms()).resolves.toEqual(new Map())
    })

    it('should throw when reading direct rooms fails by default', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getAccountData: vi.fn(() => {
          throw new Error('account data failed')
        })
      } as any)

      await expect(matrixRoomService.getDirectRooms()).rejects.toThrow('account data failed')
    })

    it('should return empty map when reading direct rooms fails and throwOnError is false', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getAccountData: vi.fn(() => {
          throw new Error('account data failed')
        })
      } as any)

      await expect(matrixRoomService.getDirectRooms(false)).resolves.toEqual(new Map())
    })
  })

  describe('setDirectRoom', () => {
    it('should append new direct room and persist account data', async () => {
      const setAccountData = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getAccountData: vi.fn(() => ({
          getContent: vi.fn(() => ({
            '@alice:example.com': ['!existing:id']
          }))
        })),
        setAccountData
      } as any)

      await expect(matrixRoomService.setDirectRoom('@alice:example.com', '!new:id')).resolves.toBeUndefined()
      expect(setAccountData).toHaveBeenCalledWith('m.direct', {
        '@alice:example.com': ['!existing:id', '!new:id']
      })
    })

    it('should skip persisting when room already exists in direct mapping', async () => {
      const setAccountData = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getAccountData: vi.fn(() => ({
          getContent: vi.fn(() => ({
            '@alice:example.com': ['!existing:id']
          }))
        })),
        setAccountData
      } as any)

      await expect(matrixRoomService.setDirectRoom('@alice:example.com', '!existing:id')).resolves.toBeUndefined()
      expect(setAccountData).not.toHaveBeenCalled()
    })
  })

  describe('setMemberDisplayName', () => {
    it('should merge membership state and send updated display name', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getUserId: vi.fn(() => '@self:example.com'),
        getRoom: vi.fn(() => ({
          currentState: {
            getStateEvents: vi.fn(() => ({
              getContent: vi.fn(() => ({
                avatar_url: 'mxc://old-avatar'
              }))
            }))
          }
        })),
        sendStateEvent
      } as any)

      await expect(matrixRoomService.setMemberDisplayName('!room:id', 'New Name')).resolves.toBeUndefined()
      expect(sendStateEvent).toHaveBeenCalledWith(
        '!room:id',
        'm.room.member',
        {
          avatar_url: 'mxc://old-avatar',
          displayname: 'New Name',
          membership: 'join'
        },
        '@self:example.com'
      )
    })
  })

  describe('getMemberDisplayName', () => {
    it('should prefer raw display name', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => ({
          getMember: vi.fn(() => ({
            rawDisplayName: 'Raw Name',
            name: 'Fallback Name'
          }))
        }))
      } as any)

      await expect(matrixRoomService.getMemberDisplayName('!room:id', '@user:id')).resolves.toBe('Raw Name')
    })

    it('should return null when room is missing', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => null)
      } as any)

      await expect(matrixRoomService.getMemberDisplayName('!room:id', '@user:id')).resolves.toBeNull()
    })
  })

  describe('setMemberPowerLevel', () => {
    it('should set user power level with client api', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ setUserPowerLevel } as any)

      await expect(matrixRoomService.setMemberPowerLevel('!room:id', '@user:id', 50)).resolves.toBeUndefined()
      expect(setUserPowerLevel).toHaveBeenCalledWith('@user:id', '!room:id', 50)
    })

    it('should delegate setMemberAsAdmin and removeMemberAsAdmin to setMemberPowerLevel', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ setUserPowerLevel } as any)

      await matrixRoomService.setMemberAsAdmin('!room:id', '@user:id')
      await matrixRoomService.removeMemberAsAdmin('!room:id', '@user:id')

      expect(setUserPowerLevel).toHaveBeenNthCalledWith(1, '@user:id', '!room:id', 100)
      expect(setUserPowerLevel).toHaveBeenNthCalledWith(2, '@user:id', '!room:id', 0)
    })
  })

  describe('translateText', () => {
    it('should return translated text when request succeeds', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({} as any)
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([[['你好']]])
      } as any)

      await expect(matrixRoomService.translateText('hello')).resolves.toBe('你好')
    })

    it('should return original text when translation response has no data', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({} as any)
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([])
      } as any)

      await expect(matrixRoomService.translateText('hello')).resolves.toBe('hello')
    })

    it('should throw when translation request fails by default', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({} as any)
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      } as any)

      await expect(matrixRoomService.translateText('hello')).rejects.toThrow('翻译请求失败: 500')
    })

    it('should return original text when translation fails and throwOnError is false', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({} as any)
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network failed'))

      await expect(matrixRoomService.translateText('hello', undefined, false)).resolves.toBe('hello')
    })
  })

  describe('getRoomSummary', () => {
    it('should use server summary by default', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => null)
      } as any)
      vi.mocked(synapseRustExtensionsService.getRoomSummary).mockResolvedValue({
        room_id: '!room:id',
        name: 'Server Room',
        topic: 'Server Topic',
        avatar_url: 'mxc://server/avatar',
        canonical_alias: '#server:example.com',
        join_rule: 'public',
        member_count: 42,
        joined_member_count: 40,
        heroes: [],
        stats: {
          room_id: '!room:id',
          total_events: 0,
          total_messages: 0,
          total_media: 0,
          storage_size: 0
        }
      })

      await expect(matrixRoomService.getRoomSummary('!room:id')).resolves.toMatchObject({
        roomId: '!room:id',
        name: 'Server Room',
        topic: 'Server Topic',
        avatarUrl: 'mxc://server/avatar',
        memberCount: 42,
        joinedCount: 40,
        canonicalAlias: '#server:example.com',
        isPublic: true
      })
      expect(synapseRustExtensionsService.getRoomSummary).toHaveBeenCalledWith('!room:id', true)
    })

    it('should fallback to local room summary when throwOnError is false', async () => {
      vi.mocked(synapseRustExtensionsService.getRoomSummary).mockRejectedValue(new Error('summary failed'))
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => ({
          roomId: '!room:id',
          name: 'Local Room',
          topic: 'Local Topic',
          getJoinedMembers: vi.fn(() => [{}, {}]),
          getMxcAvatarUrl: vi.fn(() => 'mxc://local/avatar'),
          getCanonicalAlias: vi.fn(() => '#local:example.com'),
          getJoinRule: vi.fn(() => 'invite')
        }))
      } as any)

      await expect(matrixRoomService.getRoomSummary('!room:id', false)).resolves.toMatchObject({
        roomId: '!room:id',
        name: 'Local Room',
        topic: 'Local Topic',
        avatarUrl: 'mxc://local/avatar',
        memberCount: 2,
        joinedCount: 2,
        canonicalAlias: '#local:example.com',
        isPublic: false
      })
    })

    it('should fallback to local summary when server summary is empty', async () => {
      vi.mocked(synapseRustExtensionsService.getRoomSummary).mockResolvedValue(null)
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => ({
          roomId: '!room:id',
          name: 'Fallback Room',
          topic: 'Fallback Topic',
          getJoinedMembers: vi.fn(() => [{}, {}, {}]),
          getMxcAvatarUrl: vi.fn(() => null),
          getCanonicalAlias: vi.fn(() => null),
          getJoinRule: vi.fn(() => 'public')
        }))
      } as any)

      await expect(matrixRoomService.getRoomSummary('!room:id')).resolves.toMatchObject({
        roomId: '!room:id',
        name: 'Fallback Room',
        topic: 'Fallback Topic',
        avatarUrl: null,
        memberCount: 3,
        joinedCount: 3,
        canonicalAlias: null,
        isPublic: true
      })
    })

    it('should throw summary error when throwOnError is true', async () => {
      vi.mocked(synapseRustExtensionsService.getRoomSummary).mockRejectedValue(new Error('summary failed'))
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => null)
      } as any)

      await expect(matrixRoomService.getRoomSummary('!room:id', true)).rejects.toThrow('summary failed')
    })
  })

  describe('getRoomSummaries', () => {
    it('should build room summaries from local rooms', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn((roomId: string) => {
          if (roomId === '!room:a') {
            return {
              name: 'Room A',
              topic: 'Topic A',
              getMxcAvatarUrl: vi.fn(() => 'mxc://avatar/a'),
              getJoinedMembers: vi.fn(() => [{}, {}])
            }
          }

          if (roomId === '!room:b') {
            return {
              name: 'Room B',
              topic: undefined,
              getMxcAvatarUrl: vi.fn(() => null),
              getJoinedMembers: vi.fn(() => [{}])
            }
          }

          return null
        })
      } as any)

      await expect(matrixRoomService.getRoomSummaries(['!room:a', '!room:b', '!room:missing'])).resolves.toEqual(
        new Map([
          [
            '!room:a',
            {
              name: 'Room A',
              topic: 'Topic A',
              avatarUrl: 'mxc://avatar/a',
              memberCount: 2
            }
          ],
          [
            '!room:b',
            {
              name: 'Room B',
              topic: null,
              avatarUrl: null,
              memberCount: 1
            }
          ]
        ])
      )
    })
  })

  describe('unread counters', () => {
    it('should validate room existence before incrementing or clearing unread', async () => {
      const getRoom = vi.fn().mockReturnValue({ roomId: '!room:id' })
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom } as any)

      await matrixRoomService.incrementUnread('!room:id', true)
      await matrixRoomService.clearUnread('!room:id')

      expect(getRoom).toHaveBeenNthCalledWith(1, '!room:id')
      expect(getRoom).toHaveBeenNthCalledWith(2, '!room:id')
    })
  })
})
