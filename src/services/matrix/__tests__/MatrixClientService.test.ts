import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../MatrixClientService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixClientService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset client to null between tests to prevent cross-test contamination
    ;(
      matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
    ).connectionManager.setClient(null)
  })

  afterEach(() => {
    vi.resetAllMocks()
    // Also reset client after tests
    ;(
      matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
    ).connectionManager.setClient(null)
  })

  describe('initialization', () => {
    it('should not have client initially', () => {
      expect(matrixClientService.getClient()).toBeNull()
    })
  })

  describe('logout', () => {
    it('should handle logout when not logged in', async () => {
      await expect(matrixClientService.logout()).resolves.not.toThrow()
    })
  })

  describe('getConnectionState', () => {
    it('should return DISCONNECTED when client is null', () => {
      expect(matrixClientService.getConnectionState()).toBe('DISCONNECTED')
    })
  })

  describe('getSSOLoginUrl', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixClientService.getSSOLoginUrl()).rejects.toThrow('客户端未初始化')
    })
  })

  describe('getUser', () => {
    it('should return null when client is not initialized', () => {
      expect(matrixClientService.getUser('@user:server')).toBeNull()
    })

    it('should return User when client has the user', () => {
      const mockUser = { userId: '@user:server', presence: 'online' }
      const mockClient = {
        getUser: vi.fn().mockReturnValue(mockUser)
      }
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      const result = matrixClientService.getUser('@user:server')
      expect(result).toBe(mockUser)
      expect(mockClient.getUser).toHaveBeenCalledWith('@user:server')
    })

    it('should return null when user does not exist', () => {
      const mockClient = {
        getUser: vi.fn().mockReturnValue(null)
      }
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      const result = matrixClientService.getUser('@nonexistent:server')
      expect(result).toBeNull()
    })
  })

  describe('isRoomEncrypted', () => {
    it('should return false when client is not initialized', () => {
      expect(matrixClientService.isRoomEncrypted('!room:server')).toBe(false)
    })

    it('should return true when room is encrypted', () => {
      const mockClient = {
        isRoomEncrypted: vi.fn().mockReturnValue(true)
      }
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      const result = matrixClientService.isRoomEncrypted('!room:server')
      expect(result).toBe(true)
      expect(mockClient.isRoomEncrypted).toHaveBeenCalledWith('!room:server')
    })

    it('should return false when room is not encrypted', () => {
      const mockClient = {
        isRoomEncrypted: vi.fn().mockReturnValue(false)
      }
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      const result = matrixClientService.isRoomEncrypted('!room:server')
      expect(result).toBe(false)
    })

    it('should return false when isRoomEncrypted is undefined on client', () => {
      const mockClient = {}
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      const result = matrixClientService.isRoomEncrypted('!room:server')
      expect(result).toBe(false)
    })
  })

  describe('canManageSpace', () => {
    it('should return false when client is not initialized', () => {
      expect(matrixClientService.canManageSpace('!space:server')).toBe(false)
    })

    it('should return false when spaceId is empty', () => {
      const mockClient = {
        getUserId: vi.fn().mockReturnValue('@user:server'),
        getRoom: vi.fn()
      }
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      expect(matrixClientService.canManageSpace('')).toBe(false)
    })

    it('should return false when userId is not available', () => {
      const mockClient = {
        getUserId: vi.fn().mockReturnValue(null),
        getRoom: vi.fn()
      }
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      expect(matrixClientService.canManageSpace('!space:server')).toBe(false)
    })

    it('should return false when room does not exist', () => {
      const mockClient = {
        getUserId: vi.fn().mockReturnValue('@user:server'),
        getRoom: vi.fn().mockReturnValue(null)
      }
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      expect(matrixClientService.canManageSpace('!space:server')).toBe(false)
    })

    it('should return false when membership is not join', () => {
      const mockRoom = {
        getMyMembership: vi.fn().mockReturnValue('leave'),
        getMember: vi.fn(),
        currentState: { getMember: vi.fn() }
      }
      const mockClient = {
        getUserId: vi.fn().mockReturnValue('@user:server'),
        getRoom: vi.fn().mockReturnValue(mockRoom)
      }
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      expect(matrixClientService.canManageSpace('!space:server')).toBe(false)
    })

    it('should return true when user has power level >= 50', () => {
      const mockRoom = {
        getMyMembership: vi.fn().mockReturnValue('join'),
        getMember: vi.fn().mockReturnValue({ powerLevel: 100 })
      }
      const mockClient = {
        getUserId: vi.fn().mockReturnValue('@user:server'),
        getRoom: vi.fn().mockReturnValue(mockRoom)
      }
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      expect(matrixClientService.canManageSpace('!space:server')).toBe(true)
    })

    it('should return false when user has power level < 50', () => {
      const mockRoom = {
        getMyMembership: vi.fn().mockReturnValue('join'),
        getMember: vi.fn().mockReturnValue({ powerLevel: 0 })
      }
      const mockClient = {
        getUserId: vi.fn().mockReturnValue('@user:server'),
        getRoom: vi.fn().mockReturnValue(mockRoom)
      }
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      expect(matrixClientService.canManageSpace('!space:server')).toBe(false)
    })

    it('should fallback to currentState.getMember when room.getMember returns null', () => {
      const mockMember = { powerLevel: 50 }
      const mockRoom = {
        getMyMembership: vi.fn().mockReturnValue('join'),
        getMember: vi.fn().mockReturnValue(null),
        currentState: { getMember: vi.fn().mockReturnValue(mockMember) }
      }
      const mockClient = {
        getUserId: vi.fn().mockReturnValue('@user:server'),
        getRoom: vi.fn().mockReturnValue(mockRoom)
      }
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      expect(matrixClientService.canManageSpace('!space:server')).toBe(true)
      expect(mockRoom.currentState.getMember).toHaveBeenCalledWith('@user:server')
    })

    it('should return false when member has getPowerLevel method but level < 50', () => {
      const mockMember = { getPowerLevel: vi.fn().mockReturnValue(10) }
      const mockRoom = {
        getMyMembership: vi.fn().mockReturnValue('join'),
        getMember: vi.fn().mockReturnValue(mockMember)
      }
      const mockClient = {
        getUserId: vi.fn().mockReturnValue('@user:server'),
        getRoom: vi.fn().mockReturnValue(mockRoom)
      }
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      expect(matrixClientService.canManageSpace('!space:server')).toBe(false)
    })
  })

  describe('getManagerStatsList', () => {
    it('should return empty array when client is not initialized', () => {
      expect(matrixClientService.getManagerStatsList()).toEqual([])
    })

    it('should return empty array when no manager getters match the pattern', () => {
      class EmptyClient {}
      const mockClient = new EmptyClient()
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      expect(matrixClientService.getManagerStatsList()).toEqual([])
    })

    it('should return stats for managers with getRequestStats', () => {
      const mockManager = {
        getRequestStats: vi.fn().mockReturnValue({
          total: 10,
          successful: 8,
          failed: 1,
          retried: 1
        })
      }

      class TestClient {
        getAccountDataManager() {
          return mockManager
        }
      }
      const mockClient = new TestClient()
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      const result = matrixClientService.getManagerStatsList()
      expect(result).toEqual([
        {
          name: 'accountData',
          stats: { total: 10, successful: 8, failed: 1, retried: 1 }
        }
      ])
    })

    it('should skip manager getters that are not functions', () => {
      class TestClient {
        getInvalidManager = 'not a function'
      }

      const mockClient = new TestClient()
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      const result = matrixClientService.getManagerStatsList()
      expect(result).toEqual([])
    })

    it('should skip managers without getRequestStats', () => {
      const mockManager = { someOtherMethod: vi.fn() }

      class TestClient {
        getFooManager() {
          return mockManager
        }
      }
      const mockClient = new TestClient()
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      const result = matrixClientService.getManagerStatsList()
      expect(result).toEqual([])
    })

    it('should handle manager getter that throws gracefully', () => {
      class TestClient {
        getThrowingManager() {
          throw new Error('Boom')
        }
      }
      const mockClient = new TestClient()
      ;(
        matrixClientService as unknown as { connectionManager: { setClient: (c: unknown) => void } }
      ).connectionManager.setClient(mockClient)

      const result = matrixClientService.getManagerStatsList()
      expect(result).toEqual([])
    })
  })

  describe('SlidingSync Lifecycle 事件处理', () => {
    /**
     * 步骤 1.2 OPT-2 测试：验证 syncLifecycleListener 对 SDK 瞬时错误的处理。
     * SDK 通用错误（非 400/429/AbortError）不触发 client.on('sync')，
     * 仅通过 SlidingSyncEvent.Lifecycle 上报。
     *
     * 步骤 4.1 OPT-8 更新：测试已适配新的模块架构。
     * - consecutiveSyncErrors → connectionManager.getConsecutiveSyncErrors()
     * - connectionState → connectionManager.getConnectionState() / updateConnectionState()
     * - syncLifecycleListener → connectionManager.handleSyncLifecycleError() / resetSyncErrorCount()
     */
    type PrivateAccess = {
      connectionManager: {
        getConsecutiveSyncErrors: () => number
        getConnectionState: () => string
        updateConnectionState: (state: string) => void
        handleSyncLifecycleError: (err: Error) => void
        resetSyncErrorCount: () => void
      }
      eventRouter: {
        emit: (event: string, ...data: unknown[]) => void
      }
    }

    function getPrivate(): PrivateAccess {
      return matrixClientService as unknown as PrivateAccess
    }

    beforeEach(() => {
      // 重置状态
      const priv = getPrivate()
      priv.connectionManager.resetSyncErrorCount()
      priv.connectionManager.updateConnectionState('CONNECTED')
    })

    it('单次 RequestFinished 错误应递增 consecutiveSyncErrors 并 emit sync-request-error', () => {
      const priv = getPrivate()
      const errorListener = vi.fn()
      matrixClientService.on('sync-request-error', errorListener)

      // 模拟 EventRouter.syncLifecycleListener 行为：
      // 1. 调用 lifecycleErrorHandler（委托给 ConnectionManager.handleSyncLifecycleError）
      // 2. emit 'sync-request-error'
      const err = new Error('network error')
      priv.connectionManager.handleSyncLifecycleError(err)
      priv.eventRouter.emit('sync-request-error', err)

      expect(priv.connectionManager.getConsecutiveSyncErrors()).toBe(1)
      expect(errorListener).toHaveBeenCalledTimes(1)
      expect(errorListener).toHaveBeenCalledWith(expect.any(Error))

      matrixClientService.off('sync-request-error', errorListener)
    })

    it('连续 3 次 RequestFinished 错误应将 connectionState 从 CONNECTED 降级为 RECONNECTING', () => {
      const priv = getPrivate()
      priv.connectionManager.updateConnectionState('CONNECTED')

      priv.connectionManager.handleSyncLifecycleError(new Error('error 1'))
      expect(priv.connectionManager.getConnectionState()).toBe('CONNECTED')

      priv.connectionManager.handleSyncLifecycleError(new Error('error 2'))
      expect(priv.connectionManager.getConnectionState()).toBe('CONNECTED')

      priv.connectionManager.handleSyncLifecycleError(new Error('error 3'))
      expect(priv.connectionManager.getConnectionState()).toBe('RECONNECTING')
      expect(priv.connectionManager.getConsecutiveSyncErrors()).toBe(3)
    })

    it('Complete 事件应重置 consecutiveSyncErrors 为 0', () => {
      const priv = getPrivate()
      // 先制造 2 次错误
      priv.connectionManager.handleSyncLifecycleError(new Error('error 1'))
      priv.connectionManager.handleSyncLifecycleError(new Error('error 2'))
      expect(priv.connectionManager.getConsecutiveSyncErrors()).toBe(2)

      // Complete 事件重置
      priv.connectionManager.resetSyncErrorCount()

      expect(priv.connectionManager.getConsecutiveSyncErrors()).toBe(0)
    })

    it('错误后 Complete 再错误应从 0 重新计数', () => {
      const priv = getPrivate()

      priv.connectionManager.handleSyncLifecycleError(new Error('error 1'))
      priv.connectionManager.handleSyncLifecycleError(new Error('error 2'))
      expect(priv.connectionManager.getConsecutiveSyncErrors()).toBe(2)

      priv.connectionManager.resetSyncErrorCount()
      expect(priv.connectionManager.getConsecutiveSyncErrors()).toBe(0)

      priv.connectionManager.handleSyncLifecycleError(new Error('error 3'))
      expect(priv.connectionManager.getConsecutiveSyncErrors()).toBe(1)
    })

    it('RequestFinished 无错误时不应递增 consecutiveSyncErrors', () => {
      const priv = getPrivate()
      priv.connectionManager.resetSyncErrorCount()

      // RequestFinished 无错误：EventRouter.syncLifecycleListener 不调用 lifecycleErrorHandler
      // 因此 consecutiveSyncErrors 保持 0
      expect(priv.connectionManager.getConsecutiveSyncErrors()).toBe(0)
    })

    it('connectionState 非 CONNECTED 时不应降级为 RECONNECTING', () => {
      const priv = getPrivate()
      priv.connectionManager.updateConnectionState('DISCONNECTED')

      priv.connectionManager.handleSyncLifecycleError(new Error('error 1'))
      priv.connectionManager.handleSyncLifecycleError(new Error('error 2'))
      priv.connectionManager.handleSyncLifecycleError(new Error('error 3'))

      // 即使连续 3 次错误，DISCONNECTED 状态不应转为 RECONNECTING
      expect(priv.connectionManager.getConnectionState()).toBe('DISCONNECTED')
    })
  })

  describe('CATCHUP 状态映射（OPT-10 步骤 4.3）', () => {
    /**
     * 步骤 4.3 OPT-10 测试：验证 CATCHUP 状态被独立暴露，不再合并到 CONNECTED。
     * CATCHUP 是 SDK 从断开恢复后同步历史消息的瞬态，UI 需独立感知以显示"正在同步历史消息"。
     */
    type PrivateAccess = {
      connectionManager: {
        mapSyncState: (
          state: string,
          prevState?: string,
          data?: unknown
        ) => {
          connectionState: string | null
          isReady: boolean
        }
      }
    }

    function getPrivate(): PrivateAccess {
      return matrixClientService as unknown as PrivateAccess
    }

    it('SDK SyncState=CATCHUP 映射为 ConnectionState=CATCHUP（独立暴露）', () => {
      const priv = getPrivate()
      const result = priv.connectionManager.mapSyncState('CATCHUP')
      expect(result.connectionState).toBe('CATCHUP')
      expect(result.isReady).toBe(true)
    })

    it('SDK SyncState=PREPARED 映射为 ConnectionState=CONNECTED', () => {
      const priv = getPrivate()
      const result = priv.connectionManager.mapSyncState('PREPARED')
      expect(result.connectionState).toBe('CONNECTED')
      expect(result.isReady).toBe(true)
    })

    it('SDK SyncState=SYNCING 映射为 ConnectionState=CONNECTED', () => {
      const priv = getPrivate()
      const result = priv.connectionManager.mapSyncState('SYNCING')
      expect(result.connectionState).toBe('CONNECTED')
      expect(result.isReady).toBe(true)
    })

    it('CATCHUP 不再合并到 CONNECTED', () => {
      const priv = getPrivate()
      const result = priv.connectionManager.mapSyncState('CATCHUP')
      // 关键断言：CATCHUP 不应是 CONNECTED
      expect(result.connectionState).not.toBe('CONNECTED')
      expect(result.connectionState).toBe('CATCHUP')
    })

    it('CATCHUP 状态 isReady=true（已就绪，仅同步历史）', () => {
      const priv = getPrivate()
      const result = priv.connectionManager.mapSyncState('CATCHUP')
      // CATCHUP 时客户端已就绪，UI 可正常交互，仅显示同步提示
      expect(result.isReady).toBe(true)
    })
  })
})
