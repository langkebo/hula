import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { type MatrixClient, Visibility } from '../../sdk'
import { matrixSpaceService } from '../MatrixSpaceService'

const TEST_BASE_URL = 'https://matrix.example.com'
const PREFIX_V3 = '/_matrix/client/v3'

const server = setupMswServer(
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/spaces/search`, () => {
    return HttpResponse.json({
      spaces: [{ space_id: '!space1:server', name: 'Space 1', member_count: 5, child_count: 2 }]
    })
  }),
  http.get(`${TEST_BASE_URL}/_matrix/client/v1/spaces/:spaceId/hierarchy`, () => {
    return HttpResponse.json({
      rooms: [{ room_id: '!room1:server', name: 'Room 1' }],
      next_batch: 'batch_token'
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
    // 契约：不得把 m.room.create 放进 initial_state（服务端会拒绝并返回 400）。
    // 创建 Space 必须走 room_types: ['m.space']。
    const createRoomArg = mockCreateRoom.mock.calls[0][0]
    expect(createRoomArg.room_types).toEqual(['m.space'])
    expect(createRoomArg.initial_state).not.toContainEqual(expect.objectContaining({ type: 'm.room.create' }))
  })

  it('should return null when target space room does not exist', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(asMatrixClient({ getRoom: vi.fn().mockReturnValue(null) }))

    const result = await matrixSpaceService.getSpace('!missing:server')

    expect(result).toBeNull()
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

  describe('searchSpaces（SDK 失败时回退 REST /spaces/search）', () => {
    it('should search spaces via API fallback', async () => {
      // client 无 getSpaceManager → SDK 轨抛错 → 回退 REST
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        asMatrixClient({ http: { authedRequest: authedRequestImpl } })
      )

      const result = await matrixSpaceService.searchSpaces('test', 10)

      expect(result).toHaveLength(1)
      expect(result[0].spaceId).toBe('!space1:server')
      expect(result[0].name).toBe('Space 1')
      expect(authedRequestImpl).toHaveBeenCalledWith(
        'GET',
        '/spaces/search',
        {
          search_term: 'test',
          limit: '10'
        },
        undefined,
        undefined
      )
    })

    it('should return empty array on error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}${PREFIX_V3}/spaces/search`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        asMatrixClient({
          http: { authedRequest: authedRequestImpl },
          getRooms: vi.fn().mockReturnValue([])
        })
      )

      const result = await matrixSpaceService.searchSpaces('test')

      expect(result).toEqual([])
    })
  })

  describe('getSpaceHierarchy', () => {
    it('委托 SpaceManager.getSpaceHierarchyPage 并透传选项', async () => {
      const getSpaceHierarchyPage = vi.fn().mockResolvedValue({
        rooms: [{ room_id: '!room1:server', name: 'Room 1' }],
        next_batch: 'batch_token'
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        asMatrixClient({ getSpaceManager: () => ({ getSpaceHierarchyPage }) })
      )

      const result = await matrixSpaceService.getSpaceHierarchy('!space:server', { limit: 10, maxDepth: 3 })

      expect(getSpaceHierarchyPage).toHaveBeenCalledWith('!space:server', {
        from: undefined,
        limit: 10,
        max_depth: 3,
        suggested_only: undefined
      })
      expect(result.rooms).toHaveLength(1)
      expect(result.next_batch).toBe('batch_token')
    })

    it('should return empty rooms on error', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        asMatrixClient({
          getSpaceManager: () => ({ getSpaceHierarchyPage: vi.fn().mockRejectedValue(new Error('boom')) })
        })
      )

      const result = await matrixSpaceService.getSpaceHierarchy('!space:server')

      expect(result.rooms).toEqual([])
    })
  })

  describe('getSpaceTreePath', () => {
    it('委托 SpaceManager.getSpaceTreePath', async () => {
      const getSpaceTreePath = vi.fn().mockResolvedValue({
        path: [
          { space_id: '!root:server', name: 'Root' },
          { space_id: '!child:server', name: 'Child' }
        ]
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        asMatrixClient({ getSpaceManager: () => ({ getSpaceTreePath }) })
      )

      const result = await matrixSpaceService.getSpaceTreePath('!child:server')

      expect(getSpaceTreePath).toHaveBeenCalledWith('!child:server')
      expect(result).toHaveLength(2)
      expect(result[0].space_id).toBe('!root:server')
    })

    it('should return empty array when getSpaceTreePath fails and parents chain is empty', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}${PREFIX_V3}/spaces/room/:roomId/parents`, () => {
          return HttpResponse.json([])
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        asMatrixClient({
          getSpaceManager: () => ({ getSpaceTreePath: vi.fn().mockRejectedValue(new Error('boom')) })
        })
      )

      const result = await matrixSpaceService.getSpaceTreePath('!space:server')

      expect(result).toEqual([])
    })
  })

  describe('getRoomParentSpaces（统一入口：SDK → REST → 本地过滤）', () => {
    it('should get room parent spaces via REST fallback tier', async () => {
      // client 无 getSpaceManager → SDK 轨抛错 → 回退 REST /spaces/room/:roomId/parents
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        asMatrixClient({ http: { authedRequest: authedRequestImpl } })
      )

      const result = await matrixSpaceService.getRoomParentSpaces('!room:server')

      expect(result).toHaveLength(1)
      expect(result[0].spaceId).toBe('!parent:server')
      expect(authedRequestImpl).toHaveBeenCalledWith(
        'GET',
        '/spaces/room/!room%3Aserver/parents',
        undefined,
        undefined,
        undefined
      )
    })
  })
})
