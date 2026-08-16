import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetConnectionManagerSingletonForTesting,
  getMatrixConnectionManager,
  type MatrixClientConfig,
  MatrixConnectionManager
} from '../MatrixConnectionManager'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@/utils/telemetry', () => ({
  track: vi.fn()
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => false
}))

vi.mock('@/services/backend', () => ({
  resolveMatrixRuntimeHomeserverUrl: (url: string) => url
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('@/services/matrix/extensions/managerExtensions', () => ({
  isFriendManagerRegistered: () => true
}))

vi.mock('@/services/matrix/matrixClientAccessor', () => ({
  setMatrixClientAccessor: vi.fn()
}))

vi.mock('@/services/matrix/network/runtimeFetch', () => ({
  getRuntimeAwareFetchFn: () => undefined
}))

vi.mock('@/services/matrix/sdk', () => ({
  createClient: vi.fn().mockImplementation((opts: unknown) => ({
    baseUrl: (opts as { baseUrl?: string }).baseUrl,
    getAccessToken: () => 'token',
    getHomeserverUrl: () => 'https://matrix.test',
    setAccessToken: vi.fn(),
    whenManagerExtensionsReady: vi.fn().mockResolvedValue(undefined)
  })),
  initializeManagerExtensions: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/stores/domains/chat/capability', () => ({
  useCapabilityStore: vi.fn().mockReturnValue({
    setExtensionHealthBatch: vi.fn()
  })
}))

const baseConfig: MatrixClientConfig = {
  homeserverUrl: 'https://matrix.test',
  accessToken: 'token-1',
  userId: '@alice:matrix.test',
  deviceId: 'DEV1'
}

describe('MatrixConnectionManager', () => {
  let manager: MatrixConnectionManager

  beforeEach(() => {
    __resetConnectionManagerSingletonForTesting()
    manager = new MatrixConnectionManager()
    sessionStorage.clear()
  })

  afterEach(() => {
    __resetConnectionManagerSingletonForTesting()
  })

  describe('initial state', () => {
    it('starts in DISCONNECTED state', () => {
      expect(manager.getConnectionState()).toBe('DISCONNECTED')
    })

    it('has null client initially', () => {
      expect(manager.getClient()).toBeNull()
    })

    it('has null config initially', () => {
      expect(manager.getConfig()).toBeNull()
    })

    it('has zero consecutive sync errors', () => {
      expect(manager.getConsecutiveSyncErrors()).toBe(0)
    })
  })

  describe('initialize', () => {
    it('creates client and transitions to CONNECTING', async () => {
      await manager.initialize(baseConfig)

      expect(manager.getClient()).not.toBeNull()
      expect(manager.getConnectionState()).toBe('CONNECTING')
      expect(manager.getConfig()).toEqual(baseConfig)
    })

    it('reuses existing client when identity is equivalent and token unchanged', async () => {
      await manager.initialize(baseConfig)
      const firstClient = manager.getClient()

      await manager.initialize({ ...baseConfig })

      expect(manager.getClient()).toBe(firstClient)
    })

    it('updates token in-place when identity is equivalent but accessToken changes', async () => {
      await manager.initialize(baseConfig)
      const firstClient = manager.getClient()
      const setAccessTokenSpy = vi.spyOn(
        firstClient as unknown as { setAccessToken: (t: string) => void },
        'setAccessToken'
      )

      await manager.initialize({ ...baseConfig, accessToken: 'token-2' })

      expect(manager.getClient()).toBe(firstClient)
      expect(setAccessTokenSpy).toHaveBeenCalledWith('token-2')
      expect(manager.getConfig()?.accessToken).toBe('token-2')
    })

    it('rebuilds client when identity (deviceId) changes', async () => {
      await manager.initialize(baseConfig)
      const firstClient = manager.getClient()

      await manager.initialize({ ...baseConfig, deviceId: 'DEV2' })

      expect(manager.getClient()).not.toBe(firstClient)
    })

    it('rebuilds client when homeserverUrl changes', async () => {
      await manager.initialize(baseConfig)
      const firstClient = manager.getClient()

      await manager.initialize({ ...baseConfig, homeserverUrl: 'https://other.test' })

      expect(manager.getClient()).not.toBe(firstClient)
    })

    it('rebuilds client when userId changes', async () => {
      await manager.initialize(baseConfig)
      const firstClient = manager.getClient()

      await manager.initialize({ ...baseConfig, userId: '@bob:matrix.test' })

      expect(manager.getClient()).not.toBe(firstClient)
    })

    it('transitions to ERROR when createClient throws', async () => {
      const { createClient } = await import('@/services/matrix/sdk')
      vi.mocked(createClient).mockImplementationOnce(() => {
        throw new Error('create failed')
      })

      await expect(manager.initialize(baseConfig)).rejects.toThrow('create failed')
      expect(manager.getConnectionState()).toBe('ERROR')
    })

    it('continues initialization even when initializeManagerExtensions fails', async () => {
      const { initializeManagerExtensions } = await import('@/services/matrix/sdk')
      vi.mocked(initializeManagerExtensions).mockRejectedValueOnce(new Error('ext fail'))

      await manager.initialize(baseConfig)

      expect(manager.getClient()).not.toBeNull()
    })
  })

  describe('mapSyncState', () => {
    it('maps PREPARED to CONNECTED with isReady=true', () => {
      const result = manager.mapSyncState('PREPARED')
      expect(result).toEqual({ connectionState: 'CONNECTED', isReady: true })
    })

    it('maps SYNCING to CONNECTED with isReady=true', () => {
      const result = manager.mapSyncState('SYNCING')
      expect(result).toEqual({ connectionState: 'CONNECTED', isReady: true })
    })

    it('maps CATCHUP to CATCHUP with isReady=true', () => {
      const result = manager.mapSyncState('CATCHUP')
      expect(result).toEqual({ connectionState: 'CATCHUP', isReady: true })
    })

    it('maps RECONNECTING to RECONNECTING with isReady=false', () => {
      const result = manager.mapSyncState('RECONNECTING')
      expect(result).toEqual({ connectionState: 'RECONNECTING', isReady: false })
    })

    it('maps ERROR to ERROR with isReady=false', () => {
      const result = manager.mapSyncState('ERROR')
      expect(result).toEqual({ connectionState: 'ERROR', isReady: false })
    })

    it('maps STOPPED to DISCONNECTED with isReady=false', () => {
      const result = manager.mapSyncState('STOPPED')
      expect(result).toEqual({ connectionState: 'DISCONNECTED', isReady: false })
    })

    it('returns null connectionState for unknown state', () => {
      const result = manager.mapSyncState('UNKNOWN')
      expect(result).toEqual({ connectionState: null, isReady: false })
    })

    it('accepts prevState and data parameters without breaking', () => {
      const result = manager.mapSyncState('SYNCING', 'PREPARED', { some: 'data' })
      expect(result.isReady).toBe(true)
    })
  })

  describe('handleSyncLifecycleError', () => {
    it('increments error count', () => {
      expect(manager.getConsecutiveSyncErrors()).toBe(0)
      manager.handleSyncLifecycleError(new Error('e1'))
      expect(manager.getConsecutiveSyncErrors()).toBe(1)
      manager.handleSyncLifecycleError(new Error('e2'))
      expect(manager.getConsecutiveSyncErrors()).toBe(2)
    })

    it('does not downgrade to RECONNECTING before 3 errors', () => {
      const cb = vi.fn()
      manager.onStateChange(cb)
      manager.updateConnectionState('CONNECTED')

      manager.handleSyncLifecycleError(new Error('e1'))
      manager.handleSyncLifecycleError(new Error('e2'))

      expect(manager.getConnectionState()).toBe('CONNECTED')
      expect(cb).not.toHaveBeenCalledWith('RECONNECTING')
    })

    it('downgrades to RECONNECTING after 3 consecutive errors when CONNECTED', () => {
      const cb = vi.fn()
      manager.onStateChange(cb)
      manager.updateConnectionState('CONNECTED')

      manager.handleSyncLifecycleError(new Error('e1'))
      manager.handleSyncLifecycleError(new Error('e2'))
      manager.handleSyncLifecycleError(new Error('e3'))

      expect(manager.getConnectionState()).toBe('RECONNECTING')
      expect(cb).toHaveBeenCalledWith('RECONNECTING')
    })

    it('does not downgrade when not CONNECTED', () => {
      manager.updateConnectionState('CONNECTING')

      manager.handleSyncLifecycleError(new Error('e1'))
      manager.handleSyncLifecycleError(new Error('e2'))
      manager.handleSyncLifecycleError(new Error('e3'))

      expect(manager.getConnectionState()).toBe('CONNECTING')
    })
  })

  describe('resetSyncErrorCount', () => {
    it('resets error count to zero', () => {
      manager.handleSyncLifecycleError(new Error('e1'))
      manager.handleSyncLifecycleError(new Error('e2'))
      expect(manager.getConsecutiveSyncErrors()).toBe(2)

      manager.resetSyncErrorCount()
      expect(manager.getConsecutiveSyncErrors()).toBe(0)
    })
  })

  describe('updateConnectionState', () => {
    it('updates state and notifies subscribers', () => {
      const cb1 = vi.fn()
      const cb2 = vi.fn()
      manager.onStateChange(cb1)
      manager.onStateChange(cb2)

      manager.updateConnectionState('CONNECTING')

      expect(manager.getConnectionState()).toBe('CONNECTING')
      expect(cb1).toHaveBeenCalledWith('CONNECTING')
      expect(cb2).toHaveBeenCalledWith('CONNECTING')
    })

    it('does not notify when state is unchanged', () => {
      const cb = vi.fn()
      manager.onStateChange(cb)
      manager.updateConnectionState('DISCONNECTED')

      expect(cb).not.toHaveBeenCalled()
    })

    it('supports unsubscribe via offStateChange', () => {
      const cb = vi.fn()
      manager.onStateChange(cb)
      manager.offStateChange(cb)

      manager.updateConnectionState('CONNECTED')

      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe('setupResumeListener', () => {
    it('registers resume callback via provided registerFn', () => {
      const onResume = vi.fn()
      const unregister = vi.fn()
      const registerFn = vi.fn().mockReturnValue(unregister)

      manager.setupResumeListener(onResume, registerFn)

      expect(registerFn).toHaveBeenCalledWith(onResume)
    })

    it('cleans up previous listener when setting up a new one', () => {
      const unregister1 = vi.fn()
      const unregister2 = vi.fn()
      manager.setupResumeListener(vi.fn(), () => unregister1)
      manager.setupResumeListener(vi.fn(), () => unregister2)

      expect(unregister1).toHaveBeenCalled()
    })

    it('cleanupResumeListener invokes the unregister function', () => {
      const unregister = vi.fn()
      manager.setupResumeListener(vi.fn(), () => unregister)

      manager.cleanupResumeListener()

      expect(unregister).toHaveBeenCalled()
    })

    it('cleanupResumeListener is safe to call when no listener is set', () => {
      expect(() => manager.cleanupResumeListener()).not.toThrow()
    })
  })

  describe('waitForClientReady', () => {
    it('returns immediately when client is set', async () => {
      await manager.initialize(baseConfig)
      const client = await manager.waitForClientReady()
      expect(client).toBe(manager.getClient())
    })

    it('awaits whenManagerExtensionsReady before returning the client', async () => {
      await manager.initialize(baseConfig)
      const client = manager.getClient()!
      const whenManagerExtensionsReadySpy = vi.spyOn(client, 'whenManagerExtensionsReady')

      const resolved = await manager.waitForClientReady()

      expect(resolved).toBe(client)
      expect(whenManagerExtensionsReadySpy).toHaveBeenCalledTimes(1)
    })

    it('throws when client is not ready within timeout', async () => {
      await expect(manager.waitForClientReady({ timeoutMs: 100, intervalMs: 20 })).rejects.toThrow(
        'matrix_error.client.not_ready_timeout'
      )
    })

    it('polls until client becomes available', async () => {
      const promise = manager.waitForClientReady({ timeoutMs: 500, intervalMs: 30 })

      setTimeout(() => {
        manager.initialize(baseConfig)
      }, 60)

      const client = await promise
      expect(client).not.toBeNull()
    })
  })

  describe('shouldReuse', () => {
    it('returns false when no client initialized', () => {
      expect(manager.shouldReuse(baseConfig)).toBe(false)
    })

    it('returns true when identity fields match after initialization', async () => {
      await manager.initialize(baseConfig)
      expect(manager.shouldReuse(baseConfig)).toBe(true)
    })

    it('returns true when only accessToken differs', async () => {
      await manager.initialize(baseConfig)
      expect(manager.shouldReuse({ ...baseConfig, accessToken: 'different' })).toBe(true)
    })

    it('returns false when deviceId differs', async () => {
      await manager.initialize(baseConfig)
      expect(manager.shouldReuse({ ...baseConfig, deviceId: 'OTHER' })).toBe(false)
    })

    it('returns false when homeserverUrl differs', async () => {
      await manager.initialize(baseConfig)
      expect(manager.shouldReuse({ ...baseConfig, homeserverUrl: 'https://other.test' })).toBe(false)
    })
  })

  describe('setClient', () => {
    it('allows external client injection', () => {
      const fakeClient = { baseUrl: 'test' } as unknown as import('@/services/matrix/sdk').MatrixClient
      manager.setClient(fakeClient)
      expect(manager.getClient()).toBe(fakeClient)
    })

    it('allows setting to null', () => {
      manager.setClient(null)
      expect(manager.getClient()).toBeNull()
    })
  })

  describe('resetState', () => {
    it('clears client, config, and resets state', async () => {
      await manager.initialize(baseConfig)
      manager.updateConnectionState('CONNECTED')
      manager.handleSyncLifecycleError(new Error('e'))

      manager.resetState()

      expect(manager.getClient()).toBeNull()
      expect(manager.getConfig()).toBeNull()
      expect(manager.getConnectionState()).toBe('DISCONNECTED')
      expect(manager.getConsecutiveSyncErrors()).toBe(0)
    })

    it('cleans up resume listener during reset', () => {
      const unregister = vi.fn()
      manager.setupResumeListener(vi.fn(), () => unregister)

      manager.resetState()

      expect(unregister).toHaveBeenCalled()
    })
  })

  describe('getMatrixConnectionManager (singleton)', () => {
    it('returns the same instance on subsequent calls', () => {
      __resetConnectionManagerSingletonForTesting()
      const a = getMatrixConnectionManager()
      const b = getMatrixConnectionManager()
      expect(a).toBe(b)
    })

    it('creates a new instance after reset', () => {
      __resetConnectionManagerSingletonForTesting()
      const a = getMatrixConnectionManager()
      __resetConnectionManagerSingletonForTesting()
      const b = getMatrixConnectionManager()
      expect(a).not.toBe(b)
    })
  })
})
