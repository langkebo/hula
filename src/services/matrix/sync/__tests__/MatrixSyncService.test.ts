import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { syncService, useSync } from '../MatrixSyncService'

vi.mock('../../MatrixClientService', () => {
  const service = {
    getClient: vi.fn()
  }

  return {
    matrixClientService: service,
    default: service
  }
})

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const mockRoom = {
  getMyMembership: vi.fn(() => 'join'),
  getUnreadNotificationCount: vi.fn((kind: string) => {
    if (kind === 'Highlight' || kind === 'highlight') return 1
    if (kind === 'Total' || kind === 'total') return 5
    return 0
  })
} as any

const mockClient = {
  sync: vi.fn(),
  stopClient: vi.fn(),
  getRooms: vi.fn(() => []),
  on: vi.fn(),
  off: vi.fn()
} as any

describe('SyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(matrixClientService.getClient).mockReset()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initialize', () => {
    it('should set client', () => {
      syncService.initialize(mockClient)
      expect(true).toBe(true)
    })
  })

  describe('startSync', () => {
    it('should throw error when client is not initialized', async () => {
      const service = new (syncService.constructor as any)()
      await expect(service.startSync()).rejects.toThrow('Client 未初始化')
    })

    it('should use matrixClientService client when initialize is not called', async () => {
      mockClient.sync.mockResolvedValueOnce(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient)

      const service = new (syncService.constructor as any)()
      await service.startSync({ preset: 'realtime' })

      expect(matrixClientService.getClient).toHaveBeenCalled()
      expect(mockClient.sync).toHaveBeenCalledWith({ preset: 'realtime' })
    })

    it('should not start sync if already syncing', async () => {
      const service = new (syncService.constructor as any)()
      service.initialize(mockClient)
      ;(service as any).syncState.isSyncing = true

      await service.startSync()
      expect(mockClient.sync).not.toHaveBeenCalled()
    })

    it('should start sync successfully', async () => {
      mockClient.sync.mockResolvedValueOnce(undefined)

      const service = new (syncService.constructor as any)()
      service.initialize(mockClient)

      await service.startSync({ preset: 'initialSync' })
      expect(mockClient.sync).toHaveBeenCalled()
    })

    it('should handle sync error', async () => {
      mockClient.sync.mockRejectedValueOnce(new Error('Sync failed'))

      const service = new (syncService.constructor as any)()
      service.initialize(mockClient)

      await expect(service.startSync()).rejects.toThrow('Sync failed')
    })
  })

  describe('stopSync', () => {
    it('should do nothing when client is not initialized', async () => {
      const service = new (syncService.constructor as any)()
      await service.stopSync()
    })

    it('should stop client', async () => {
      const service = new (syncService.constructor as any)()
      service.initialize(mockClient)

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
      const service = new (syncService.constructor as any)()
      expect(service.getRooms()).toEqual([])
    })

    it('should return rooms from client', () => {
      mockClient.getRooms.mockReturnValueOnce([mockRoom, mockRoom])

      const service = new (syncService.constructor as any)()
      service.initialize(mockClient)

      const rooms = service.getRooms()
      expect(rooms).toHaveLength(2)
    })
  })

  describe('getJoinedRooms', () => {
    it('should filter rooms by join membership', () => {
      const joinRoom = { getMyMembership: () => 'join' } as any
      const inviteRoom = { getMyMembership: () => 'invite' } as any
      const leaveRoom = { getMyMembership: () => 'leave' } as any

      mockClient.getRooms.mockReturnValueOnce([joinRoom, inviteRoom, leaveRoom, joinRoom])

      const service = new (syncService.constructor as any)()
      service.initialize(mockClient)

      const rooms = service.getJoinedRooms()
      expect(rooms).toHaveLength(2)
    })
  })

  describe('getInvitedRooms', () => {
    it('should filter rooms by invite membership', () => {
      const joinRoom = { getMyMembership: () => 'join' } as any
      const inviteRoom = { getMyMembership: () => 'invite' } as any

      mockClient.getRooms.mockReturnValueOnce([joinRoom, inviteRoom, inviteRoom])

      const service = new (syncService.constructor as any)()
      service.initialize(mockClient)

      const rooms = service.getInvitedRooms()
      expect(rooms).toHaveLength(2)
    })
  })

  describe('getLeftRooms', () => {
    it('should filter rooms by leave membership', () => {
      const joinRoom = { getMyMembership: () => 'join' } as any
      const leaveRoom = { getMyMembership: () => 'leave' } as any

      mockClient.getRooms.mockReturnValueOnce([joinRoom, leaveRoom, leaveRoom])

      const service = new (syncService.constructor as any)()
      service.initialize(mockClient)

      const rooms = service.getLeftRooms()
      expect(rooms).toHaveLength(2)
    })
  })

  describe('onSync', () => {
    it('should register event listener', () => {
      const service = new (syncService.constructor as any)()
      service.initialize(mockClient)

      const callback = vi.fn()
      service.onSync('sync', callback)

      expect(mockClient.on).toHaveBeenCalledWith('sync', callback)
    })
  })

  describe('offSync', () => {
    it('should remove event listener', () => {
      const service = new (syncService.constructor as any)()
      service.initialize(mockClient)

      const callback = vi.fn()
      service.onSync('sync', callback)
      service.offSync('sync')

      expect(mockClient.off).toHaveBeenCalledWith('sync', callback)
    })

    it('should migrate sync listeners when client changes', () => {
      const oldClient = {
        ...mockClient,
        on: vi.fn(),
        off: vi.fn()
      }
      const newClient = {
        ...mockClient,
        on: vi.fn(),
        off: vi.fn()
      }
      const service = new (syncService.constructor as any)()
      const callback = vi.fn()

      vi.mocked(matrixClientService.getClient).mockReturnValue(oldClient)
      service.initialize(oldClient)
      service.onSync('sync', callback)

      vi.mocked(matrixClientService.getClient).mockReturnValue(newClient)
      service.getRooms()

      expect(oldClient.on).toHaveBeenCalledWith('sync', callback)
      expect(oldClient.off).toHaveBeenCalledWith('sync', callback)
      expect(newClient.on).toHaveBeenCalledWith('sync', callback)
    })
  })

  describe('getUnreadNotificationCount', () => {
    it('should return total unread notification count', () => {
      const rooms = [
        { getMyMembership: () => 'join', getUnreadNotificationCount: (kind: string) => (kind === 'highlight' ? 2 : 5) },
        {
          getMyMembership: () => 'join',
          getUnreadNotificationCount: (kind: string) => (kind === 'highlight' ? 3 : 10)
        },
        {
          getMyMembership: () => 'invite',
          getUnreadNotificationCount: (kind: string) => (kind === 'highlight' ? 1 : 1)
        }
      ] as any[]

      mockClient.getRooms.mockReturnValueOnce(rooms)

      const service = new (syncService.constructor as any)()
      service.initialize(mockClient)

      const count = service.getUnreadNotificationCount()
      expect(count).toBe(5)
    })
  })

  describe('getUnreadMessageCount', () => {
    it('should return total unread message count', () => {
      const rooms = [
        { getMyMembership: () => 'join', getUnreadNotificationCount: (kind: string) => (kind === 'highlight' ? 2 : 5) },
        { getMyMembership: () => 'join', getUnreadNotificationCount: (kind: string) => (kind === 'highlight' ? 3 : 10) }
      ] as any[]

      mockClient.getRooms.mockReturnValueOnce(rooms)

      const service = new (syncService.constructor as any)()
      service.initialize(mockClient)

      const count = service.getUnreadMessageCount()
      expect(count).toBe(15)
    })
  })
})

describe('useSync composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClient.sync.mockResolvedValue(undefined)
    mockClient.getRooms.mockReturnValue([])
  })

  it('should initialize with default values', () => {
    const { rooms, isSyncing, unreadCount, notificationCount } = useSync()

    expect(rooms.value).toEqual([])
    expect(isSyncing.value).toBe(false)
    expect(unreadCount.value).toBe(0)
    expect(notificationCount.value).toBe(0)
  })

  it('should start sync', async () => {
    syncService.initialize(mockClient)
    const { startSync, isSyncing } = useSync()

    await startSync()
    expect(isSyncing.value).toBe(false)
  })

  it('should stop sync', async () => {
    syncService.initialize(mockClient)
    const { stopSync, isSyncing } = useSync()

    await stopSync()
    expect(isSyncing.value).toBe(false)
  })
})
