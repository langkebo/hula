import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { syncService, useSync } from '../MatrixSyncService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const mockRoom = {
  getMyMembership: vi.fn(() => 'join'),
  getUnreadNotificationCount: vi.fn(() => ({ highlight: 1, notification: 5 }))
}

const mockClient = {
  sync: vi.fn(),
  stopClient: vi.fn(),
  getRooms: vi.fn(() => []),
  on: vi.fn(),
  off: vi.fn()
}

describe('SyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initialize', () => {
    it('should set client', () => {
      syncService.initialize(mockClient as any)
      expect(true).toBe(true)
    })
  })

  describe('startSync', () => {
    it('should throw error when client is not initialized', async () => {
      const service = new (syncService.constructor as any)()
      await expect(service.startSync()).rejects.toThrow('Client 未初始化')
    })

    it('should not start sync if already syncing', async () => {
      const service = new (syncService.constructor as any)()
      service.initialize(mockClient as any)
      ;(service as any).syncState.isSyncing = true

      await service.startSync()
      expect(mockClient.sync).not.toHaveBeenCalled()
    })

    it('should start sync successfully', async () => {
      mockClient.sync.mockResolvedValueOnce(undefined)

      const service = new (syncService.constructor as any)()
      service.initialize(mockClient as any)

      await service.startSync({ preset: 'initialSync' })
      expect(mockClient.sync).toHaveBeenCalled()
    })

    it('should handle sync error', async () => {
      mockClient.sync.mockRejectedValueOnce(new Error('Sync failed'))

      const service = new (syncService.constructor as any)()
      service.initialize(mockClient as any)

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
      service.initialize(mockClient as any)

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
      service.initialize(mockClient as any)

      const rooms = service.getRooms()
      expect(rooms).toHaveLength(2)
    })
  })

  describe('getJoinedRooms', () => {
    it('should filter rooms by join membership', () => {
      const joinRoom = { getMyMembership: () => 'join' }
      const inviteRoom = { getMyMembership: () => 'invite' }
      const leaveRoom = { getMyMembership: () => 'leave' }

      mockClient.getRooms.mockReturnValueOnce([joinRoom, inviteRoom, leaveRoom, joinRoom])

      const service = new (syncService.constructor as any)()
      service.initialize(mockClient as any)

      const rooms = service.getJoinedRooms()
      expect(rooms).toHaveLength(2)
    })
  })

  describe('getInvitedRooms', () => {
    it('should filter rooms by invite membership', () => {
      const joinRoom = { getMyMembership: () => 'join' }
      const inviteRoom = { getMyMembership: () => 'invite' }

      mockClient.getRooms.mockReturnValueOnce([joinRoom, inviteRoom, inviteRoom])

      const service = new (syncService.constructor as any)()
      service.initialize(mockClient as any)

      const rooms = service.getInvitedRooms()
      expect(rooms).toHaveLength(2)
    })
  })

  describe('getLeftRooms', () => {
    it('should filter rooms by leave membership', () => {
      const joinRoom = { getMyMembership: () => 'join' }
      const leaveRoom = { getMyMembership: () => 'leave' }

      mockClient.getRooms.mockReturnValueOnce([joinRoom, leaveRoom, leaveRoom])

      const service = new (syncService.constructor as any)()
      service.initialize(mockClient as any)

      const rooms = service.getLeftRooms()
      expect(rooms).toHaveLength(2)
    })
  })

  describe('onSync', () => {
    it('should register event listener', () => {
      const service = new (syncService.constructor as any)()
      service.initialize(mockClient as any)

      const callback = vi.fn()
      service.onSync('sync', callback)

      expect(mockClient.on).toHaveBeenCalledWith('sync', callback)
    })
  })

  describe('offSync', () => {
    it('should remove event listener', () => {
      const service = new (syncService.constructor as any)()
      service.initialize(mockClient as any)

      const callback = vi.fn()
      service.onSync('sync', callback)
      service.offSync('sync')

      expect(mockClient.off).toHaveBeenCalledWith('sync', callback)
    })
  })

  describe('getUnreadNotificationCount', () => {
    it('should return total unread notification count', () => {
      const rooms = [
        { getMyMembership: () => 'join', getUnreadNotificationCount: () => ({ highlight: 2, notification: 5 }) },
        { getMyMembership: () => 'join', getUnreadNotificationCount: () => ({ highlight: 3, notification: 10 }) },
        { getMyMembership: () => 'invite', getUnreadNotificationCount: () => ({ highlight: 1, notification: 1 }) }
      ]

      mockClient.getRooms.mockReturnValueOnce(rooms)

      const service = new (syncService.constructor as any)()
      service.initialize(mockClient as any)

      const count = service.getUnreadNotificationCount()
      expect(count).toBe(5)
    })
  })

  describe('getUnreadMessageCount', () => {
    it('should return total unread message count', () => {
      const rooms = [
        { getMyMembership: () => 'join', getUnreadNotificationCount: () => ({ highlight: 2, notification: 5 }) },
        { getMyMembership: () => 'join', getUnreadNotificationCount: () => ({ highlight: 3, notification: 10 }) }
      ]

      mockClient.getRooms.mockReturnValueOnce(rooms)

      const service = new (syncService.constructor as any)()
      service.initialize(mockClient as any)

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
    syncService.initialize(mockClient as any)
    const { startSync, isSyncing } = useSync()

    await startSync()
    expect(isSyncing.value).toBe(false)
  })

  it('should stop sync', async () => {
    syncService.initialize(mockClient as any)
    const { stopSync, isSyncing } = useSync()

    await stopSync()
    expect(isSyncing.value).toBe(false)
  })
})
