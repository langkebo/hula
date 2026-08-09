import { JoinRule, type Room } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomSummary as SynapseRoomSummary } from '../../extensions/SynapseRoomSummaryService'
import matrixClientService from '../../MatrixClientService'
import { MatrixRoomSummaryAggregateService } from '../SummaryService'

const synapseGetRoomSummaryMock = vi.fn()
vi.mock('../../extensions/SynapseRoomSummaryService', () => ({
  synapseRoomSummaryService: {
    getRoomSummary: (...args: unknown[]) => synapseGetRoomSummaryMock(...args)
  }
}))

const makeRoom = (overrides: Partial<Room> = {}): Room =>
  ({
    roomId: '!r:e',
    name: 'Room',
    topic: 'topic',
    getMxcAvatarUrl: () => 'mxc://e/a',
    getJoinedMembers: () => [{}, {}, {}],
    getJoinRule: () => JoinRule.Invite,
    getCanonicalAlias: () => '#alias:e',
    currentState: {
      getStateEvents: vi.fn((type: string) => {
        if (type === 'm.room.create') {
          return {
            getContent: () => ({ creator: '@owner:e' }),
            getSender: () => '@owner:e',
            getTs: () => 1000
          }
        }
        return null
      })
    },
    ...overrides
  }) as unknown as Room

describe('MatrixRoomSummaryAggregateService', () => {
  let service: InstanceType<typeof MatrixRoomSummaryAggregateService>

  beforeEach(() => {
    service = new MatrixRoomSummaryAggregateService()
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    synapseGetRoomSummaryMock.mockReset()
  })

  describe('toLocalRoomSummary', () => {
    it('maps Room fields 1:1 with joinRule normalization and isPublic derivation', () => {
      const room = makeRoom({ getJoinRule: () => JoinRule.Public })
      const s = service.toLocalRoomSummary(room)
      expect(s).toEqual({
        roomId: '!r:e',
        name: 'Room',
        topic: 'topic',
        avatarUrl: 'mxc://e/a',
        memberCount: 3,
        joinedCount: 3,
        ownerId: '@owner:e',
        joinRule: 'public',
        canonicalAlias: '#alias:e',
        createdTs: 1000,
        isPublic: true
      })
    })

    it('normalizeJoinRule returns null for unknown join rules', () => {
      const room = makeRoom({ getJoinRule: () => JoinRule.Restricted })
      expect(service.toLocalRoomSummary(room).joinRule).toBeNull()
    })

    it('falls back to create-event sender when creator field is missing', () => {
      const room = makeRoom({
        currentState: {
          getStateEvents: vi.fn(() => ({
            getContent: () => ({}),
            getSender: () => '@fallback:e',
            getTs: () => 2000
          }))
        } as unknown as Room['currentState']
      })
      expect(service.toLocalRoomSummary(room).ownerId).toBe('@fallback:e')
    })

    it('returns null ownerId/createdTs when create event is missing', () => {
      const room = makeRoom({
        currentState: { getStateEvents: vi.fn(() => null) } as unknown as Room['currentState']
      })
      const s = service.toLocalRoomSummary(room)
      expect(s.ownerId).toBeNull()
      expect(s.createdTs).toBeNull()
    })

    it('topic falls back to null when Room has no topic', () => {
      const room = makeRoom({ topic: undefined })
      expect(service.toLocalRoomSummary(room).topic).toBeNull()
    })
  })

  describe('toServerRoomSummary', () => {
    it('prefers server-provided fields, falls back to local Room for owner/createdTs', () => {
      const room = makeRoom()
      const summary: SynapseRoomSummary = {
        room_id: '!r:e',
        name: 'Server Name',
        topic: undefined,
        avatar_url: undefined,
        member_count: 7,
        joined_member_count: 5,
        heroes: [
          {
            user_id: '@a:e',
            membership: 'join',
            is_hero: true
          }
        ],
        canonical_alias: '#s:e',
        join_rule: 'public',
        stats: {
          room_id: '!r:e',
          total_events: 0,
          total_messages: 0,
          total_media: 0,
          storage_size: 0
        }
      }
      const s = service.toServerRoomSummary(summary, room)
      expect(s.roomId).toBe('!r:e')
      expect(s.name).toBe('Server Name')
      expect(s.memberCount).toBe(7)
      expect(s.joinedCount).toBe(5)
      expect(s.ownerId).toBe('@owner:e')
      expect(s.createdTs).toBe(1000)
      expect(s.isPublic).toBe(true)
    })

    it('falls back to heroes.length when member_count is missing', () => {
      const summary: SynapseRoomSummary = {
        room_id: '!r',
        name: undefined,
        topic: undefined,
        avatar_url: undefined,
        heroes: [
          { user_id: '@a:e', membership: 'join', is_hero: true },
          { user_id: '@b:e', membership: 'join', is_hero: true }
        ],
        canonical_alias: undefined,
        stats: {
          room_id: '!r',
          total_events: 0,
          total_messages: 0,
          total_media: 0,
          storage_size: 0
        }
      }
      const s = service.toServerRoomSummary(summary, null)
      expect(s.memberCount).toBe(2)
      expect(s.joinedCount).toBe(2)
      expect(s.ownerId).toBeNull()
    })

    it('falls back to room.getJoinRule when summary join_rule is absent', () => {
      const room = makeRoom({ getJoinRule: () => JoinRule.Knock })
      const summary: SynapseRoomSummary = {
        room_id: '!r',
        name: undefined,
        topic: undefined,
        avatar_url: undefined,
        heroes: [],
        canonical_alias: undefined,
        stats: {
          room_id: '!r',
          total_events: 0,
          total_messages: 0,
          total_media: 0,
          storage_size: 0
        }
      }
      expect(service.toServerRoomSummary(summary, room).joinRule).toBe('knock')
    })
  })

  describe('getRoomSummary', () => {
    it('throws when client is not initialized', async () => {
      await expect(service.getRoomSummary('!r')).rejects.toThrow('客户端未初始化')
    })

    it('uses server summary path when synapse returns data', async () => {
      const room = makeRoom()
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => room } as never)
      synapseGetRoomSummaryMock.mockResolvedValueOnce({
        room_id: '!r:e',
        name: 'Server',
        topic: null,
        avatar_url: null,
        heroes: [],
        canonical_alias: null,
        join_rule: 'public'
      })
      const s = await service.getRoomSummary('!r:e')
      expect(s?.name).toBe('Server')
      expect(s?.isPublic).toBe(true)
      expect(synapseGetRoomSummaryMock).toHaveBeenCalledWith('!r:e', true)
    })

    it('falls back to local Room when synapse returns null', async () => {
      const room = makeRoom()
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => room } as never)
      synapseGetRoomSummaryMock.mockResolvedValueOnce(null)
      const s = await service.getRoomSummary('!r:e')
      expect(s?.name).toBe('Room')
    })

    it('returns null when synapse returns null and room is missing', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => null } as never)
      synapseGetRoomSummaryMock.mockResolvedValueOnce(null)
      expect(await service.getRoomSummary('!r')).toBeNull()
    })

    it('re-throws synapse errors when throwOnError=true (default)', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => null } as never)
      synapseGetRoomSummaryMock.mockRejectedValueOnce(new Error('500'))
      await expect(service.getRoomSummary('!r')).rejects.toThrow('500')
    })

    it('swallows synapse errors and falls back to local Room when throwOnError=false', async () => {
      const room = makeRoom()
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => room } as never)
      synapseGetRoomSummaryMock.mockRejectedValueOnce(new Error('500'))
      const s = await service.getRoomSummary('!r', false)
      expect(s?.name).toBe('Room')
    })

    it('returns null on error fallback when room is missing and throwOnError=false', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => null } as never)
      synapseGetRoomSummaryMock.mockRejectedValueOnce(new Error('500'))
      expect(await service.getRoomSummary('!r', false)).toBeNull()
    })
  })

  describe('getRoomSummaries', () => {
    it('throws when client is not initialized', async () => {
      await expect(service.getRoomSummaries(['!r'])).rejects.toThrow('客户端未初始化')
    })

    it('returns a Map keyed by roomId with lite summaries from local Room', async () => {
      const room = makeRoom()
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: (id: string) => (id === '!r:e' ? room : null)
      } as never)
      const out = await service.getRoomSummaries(['!r:e', '!missing:e'])
      expect(out.get('!r:e')).toEqual({
        name: 'Room',
        topic: 'topic',
        avatarUrl: 'mxc://e/a',
        memberCount: 3
      })
      expect(out.has('!missing:e')).toBe(false)
    })

    it('returns an empty Map when no roomIds resolve', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => null } as never)
      expect(await service.getRoomSummaries(['!a', '!b'])).toEqual(new Map())
    })
  })
})
