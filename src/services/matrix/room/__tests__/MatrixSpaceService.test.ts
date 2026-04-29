import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixSpaceService } from '../MatrixSpaceService'

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn()
}))

describe('MatrixSpaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw when client is not initialized', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

    await expect(
      matrixSpaceService.createSpace({
        name: 'Test Space'
      })
    ).rejects.toThrow('客户端未初始化')
  })

  it('should create space successfully', async () => {
    const mockCreateRoom = vi.fn().mockResolvedValue({ room_id: '!space:server' })
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      createRoom: mockCreateRoom
    } as any)

    const result = await matrixSpaceService.createSpace({
      name: 'Team Space',
      topic: 'For team',
      visibility: 'private'
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
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getRoom: vi.fn().mockReturnValue(null)
    } as any)

    const result = await matrixSpaceService.getSpace('!missing:server')

    expect(result).toBeNull()
  })

  it('should detect space room correctly', () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getRoom: vi.fn().mockReturnValue({
        isSpaceRoom: vi.fn().mockReturnValue(true)
      })
    } as any)

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

    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getRooms: vi.fn().mockReturnValue([mockSpaceRoom, mockNormalRoom])
    } as any)

    const result = await matrixSpaceService.getUserSpaces()

    expect(result).toHaveLength(1)
    expect(result[0].spaceId).toBe('!space:server')
  })

  describe('searchSpacesViaApi', () => {
    it('should search spaces via API', async () => {
      const mockHttp = {
        authedRequest: vi.fn().mockResolvedValue({
          spaces: [{ space_id: '!space1:server', name: 'Space 1', member_count: 5, child_count: 2 }]
        })
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as any)

      const result = await matrixSpaceService.searchSpacesViaApi('test', 10)

      expect(result).toHaveLength(1)
      expect(result[0].spaceId).toBe('!space1:server')
      expect(result[0].name).toBe('Space 1')
      expect(mockHttp.authedRequest).toHaveBeenCalledWith('GET', '/_matrix/client/v3/spaces/search', {
        query: 'test',
        limit: '10'
      })
    })

    it('should return empty array on error', async () => {
      const mockHttp = {
        authedRequest: vi.fn().mockRejectedValue(new Error('Network error'))
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as any)

      const result = await matrixSpaceService.searchSpacesViaApi('test')

      expect(result).toEqual([])
    })
  })

  describe('getSpaceStatistics', () => {
    it('should get space statistics', async () => {
      const mockStats = { total_spaces: 10, total_members: 50 }
      const mockHttp = { authedRequest: vi.fn().mockResolvedValue(mockStats) }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as any)

      const result = await matrixSpaceService.getSpaceStatistics()

      expect(result).toEqual(mockStats)
      expect(mockHttp.authedRequest).toHaveBeenCalledWith('GET', '/_matrix/client/v3/spaces/statistics')
    })

    it('should return empty object on error', async () => {
      const mockHttp = { authedRequest: vi.fn().mockRejectedValue(new Error('fail')) }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as any)

      const result = await matrixSpaceService.getSpaceStatistics()

      expect(result).toEqual({})
    })
  })

  describe('getUserSpacesViaApi', () => {
    it('should get user spaces via API', async () => {
      const mockHttp = {
        authedRequest: vi.fn().mockResolvedValue({
          spaces: [{ space_id: '!s1:server', name: 'S1', member_count: 3, child_count: 1 }]
        })
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as any)

      const result = await matrixSpaceService.getUserSpacesViaApi()

      expect(result).toHaveLength(1)
      expect(result[0].spaceId).toBe('!s1:server')
      expect(mockHttp.authedRequest).toHaveBeenCalledWith('GET', '/_matrix/client/v3/spaces/user')
    })
  })

  describe('getSpaceHierarchy', () => {
    it('should get space hierarchy', async () => {
      const mockHierarchy = {
        rooms: [{ room_id: '!room1:server', name: 'Room 1' }],
        next_batch: 'batch_token'
      }
      const mockHttp = { authedRequest: vi.fn().mockResolvedValue(mockHierarchy) }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as any)

      const result = await matrixSpaceService.getSpaceHierarchy('!space:server', { limit: 10, maxDepth: 3 })

      expect(result.rooms).toHaveLength(1)
      expect(result.next_batch).toBe('batch_token')
      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'GET',
        '/_matrix/client/v1/spaces/!space%3Aserver/hierarchy',
        { limit: '10', max_depth: '3' }
      )
    })

    it('should return empty rooms on error', async () => {
      const mockHttp = { authedRequest: vi.fn().mockRejectedValue(new Error('fail')) }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as any)

      const result = await matrixSpaceService.getSpaceHierarchy('!space:server')

      expect(result.rooms).toEqual([])
    })
  })

  describe('getSpaceSummaryWithChildren', () => {
    it('should get space summary with children', async () => {
      const mockSummary = {
        space: { space_id: '!space:server', name: 'Main Space', member_count: 10, child_count: 3 },
        children: [{ room_id: '!child1:server', name: 'Child 1' }]
      }
      const mockHttp = { authedRequest: vi.fn().mockResolvedValue(mockSummary) }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as any)

      const result = await matrixSpaceService.getSpaceSummaryWithChildren('!space:server')

      expect(result).not.toBeNull()
      expect(result!.space.spaceId).toBe('!space:server')
      expect(result!.children).toHaveLength(1)
    })

    it('should return null when space data missing', async () => {
      const mockHttp = { authedRequest: vi.fn().mockResolvedValue({}) }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as any)

      const result = await matrixSpaceService.getSpaceSummaryWithChildren('!space:server')

      expect(result).toBeNull()
    })
  })

  describe('getSpaceTreePath', () => {
    it('should get space tree path', async () => {
      const mockPath = {
        path: [
          { space_id: '!root:server', name: 'Root' },
          { space_id: '!child:server', name: 'Child' }
        ]
      }
      const mockHttp = { authedRequest: vi.fn().mockResolvedValue(mockPath) }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as any)

      const result = await matrixSpaceService.getSpaceTreePath('!child:server')

      expect(result).toHaveLength(2)
      expect(result[0].space_id).toBe('!root:server')
    })

    it('should return empty array on error', async () => {
      const mockHttp = { authedRequest: vi.fn().mockRejectedValue(new Error('fail')) }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as any)

      const result = await matrixSpaceService.getSpaceTreePath('!space:server')

      expect(result).toEqual([])
    })
  })

  describe('getRoomParentSpacesViaApi', () => {
    it('should get room parent spaces via API', async () => {
      const mockHttp = {
        authedRequest: vi
          .fn()
          .mockResolvedValue([{ space_id: '!parent:server', name: 'Parent Space', member_count: 8, child_count: 2 }])
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as any)

      const result = await matrixSpaceService.getRoomParentSpacesViaApi('!room:server')

      expect(result).toHaveLength(1)
      expect(result[0].spaceId).toBe('!parent:server')
      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'GET',
        '/_matrix/client/v3/spaces/room/!room%3Aserver/parents'
      )
    })
  })
})
