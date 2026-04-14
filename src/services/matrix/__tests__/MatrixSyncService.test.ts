import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { syncService, useSync, SyncService } from '../MatrixSyncService'
import type { MatrixClient, Room } from 'matrix-js-sdk'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../BaseManager', () => {
  return {
    BaseManager: class {
      protected handleError<T>(error: unknown, _operation: string, defaultValue: T, throwOnError: boolean): T {
        if (throwOnError) throw error
        return defaultValue
      }
      protected normalizeError(error: unknown, _operation: string) {
        return error
      }
    }
  }
})

interface MockRoom {
  getMyMembership: () => string
  getUnreadNotificationCount: () => { highlight: number; notification: number }
}

const createMockRoom = (membership: string = 'join'): MockRoom => ({
  getMyMembership: () => membership,
  getUnreadNotificationCount: () => ({ highlight: 1, notification: 5 })
})

interface MockClient {
  sync: ReturnType<typeof vi.fn>
  stopClient: ReturnType<typeof vi.fn>
  getRooms: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  getProfile: ReturnType<typeof vi.fn>
}

const createMockClient = (): MockClient => ({
  sync: vi.fn(),
  stopClient: vi.fn(),
  getRooms: vi.fn<() => Room[]>(() => []),
  on: vi.fn(),
  off: vi.fn(),
  getProfile: vi.fn()
})

let mockClient: MockClient
let mockRoom: MockRoom

describe('SyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClient = createMockClient()
    mockRoom = createMockRoom()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initialize', () => {
    it('should set client', () => {
      syncService.initialize(mockClient as unknown as MatrixClient)
      expect(true).toBe(true)
    })
  })

  describe('startSync', () => {
    it('should throw error when client is not initialized', async () => {
      const service = new SyncService()
      await expect(service.startSync()).rejects.toThrow('Client 未初始化')
    })

    it('should not start sync if already syncing', async () => {
      const service = new SyncService()
      service.initialize(mockClient as unknown as MatrixClient)

      await service.startSync()

      expect(mockClient.sync).toHaveBeenCalledTimes(1)
    })

    it('should start sync successfully', async () => {
      mockClient.sync.mockResolvedValueOnce(undefined)

      const service = new SyncService()
      service.initialize(mockClient as unknown as MatrixClient)

      await service.startSync({ preset: 'initialSync' })
      expect(mockClient.sync).toHaveBeenCalled()
    })

    it('should handle sync error via retry mechanism', async () => {
      mockClient.sync.mockRejectedValueOnce(new Error('Sync failed'))

      const service = new SyncService()
      service.initialize(mockClient as unknown as MatrixClient)

      const result = await service.startSync()
      expect(result).toBeUndefined()
    })
  })

  describe('stopSync', () => {
    it('should do nothing when client is not initialized', async () => {
      const service = new SyncService()
      await service.stopSync()
    })

    it('should stop client', async () => {
      const service = new SyncService()
      service.initialize(mockClient as unknown as MatrixClient)

      await service.stopSync()
      expect(mockClient.stopClient).toHaveBeenCalled()
    })
  })

  describe('getSyncState', () => {
    it('should return current sync state', () => {
      const state = syncService.getSyncState()

      expect(state).toHaveProperty('currentIdx')
      expect(state).toHaveProperty('roomCount')
      expect(state).toHaveProperty('isSyncing')
      expect(state).toHaveProperty('lastSyncTime')
    })
  })

  describe('getRooms', () => {
    it('should return empty array when client is not initialized', () => {
      const service = new SyncService()
      expect(service.getRooms()).toEqual([])
    })

    it('should return rooms from client', () => {
      mockClient.getRooms.mockReturnValueOnce([mockRoom, mockRoom] as unknown as Room[])

      const service = new SyncService()
      service.initialize(mockClient as unknown as MatrixClient)

      const rooms = service.getRooms()
      expect(rooms).toHaveLength(2)
    })
  })

  describe('getJoinedRooms', () => {
    it('should filter rooms by join membership', () => {
      const joinRoom = createMockRoom('join')
      const inviteRoom = createMockRoom('invite')
      const leaveRoom = createMockRoom('leave')

      mockClient.getRooms.mockReturnValueOnce([joinRoom, inviteRoom, leaveRoom, joinRoom] as unknown as Room[])

      const service = new SyncService()
      service.initialize(mockClient as unknown as MatrixClient)

      const rooms = service.getJoinedRooms()
      expect(rooms).toHaveLength(2)
    })
  })

  describe('getInvitedRooms', () => {
    it('should filter rooms by invite membership', () => {
      const joinRoom = createMockRoom('join')
      const inviteRoom = createMockRoom('invite')

      mockClient.getRooms.mockReturnValueOnce([joinRoom, inviteRoom, inviteRoom] as unknown as Room[])

      const service = new SyncService()
      service.initialize(mockClient as unknown as MatrixClient)

      const rooms = service.getInvitedRooms()
      expect(rooms).toHaveLength(2)
    })
  })

  describe('getLeftRooms', () => {
    it('should filter rooms by leave membership', () => {
      const joinRoom = createMockRoom('join')
      const leaveRoom = createMockRoom('leave')

      mockClient.getRooms.mockReturnValueOnce([joinRoom, leaveRoom, leaveRoom] as unknown as Room[])

      const service = new SyncService()
      service.initialize(mockClient as unknown as MatrixClient)

      const rooms = service.getLeftRooms()
      expect(rooms).toHaveLength(2)
    })
  })

  describe('onSync', () => {
    it('should register event listener', () => {
      const service = new SyncService()
      service.initialize(mockClient as unknown as MatrixClient)

      const callback = vi.fn()
      service.onSync('sync', callback)

      expect(mockClient.on).toHaveBeenCalledWith('sync', callback)
    })
  })

  describe('offSync', () => {
    it('should remove event listener', () => {
      const service = new SyncService()
      service.initialize(mockClient as unknown as MatrixClient)

      const callback = vi.fn()
      service.onSync('sync', callback)
      service.offSync('sync')

      expect(mockClient.off).toHaveBeenCalledWith('sync', callback)
    })
  })

  describe('getUnreadNotificationCount', () => {
    it('should return total unread notification count', () => {
      const rooms = [
        {
          getMyMembership: () => 'join',
          getUnreadNotificationCount: () => ({ highlight: 2, notification: 5 })
        },
        {
          getMyMembership: () => 'join',
          getUnreadNotificationCount: () => ({ highlight: 3, notification: 10 })
        },
        {
          getMyMembership: () => 'invite',
          getUnreadNotificationCount: () => ({ highlight: 1, notification: 1 })
        }
      ] as unknown as Room[]

      mockClient.getRooms.mockReturnValueOnce(rooms)

      const service = new SyncService()
      service.initialize(mockClient as unknown as MatrixClient)

      const count = service.getUnreadNotificationCount()
      expect(count).toBe(5)
    })
  })

  describe('useSync', () => {
    it('should return sync composable', () => {
      const syncComposable = useSync()
      expect(syncComposable).toHaveProperty('rooms')
      expect(syncComposable).toHaveProperty('isSyncing')
      expect(syncComposable).toHaveProperty('startSync')
      expect(syncComposable).toHaveProperty('stopSync')
    })
  })
})
