import { type MatrixClient, Visibility } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { matrixSpaceService } from '../MatrixSpaceService'

const TEST_BASE_URL = 'https://matrix.example.com'
const PREFIX_V3 = '/_matrix/client/v3'

const server = setupMswServer(
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/spaces/search`, () => {
    return HttpResponse.json({
      spaces: [{ space_id: '!space1:server', name: 'Space 1', member_count: 5, child_count: 2 }]
    })
  }),
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/spaces/statistics`, () => {
    return HttpResponse.json({ total_spaces: 10, total_members: 50 })
  }),
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/spaces/user`, () => {
    return HttpResponse.json({
      spaces: [{ space_id: '!s1:server', name: 'S1', member_count: 3, child_count: 1 }]
    })
  }),
  http.get(`${TEST_BASE_URL}/_matrix/client/v1/spaces/:spaceId/hierarchy`, () => {
    return HttpResponse.json({
      rooms: [{ room_id: '!room1:server', name: 'Room 1' }],
      next_batch: 'batch_token'
    })
  }),
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/spaces/:spaceId/summary/with_children`, () => {
    return HttpResponse.json({
      space: { space_id: '!space:server', name: 'Main Space', member_count: 10, child_count: 3 },
      children: [{ room_id: '!child1:server', name: 'Child 1' }]
    })
  }),
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/spaces/:spaceId/tree_path`, () => {
    return HttpResponse.json({
      path: [
        { space_id: '!root:server', name: 'Root' },
        { space_id: '!child:server', name: 'Child' }
      ]
    })
  }),
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/spaces/room/:roomId/parents`, () => {
    return HttpResponse.json([{ space_id: '!parent:server', name: 'Parent Space', member_count: 8, child_count: 2 }])
  })
)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn()
}))

const asMatrixClient = <T extends object>(client: T) => client as unknown as MatrixClient

const authedRequestImpl = vi.fn()

const mockSpaceManager = {
  getSpace: vi.fn(),
  getSpaceRooms: vi.fn(),
  getSpaceMembers: vi.fn(),
  getSpaceSummaryWithChildren: vi.fn(),
  getSpaceTreePath: vi.fn(),
  searchSpaces: vi.fn(),
  getSpaceStatistics: vi.fn(),
  getUserSpaces: vi.fn(),
  getRoomParentSpaces: vi.fn(),
  getSpaceHierarchyPage: vi.fn(),
  getSpaceHierarchyV1: vi.fn()
}

const asManagerClient = (overrides: Record<string, unknown> = {}) =>
  asMatrixClient({
    http: { authedRequest: authedRequestImpl },
    getSpaceManager: () => mockSpaceManager,
    ...overrides
  })

describe('MatrixSpaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authedRequestImpl.mockImplementation(
      async (method: string, path: string, queryParams?: unknown, body?: unknown, opts?: { prefix?: string }) => {
        const defaultPrefix = path.startsWith('/_') ? '' : PREFIX_V3
        const prefix = opts?.prefix ?? defaultPrefix
        const url = new URL(`${TEST_BASE_URL}${prefix}${path}`)
        if (queryParams && typeof queryParams === 'object') {
          for (const [key, value] of Object.entries(queryParams as Record<string, string>)) {
            url.searchParams.set(key, value)
          }
        }
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-access-token'
        }
        const response = await fetch(url.toString(), {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.json()
      }
    )
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
  })

  it('should throw when client is not initialized', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    await expect(
      matrixSpaceService.createSpace({
        name: 'Test Space'
      })
    ).rejects.toThrow('客户端未初始化')
  })

  it('should create space successfully', async () => {
    const mockCreateRoom = vi.fn().mockResolvedValue({ room_id: '!space:server' })
    vi.mocked(matrixClientService.getClient).mockReturnValue(asMatrixClient({ createRoom: mockCreateRoom }))

    const result = await matrixSpaceService.createSpace({
      name: 'Team Space',
      topic: 'For team',
      visibility: Visibility.Private
    })

    expect(result).toEqual({
      spaceId: '!space:server',
      name: 'Team Space',
      topic: 'For team',
      avatarUrl: undefined,
      memberCount: 1,
      childCount: 0
    })
    expect(mockCreateRoom).toHaveBeenCalled()
  })

  it('should return null when target space room does not exist', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(asMatrixClient({ getRoom: vi.fn().mockReturnValue(null) }))

    const result = await matrixSpaceService.getSpace('!missing:server')

    expect(result).toBeNull()
  })

  it('should detect space room correctly', () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(
      asMatrixClient({
        getRoom: vi.fn().mockReturnValue({
          isSpaceRoom: vi.fn().mockReturnValue(true)
        })
      })
    )

    const result = matrixSpaceService.isSpace('!space:server')

    expect(result).toBe(true)
  })

  it('should return only user spaces', async () => {
    const mockSpaceRoom = {
      roomId: '!space:server',
      name: 'Main Space',
      topic: 'Topic',
      getMxcAvatarUrl: vi.fn().mockReturnValue('mxc://avatar'),
      getJoinedMembers: vi.fn().mockReturnValue([{ userId: '@u:server' }]),
      currentState: {
        getStateEvents: vi.fn().mockReturnValue([])
      },
      isSpaceRoom: vi.fn().mockReturnValue(true)
    }
    const mockNormalRoom = {
      isSpaceRoom: vi.fn().mockReturnValue(false)
    }

    vi.mocked(matrixClientService.getClient).mockReturnValue(
      asMatrixClient({
        getRooms: vi.fn().mockReturnValue([mockSpaceRoom, mockNormalRoom])
      })
    )

    const result = await matrixSpaceService.getUserSpaces()

    expect(result).toHaveLength(1)
    expect(result[0].spaceId).toBe('!space:server')
  })

  describe('searchSpacesViaApi', () => {
    it('should search spaces via API', async () => {
      mockSpaceManager.searchSpaces.mockResolvedValueOnce([
        { space_id: '!space1:server', name: 'Space 1', member_count: 5, child_count: 2 }
      ])
      vi.mocked(matrixClientService.getClient).mockReturnValue(asManagerClient())

      const result = await matrixSpaceService.searchSpacesViaApi('test', 10)

      expect(result).toHaveLength(1)
      expect(result[0].spaceId).toBe('!space1:server')
      expect(result[0].name).toBe('Space 1')
      expect(mockSpaceManager.searchSpaces).toHaveBeenCalledWith('test', 10)
    })

    it('should return empty array on error', async () => {
      mockSpaceManager.searchSpaces.mockRejectedValueOnce(new Error('HTTP 500'))
      vi.mocked(matrixClientService.getClient).mockReturnValue(asManagerClient())

      const result = await matrixSpaceService.searchSpacesViaApi('test')

      expect(result).toEqual([])
    })
  })

  describe('getSpaceStatistics', () => {
    it('should get space statistics', async () => {
      mockSpaceManager.getSpaceStatistics.mockResolvedValueOnce({ total_spaces: 10, total_members: 50 })
      vi.mocked(matrixClientService.getClient).mockReturnValue(asManagerClient())

      const result = await matrixSpaceService.getSpaceStatistics()

      expect(result).toEqual({ total_spaces: 10, total_members: 50 })
      expect(mockSpaceManager.getSpaceStatistics).toHaveBeenCalled()
    })

    it('should return empty object on error', async () => {
      mockSpaceManager.getSpaceStatistics.mockRejectedValueOnce(new Error('HTTP 500'))
      vi.mocked(matrixClientService.getClient).mockReturnValue(asManagerClient())

      const result = await matrixSpaceService.getSpaceStatistics()

      expect(result).toEqual({})
    })
  })

  describe('getUserSpacesViaApi', () => {
    it('should get user spaces via API', async () => {
      mockSpaceManager.getUserSpaces.mockResolvedValueOnce([
        { space_id: '!s1:server', name: 'S1', member_count: 3, child_count: 1 }
      ])
      vi.mocked(matrixClientService.getClient).mockReturnValue(asManagerClient())

      const result = await matrixSpaceService.getUserSpacesViaApi()

      expect(result).toHaveLength(1)
      expect(result[0].spaceId).toBe('!s1:server')
      expect(mockSpaceManager.getUserSpaces).toHaveBeenCalled()
    })
  })

  describe('getSpaceHierarchy', () => {
    it('should get space hierarchy', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        asMatrixClient({ http: { authedRequest: authedRequestImpl } })
      )

      const result = await matrixSpaceService.getSpaceHierarchy('!space:server', { limit: 10, maxDepth: 3 })

      expect(result.rooms).toHaveLength(1)
      expect(result.next_batch).toBe('batch_token')
      expect(authedRequestImpl).toHaveBeenCalledWith(
        'GET',
        '/spaces/!space%3Aserver/hierarchy',
        {
          limit: '10',
          max_depth: '3'
        },
        undefined,
        { prefix: '/_matrix/client/v1' }
      )
    })

    it('should return empty rooms on error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_matrix/client/v1/spaces/:spaceId/hierarchy`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        asMatrixClient({ http: { authedRequest: authedRequestImpl } })
      )

      const result = await matrixSpaceService.getSpaceHierarchy('!space:server')

      expect(result.rooms).toEqual([])
    })
  })

  describe('getSpaceSummaryWithChildren', () => {
    it('should get space summary with children', async () => {
      mockSpaceManager.getSpaceSummaryWithChildren.mockResolvedValueOnce({
        space: { space_id: '!space:server', name: 'Main Space', member_count: 10, child_count: 3 },
        children: [{ room_id: '!child1:server', name: 'Child 1' }]
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue(asManagerClient())

      const result = await matrixSpaceService.getSpaceSummaryWithChildren('!space:server')

      expect(result).not.toBeNull()
      expect(result!.space.spaceId).toBe('!space:server')
      expect(result!.children).toHaveLength(1)
      expect(mockSpaceManager.getSpaceSummaryWithChildren).toHaveBeenCalledWith('!space:server')
    })

    it('should return null when space data missing', async () => {
      mockSpaceManager.getSpaceSummaryWithChildren.mockResolvedValueOnce({})
      vi.mocked(matrixClientService.getClient).mockReturnValue(asManagerClient())

      const result = await matrixSpaceService.getSpaceSummaryWithChildren('!space:server')

      expect(result).toBeNull()
    })
  })

  describe('getSpaceTreePath', () => {
    it('should get space tree path via tree_path endpoint', async () => {
      mockSpaceManager.getSpaceTreePath.mockResolvedValueOnce({
        path: [
          { space_id: '!root:server', name: 'Root' },
          { space_id: '!child:server', name: 'Child' }
        ]
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue(asManagerClient())

      const result = await matrixSpaceService.getSpaceTreePath('!child:server')

      expect(result).toHaveLength(2)
      expect(result[0].space_id).toBe('!root:server')
      expect(mockSpaceManager.getSpaceTreePath).toHaveBeenCalledWith('!child:server')
    })

    it('should return empty array when tree_path fails', async () => {
      mockSpaceManager.getSpaceTreePath.mockRejectedValueOnce(new Error('HTTP 500'))
      // Fallback path: getSpaceTreePathViaParents → getRoomParentSpacesViaApi → manager.getRoomParentSpaces
      mockSpaceManager.getRoomParentSpaces.mockResolvedValueOnce([])
      vi.mocked(matrixClientService.getClient).mockReturnValue(asManagerClient())

      const result = await matrixSpaceService.getSpaceTreePath('!space:server')

      expect(result).toEqual([])
    })
  })

  describe('getRoomParentSpacesViaApi', () => {
    it('should get room parent spaces via API', async () => {
      mockSpaceManager.getRoomParentSpaces.mockResolvedValueOnce([
        { space_id: '!parent:server', name: 'Parent Space', member_count: 8, child_count: 2 }
      ])
      vi.mocked(matrixClientService.getClient).mockReturnValue(asManagerClient())

      const result = await matrixSpaceService.getRoomParentSpacesViaApi('!room:server')

      expect(result).toHaveLength(1)
      expect(result[0].spaceId).toBe('!parent:server')
      expect(mockSpaceManager.getRoomParentSpaces).toHaveBeenCalledWith('!room:server')
    })
  })
})
