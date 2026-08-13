import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClient, Room } from '../../sdk'
import type { Space as SdkSpace, SpaceManager as SdkSpaceManager } from '../../sdk-compat'
import { createSpaceQueries } from '../spaceQueries'

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn()
  }
}))

import { matrixClientService } from '../../MatrixClientService'

const asUnknown = <T>(value: unknown): T => value as unknown as T

function makeSdkSpace(spaceId: string, name?: string): SdkSpace {
  return { space_id: spaceId, name: name ?? '' } as unknown as SdkSpace
}

function makeSpaceRoom(roomId: string, childIds: string[], name = ''): Room {
  return asUnknown<Room>({
    roomId,
    name,
    currentState: {
      getStateEvents: vi.fn(() => childIds.map((id) => ({ getStateKey: () => id })))
    },
    isSpaceRoom: vi.fn(() => true),
    getMxcAvatarUrl: vi.fn(() => ''),
    getJoinedMembers: vi.fn(() => [])
  })
}

function makeClientClient(overrides: Partial<Record<string, unknown>> = {}): MatrixClient {
  return asUnknown<MatrixClient>({
    http: { authedRequest: vi.fn() },
    getRooms: vi.fn(),
    publicRooms: vi.fn(),
    ...overrides
  })
}

interface MockedManager {
  getRoomParentSpaces: ReturnType<typeof vi.fn>
  searchSpaces: ReturnType<typeof vi.fn>
  getUserSpaces: ReturnType<typeof vi.fn>
  getPublicSpaces: ReturnType<typeof vi.fn>
}

function makeManager(): MockedManager {
  return {
    getRoomParentSpaces: vi.fn(),
    searchSpaces: vi.fn(),
    getUserSpaces: vi.fn(),
    getPublicSpaces: vi.fn()
  }
}

describe('spaceQueries', () => {
  let getClient: () => MatrixClient
  let getSpaceManager: () => SdkSpaceManager
  let manager: MockedManager
  let client: MatrixClient

  beforeEach(() => {
    vi.clearAllMocks()
    manager = makeManager()
    getClient = vi.fn() as unknown as () => MatrixClient
    getSpaceManager = vi.fn(() => manager) as unknown as () => SdkSpaceManager
    client = makeClientClient()
    ;(getClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(client)
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)
  })

  describe('getRoomParentSpaces', () => {
    it('returns parent spaces from SpaceManager', async () => {
      manager.getRoomParentSpaces.mockResolvedValue([makeSdkSpace('!p1:server', 'Parent 1')])
      const queries = createSpaceQueries(getClient, getSpaceManager)
      const result = await queries.getRoomParentSpaces('!room:server')
      expect(result).toEqual([{ spaceId: '!p1:server', name: 'Parent 1', memberCount: 0, childCount: 0 }])
      expect(manager.getRoomParentSpaces).toHaveBeenCalledWith('!room:server')
    })

    it('falls back to REST authedRequest when manager throws and returns an array', async () => {
      manager.getRoomParentSpaces.mockRejectedValue(new Error('manager down'))
      const authedRequest = (client.http.authedRequest as ReturnType<typeof vi.fn>).mockResolvedValue([
        { space_id: '!p2:server', name: 'Parent 2' }
      ])
      const queries = createSpaceQueries(getClient, getSpaceManager)
      const result = await queries.getRoomParentSpaces('!room:server')
      expect(result).toEqual([{ spaceId: '!p2:server', name: 'Parent 2', memberCount: 0, childCount: 0 }])
      expect(authedRequest).toHaveBeenCalledWith(
        'GET',
        '/spaces/room/!room%3Aserver/parents',
        undefined,
        undefined,
        undefined
      )
    })

    it('falls back to REST and handles a { spaces } response object', async () => {
      manager.getRoomParentSpaces.mockRejectedValue(new Error('manager down'))
      ;(client.http.authedRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        spaces: [{ space_id: '!p3:server', name: 'Parent 3' }]
      })
      const queries = createSpaceQueries(getClient, getSpaceManager)
      const result = await queries.getRoomParentSpaces('!room:server')
      expect(result).toEqual([{ spaceId: '!p3:server', name: 'Parent 3', memberCount: 0, childCount: 0 }])
    })

    it('falls back to local filtering when manager and REST both fail', async () => {
      manager.getRoomParentSpaces.mockRejectedValue(new Error('manager down'))
      ;(client.http.authedRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('http down'))
      client.getRooms = vi.fn(() => [makeSpaceRoom('!spaceA:server', ['!room:server'], 'Space A')] as unknown as Room[])
      const queries = createSpaceQueries(getClient, getSpaceManager)
      const result = await queries.getRoomParentSpaces('!room:server')
      expect(result).toHaveLength(1)
      expect(result[0].spaceId).toBe('!spaceA:server')
    })

    it('returns [] when all three paths fail', async () => {
      manager.getRoomParentSpaces.mockRejectedValue(new Error('manager down'))
      ;(client.http.authedRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('http down'))
      client.getRooms = vi.fn(() => {
        throw new Error('rooms down')
      })
      const queries = createSpaceQueries(getClient, getSpaceManager)
      const result = await queries.getRoomParentSpaces('!room:server')
      expect(result).toEqual([])
    })
  })

  describe('searchSpaces', () => {
    it('returns [] for empty or whitespace query', async () => {
      const queries = createSpaceQueries(getClient, getSpaceManager)
      await expect(queries.searchSpaces('')).resolves.toEqual([])
      await expect(queries.searchSpaces('   ')).resolves.toEqual([])
      expect(manager.searchSpaces).not.toHaveBeenCalled()
    })

    it('searches via SpaceManager', async () => {
      manager.searchSpaces.mockResolvedValue([makeSdkSpace('!s1:server', 'Search Hit')])
      const queries = createSpaceQueries(getClient, getSpaceManager)
      const result = await queries.searchSpaces('hit', 5)
      expect(result).toEqual([{ spaceId: '!s1:server', name: 'Search Hit', memberCount: 0, childCount: 0 }])
      expect(manager.searchSpaces).toHaveBeenCalledWith('hit', 5)
    })

    it('falls back to REST search when manager throws', async () => {
      manager.searchSpaces.mockRejectedValue(new Error('manager down'))
      ;(client.http.authedRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        spaces: [{ space_id: '!s2:server', name: 'Via REST' }]
      })
      const queries = createSpaceQueries(getClient, getSpaceManager)
      const result = await queries.searchSpaces('rest', 7)
      expect(result).toEqual([{ spaceId: '!s2:server', name: 'Via REST', memberCount: 0, childCount: 0 }])
      expect(client.http.authedRequest).toHaveBeenCalledWith(
        'GET',
        '/spaces/search',
        {
          search_term: 'rest',
          limit: '7'
        },
        undefined,
        undefined
      )
    })

    it('falls back to local search when manager and REST both fail', async () => {
      manager.searchSpaces.mockRejectedValue(new Error('manager down'))
      ;(client.http.authedRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('http down'))
      client.getRooms = vi.fn(
        () =>
          [
            makeSpaceRoom('!sA:server', ['!room:server'], 'Alpha Space'),
            makeSpaceRoom('!sB:server', ['!room:server'], 'Beta Room')
          ] as unknown as Room[]
      )
      const queries = createSpaceQueries(getClient, getSpaceManager)
      const result = await queries.searchSpaces('alpha', 10)
      expect(result).toHaveLength(1)
      expect(result[0].spaceId).toBe('!sA:server')
    })

    it('returns [] when all search paths fail', async () => {
      manager.searchSpaces.mockRejectedValue(new Error('manager down'))
      ;(client.http.authedRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('http down'))
      client.getRooms = vi.fn(() => {
        throw new Error('rooms down')
      })
      const queries = createSpaceQueries(getClient, getSpaceManager)
      await expect(queries.searchSpaces('anything')).resolves.toEqual([])
    })
  })

  describe('getUserSpaces', () => {
    it('returns user spaces from SpaceManager', async () => {
      manager.getUserSpaces.mockResolvedValue([makeSdkSpace('!u1:server', 'My Space')])
      const queries = createSpaceQueries(getClient, getSpaceManager)
      const result = await queries.getUserSpaces()
      expect(result).toEqual([{ spaceId: '!u1:server', name: 'My Space', memberCount: 0, childCount: 0 }])
    })

    it('returns [] when manager fails and no fallback client exists', async () => {
      manager.getUserSpaces.mockRejectedValue(new Error('manager down'))
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      const queries = createSpaceQueries(getClient, getSpaceManager)
      await expect(queries.getUserSpaces()).resolves.toEqual([])
    })

    it('falls back to local rooms when manager fails and a client exists', async () => {
      manager.getUserSpaces.mockRejectedValue(new Error('manager down'))
      const fallbackClient = makeClientClient({
        getRooms: vi.fn(() => [makeSpaceRoom('!uA:server', [], 'Local Space')] as unknown as Room[])
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue(fallbackClient)
      const queries = createSpaceQueries(getClient, getSpaceManager)
      const result = await queries.getUserSpaces()
      expect(result).toHaveLength(1)
      expect(result[0].spaceId).toBe('!uA:server')
    })

    it('returns [] when manager times out and no fallback client exists', async () => {
      vi.useFakeTimers()
      manager.getUserSpaces.mockReturnValue(new Promise<never>(() => {}))
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      const queries = createSpaceQueries(getClient, getSpaceManager)
      const promise = queries.getUserSpaces()
      await vi.advanceTimersByTimeAsync(3000)
      await expect(promise).resolves.toEqual([])
      vi.useRealTimers()
    })
  })

  describe('getPublicSpaces', () => {
    it('returns public spaces from manager response.spaces', async () => {
      manager.getPublicSpaces.mockResolvedValue({ spaces: [makeSdkSpace('!pub1:server', 'Public 1')] })
      const queries = createSpaceQueries(getClient, getSpaceManager)
      const result = await queries.getPublicSpaces()
      expect(result).toEqual([{ spaceId: '!pub1:server', name: 'Public 1', memberCount: 0, childCount: 0 }])
      expect(manager.getPublicSpaces).toHaveBeenCalledWith({ limit: 50 })
    })

    it('returns public spaces from manager response.chunk', async () => {
      manager.getPublicSpaces.mockResolvedValue({ chunk: [makeSdkSpace('!pub2:server', 'Public 2')] })
      const queries = createSpaceQueries(getClient, getSpaceManager)
      const result = await queries.getPublicSpaces(20)
      expect(result).toEqual([{ spaceId: '!pub2:server', name: 'Public 2', memberCount: 0, childCount: 0 }])
      expect(manager.getPublicSpaces).toHaveBeenCalledWith({ limit: 20 })
    })

    it('returns public spaces from manager response.rooms', async () => {
      manager.getPublicSpaces.mockResolvedValue({ rooms: [makeSdkSpace('!pub3:server', 'Public 3')] })
      const queries = createSpaceQueries(getClient, getSpaceManager)
      const result = await queries.getPublicSpaces()
      expect(result).toEqual([{ spaceId: '!pub3:server', name: 'Public 3', memberCount: 0, childCount: 0 }])
    })

    it('falls back to client.publicRooms when manager throws', async () => {
      manager.getPublicSpaces.mockRejectedValue(new Error('manager down'))
      client.publicRooms = vi.fn().mockResolvedValue({
        chunk: [
          {
            room_id: '!pub4:server',
            name: 'Public 4',
            topic: 'Topic',
            avatar_url: 'mxc://x',
            num_joined_members: 9
          }
        ]
      })
      const queries = createSpaceQueries(getClient, getSpaceManager)
      const result = await queries.getPublicSpaces(15)
      expect(result).toEqual([
        {
          spaceId: '!pub4:server',
          name: 'Public 4',
          topic: 'Topic',
          avatarUrl: 'mxc://x',
          memberCount: 9,
          childCount: 0
        }
      ])
      expect(client.publicRooms).toHaveBeenCalledWith({ limit: 15, filter: { room_types: ['m.space'] } })
    })

    it('returns [] when manager and publicRooms both fail', async () => {
      manager.getPublicSpaces.mockRejectedValue(new Error('manager down'))
      client.publicRooms = vi.fn().mockRejectedValue(new Error('publicRooms down'))
      const queries = createSpaceQueries(getClient, getSpaceManager)
      await expect(queries.getPublicSpaces()).resolves.toEqual([])
    })
  })
})
