import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const synapseGetRoomSummaryMock = vi.fn()
vi.mock('../../SynapseRustExtensionsService', () => ({
  synapseRustExtensionsService: {
    getRoomSummary: (...args: unknown[]) => synapseGetRoomSummaryMock(...args)
  }
}))

const getClientMock = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  default: { getClient: () => getClientMock() }
}))

const { MatrixRoomSummaryAggregateService } = await import('../SummaryService')

const makeRoom = (overrides: Record<string, unknown> = {}) => ({
  roomId: '!r:e',
  name: 'Room',
  topic: 'topic',
  getMxcAvatarUrl: () => 'mxc://e/a',
  getJoinedMembers: () => [{}, {}, {}],
  getJoinRule: () => 'invite',
  getCanonicalAlias: () => '#alias:e',
  currentState: {
    getStateEvents: vi.fn(() => ({
      getContent: () => ({ creator: '@owner:e' }),
      getSender: () => '@owner:e',
      getTs: () => 1000
    }))
  },
  ...overrides
})

describe('MatrixRoomSummaryAggregateService', () => {
  let service: InstanceType<typeof MatrixRoomSummaryAggregateService>

  beforeEach(() => {
    service = new MatrixRoomSummaryAggregateService()
    getClientMock.mockReset()
    synapseGetRoomSummaryMock.mockReset()
  })

  describe('toLocalRoomSummary', () => {
    it('maps Room fields 1:1 with joinRule normalization and isPublic derivation', () => {
      const room = makeRoom({ getJoinRule: () => 'public' })
      const s = service.toLocalRoomSummary(room as any)
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
      const room = makeRoom({ getJoinRule: () => 'restricted' })
      expect(service.toLocalRoomSummary(room as any).joinRule).toBeNull()
    })

    it('falls back to create-event sender when creator field is missing', () => {
      const room = makeRoom({
        currentState: {
          getStateEvents: () => ({
            getContent: () => ({}),
            getSender: () => '@fallback:e',
            getTs: () => 2000
          })
        }
      })
      expect(service.toLocalRoomSummary(room as any).ownerId).toBe('@fallback:e')
    })

    it('returns null ownerId/createdTs when create event is missing', () => {
      const room = makeRoom({
        currentState: { getStateEvents: () => null }
      })
      const s = service.toLocalRoomSummary(room as any)
      expect(s.ownerId).toBeNull()
      expect(s.createdTs).toBeNull()
    })

    it('topic falls back to null when Room has no topic', () => {
      const room = makeRoom({ topic: undefined })
      expect(service.toLocalRoomSummary(room as any).topic).toBeNull()
    })
  })

  describe('toServerRoomSummary', () => {
    it('prefers server-provided fields, falls back to local Room for owner/createdTs', () => {
      const room = makeRoom()
      const summary = {
        room_id: '!r:e',
        name: 'Server Name',
        topic: null,
        avatar_url: null,
        member_count: 7,
        joined_member_count: 5,
        heroes: ['@a:e'],
        canonical_alias: '#s:e',
        join_rule: 'public'
      }
      const s = service.toServerRoomSummary(summary as any, room as any)
      expect(s.roomId).toBe('!r:e')
      expect(s.name).toBe('Server Name')
      expect(s.memberCount).toBe(7)
      expect(s.joinedCount).toBe(5)
      expect(s.ownerId).toBe('@owner:e')
      expect(s.createdTs).toBe(1000)
      expect(s.isPublic).toBe(true)
    })

    it('falls back to heroes.length when member_count is missing', () => {
      const summary = {
        room_id: '!r',
        name: null,
        topic: null,
        avatar_url: null,
        heroes: ['@a:e', '@b:e'],
        canonical_alias: null
      }
      const s = service.toServerRoomSummary(summary as any, null)
      expect(s.memberCount).toBe(2)
      expect(s.joinedCount).toBe(2)
      expect(s.ownerId).toBeNull()
    })

    it('falls back to room.getJoinRule when summary join_rule is absent', () => {
      const room = makeRoom({ getJoinRule: () => 'knock' })
      const summary = { room_id: '!r', name: null, topic: null, avatar_url: null, heroes: [], canonical_alias: null }
      expect(service.toServerRoomSummary(summary as any, room as any).joinRule).toBe('knock')
    })
  })

  describe('getRoomSummary', () => {
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.getRoomSummary('!r')).rejects.toThrow('客户端未初始化')
    })

    it('uses server summary path when synapse returns data', async () => {
      const room = makeRoom()
      getClientMock.mockReturnValue({ getRoom: () => room })
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
      getClientMock.mockReturnValue({ getRoom: () => room })
      synapseGetRoomSummaryMock.mockResolvedValueOnce(null)
      const s = await service.getRoomSummary('!r:e')
      expect(s?.name).toBe('Room')
    })

    it('returns null when synapse returns null and room is missing', async () => {
      getClientMock.mockReturnValue({ getRoom: () => null })
      synapseGetRoomSummaryMock.mockResolvedValueOnce(null)
      expect(await service.getRoomSummary('!r')).toBeNull()
    })

    it('re-throws synapse errors when throwOnError=true (default)', async () => {
      getClientMock.mockReturnValue({ getRoom: () => null })
      synapseGetRoomSummaryMock.mockRejectedValueOnce(new Error('500'))
      await expect(service.getRoomSummary('!r')).rejects.toThrow('500')
    })

    it('swallows synapse errors and falls back to local Room when throwOnError=false', async () => {
      const room = makeRoom()
      getClientMock.mockReturnValue({ getRoom: () => room })
      synapseGetRoomSummaryMock.mockRejectedValueOnce(new Error('500'))
      const s = await service.getRoomSummary('!r', false)
      expect(s?.name).toBe('Room')
    })

    it('returns null on error fallback when room is missing and throwOnError=false', async () => {
      getClientMock.mockReturnValue({ getRoom: () => null })
      synapseGetRoomSummaryMock.mockRejectedValueOnce(new Error('500'))
      expect(await service.getRoomSummary('!r', false)).toBeNull()
    })
  })

  describe('getRoomSummaries', () => {
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.getRoomSummaries(['!r'])).rejects.toThrow('客户端未初始化')
    })

    it('returns a Map keyed by roomId with lite summaries from local Room', async () => {
      const room = makeRoom()
      getClientMock.mockReturnValue({ getRoom: (id: string) => (id === '!r:e' ? room : null) })
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
      getClientMock.mockReturnValue({ getRoom: () => null })
      expect(await service.getRoomSummaries(['!a', '!b'])).toEqual(new Map())
    })
  })
})
