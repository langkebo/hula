import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { MatrixClientLifecycle } from '@/services/matrix/MatrixClientLifecycle'
import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
import { AvatarUtils } from '@/utils/AvatarUtils'

// ---- 依赖 mock（白盒：不依赖真实 SDK / 网络）-----------------------------------

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), trace: vi.fn() })
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('@/services/matrix/matrixClientPlatform', () => ({
  persistRefreshedToken: vi.fn(),
  setupSystemResumeListener: vi.fn()
}))

vi.mock('@/types/matrix-js-sdk', () => ({
  PendingEventOrdering: { Detached: 'detached' }
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: { setMxcResolver: vi.fn() }
}))

vi.mock('@/services/matrix/paths', () => ({
  PREFIX_V3: '/_matrix/client/v3'
}))

vi.mock('@/services/matrix/network/runtimeFetch', () => ({
  getRuntimeAwareFetch: vi.fn()
}))

// ---- 测试工具 ----------------------------------------------------------------

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    isSlidingSyncSupported: vi.fn(async () => true),
    startClient: vi.fn(async () => undefined),
    stopClient: vi.fn(),
    mxcUrlToHttp: vi.fn(() => 'http://resolved'),
    getDeviceId: vi.fn(() => 'DEV1'),
    ...overrides
  }
}

function makeConnectionManager() {
  const cm = {
    client: null as ReturnType<typeof makeClient> | null,
    config: null as Record<string, unknown> | null,
    getClient: vi.fn(),
    getConfig: vi.fn(),
    shouldReuse: vi.fn(() => false),
    initialize: vi.fn(async () => undefined),
    setupResumeListener: vi.fn(),
    getConnectionState: vi.fn(() => 'CONNECTED'),
    updateConnectionState: vi.fn(),
    mapSyncState: vi.fn(() => ({ connectionState: undefined, isReady: false })),
    handleSyncLifecycleError: vi.fn(),
    resetSyncErrorCount: vi.fn(),
    waitForClientReady: vi.fn<() => Promise<ReturnType<typeof makeClient> | null>>(async () => null)
  }
  cm.getClient.mockImplementation(() => cm.client)
  cm.getConfig.mockImplementation(() => cm.config)
  return cm
}

function makeEventRouter() {
  return {
    getObservedClient: vi.fn<() => ReturnType<typeof makeClient> | null>(() => null),
    detach: vi.fn(),
    setup: vi.fn(),
    setSyncStateHandler: vi.fn(),
    setLifecycleErrorHandler: vi.fn(),
    setLifecycleResetHandler: vi.fn(),
    setEventDecryptedHandler: vi.fn()
  }
}

function makeSyncManager() {
  const slidingSync = { test: true }
  const syncManager: {
    stop: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
    resetReady: ReturnType<typeof vi.fn>
    markReady: ReturnType<typeof vi.fn>
    waitForReady: ReturnType<typeof vi.fn>
    syncObj: unknown
  } = {
    stop: vi.fn(),
    create: vi.fn(() => {
      syncManager.syncObj = slidingSync
    }),
    get: vi.fn(() => syncManager.syncObj),
    resetReady: vi.fn(),
    markReady: vi.fn(),
    waitForReady: vi.fn(async () => true),
    syncObj: null
  }
  return syncManager
}

function makeGuard() {
  return {
    run: vi.fn(async (factory: () => Promise<void>) => factory()),
    reset: vi.fn(),
    isSettled: false
  }
}

function makeLifecycle(overrides: Record<string, unknown> = {}) {
  const connectionManager = makeConnectionManager()
  const eventRouter = makeEventRouter()
  const syncManager = makeSyncManager()
  const cryptoTracker = {
    resetState: vi.fn(),
    ensureCrypto: vi.fn(async () => undefined),
    handleEventDecrypted: vi.fn()
  }
  const tokenManager = { clear: vi.fn(), schedule: vi.fn() }
  const startClientGuard = makeGuard()
  const deps = {
    connectionManager,
    eventRouter,
    syncManager,
    cryptoTracker,
    tokenManager,
    startClientGuard,
    ...overrides
  }
  const lifecycle = new MatrixClientLifecycle(deps as never)
  return { lifecycle, deps, connectionManager, eventRouter, syncManager, cryptoTracker, tokenManager, startClientGuard }
}

describe('MatrixClientLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initialize', () => {
    it('shouldReuse=false 时清理旧监听器并初始化新 client', async () => {
      const { lifecycle, connectionManager, eventRouter, syncManager, cryptoTracker, startClientGuard } =
        makeLifecycle()
      const observed = makeClient()
      const newClient = makeClient()
      eventRouter.getObservedClient.mockReturnValue(observed)
      connectionManager.client = newClient
      connectionManager.config = { homeserverUrl: 'https://hs', accessToken: 'tok' }

      await lifecycle.initialize({ homeserverUrl: 'https://hs', accessToken: 'tok' } as never)

      expect(eventRouter.detach).toHaveBeenCalledWith(observed, syncManager)
      expect(syncManager.stop).toHaveBeenCalled()
      expect(cryptoTracker.resetState).toHaveBeenCalled()
      expect(startClientGuard.reset).toHaveBeenCalled()
      expect(connectionManager.initialize).toHaveBeenCalled()
      expect(AvatarUtils.setMxcResolver).toHaveBeenCalled()
    })

    it('shouldReuse=true 时跳过清理直接初始化', async () => {
      const { lifecycle, connectionManager, eventRouter, syncManager, cryptoTracker, startClientGuard } =
        makeLifecycle()
      connectionManager.shouldReuse.mockReturnValue(true)
      connectionManager.client = makeClient()

      await lifecycle.initialize({ homeserverUrl: 'https://hs' } as never)

      expect(eventRouter.detach).not.toHaveBeenCalled()
      expect(syncManager.stop).not.toHaveBeenCalled()
      expect(cryptoTracker.resetState).not.toHaveBeenCalled()
      expect(startClientGuard.reset).not.toHaveBeenCalled()
    })

    it('fallback 重建检测：client 引用变化且已 settled 时补做清理', async () => {
      const { lifecycle, connectionManager, eventRouter, syncManager, cryptoTracker, startClientGuard } =
        makeLifecycle()
      const prevClient = makeClient()
      connectionManager.client = makeClient() // 与 previousClient 不同
      connectionManager.shouldReuse.mockReturnValue(true)
      startClientGuard.isSettled = true

      // previousClient 在 initialize 前通过 getClient 获取
      connectionManager.getClient.mockReturnValueOnce(prevClient).mockReturnValue(connectionManager.client)

      await lifecycle.initialize({ homeserverUrl: 'https://hs' } as never)

      expect(eventRouter.detach).toHaveBeenCalledWith(prevClient, syncManager)
      expect(syncManager.stop).toHaveBeenCalled()
      expect(cryptoTracker.resetState).toHaveBeenCalled()
      expect(startClientGuard.reset).toHaveBeenCalled()
    })

    it('无 client 时不注册 mxc resolver', async () => {
      const { lifecycle, connectionManager } = makeLifecycle()
      connectionManager.client = null
      await lifecycle.initialize({ homeserverUrl: 'https://hs' } as never)
      expect(AvatarUtils.setMxcResolver).not.toHaveBeenCalled()
    })
  })

  describe('startClient', () => {
    const baseConfig = () => ({ homeserverUrl: 'https://hs', accessToken: 'tok' })

    it('无 client 时抛出未初始化错误', async () => {
      const { lifecycle } = makeLifecycle()
      await expect(lifecycle.startClient()).rejects.toThrow('matrix_error.common.client_not_initialized')
    })

    it('Sliding Sync 可用时创建实例并启动', async () => {
      const made = makeLifecycle()
      const { lifecycle, connectionManager, eventRouter, syncManager, cryptoTracker } = made
      connectionManager.client = makeClient()
      connectionManager.config = baseConfig()

      await lifecycle.startClient()

      expect(syncManager.create).toHaveBeenCalled()
      expect(syncManager.resetReady).toHaveBeenCalled()
      expect(syncManager.get).toHaveBeenCalled()
      expect(cryptoTracker.ensureCrypto).toHaveBeenCalled()
      expect(eventRouter.setSyncStateHandler).toHaveBeenCalled()
      expect(eventRouter.setLifecycleErrorHandler).toHaveBeenCalled()
      expect(eventRouter.setLifecycleResetHandler).toHaveBeenCalled()
      expect(eventRouter.setEventDecryptedHandler).toHaveBeenCalled()
      expect(eventRouter.setup).toHaveBeenCalled()
      expect(connectionManager.getClient().startClient).toHaveBeenCalledWith(
        expect.objectContaining({ slidingSync: expect.any(Object) })
      )
    })

    it('Sliding Sync 不可用时降级到传统 /sync', async () => {
      const { lifecycle, connectionManager, syncManager, client } = makeStartClientEnv()
      client.isSlidingSyncSupported.mockResolvedValue(false)
      connectionManager.config = baseConfig()

      await lifecycle.startClient()

      expect(syncManager.stop).toHaveBeenCalled()
      expect(syncManager.create).not.toHaveBeenCalled()
      expect(client.startClient).toHaveBeenCalled()
    })

    it('Sliding Sync 探测抛错时保守降级', async () => {
      const { lifecycle, connectionManager, syncManager, client } = makeStartClientEnv()
      client.isSlidingSyncSupported.mockRejectedValue(new Error('probe failed'))
      connectionManager.config = baseConfig()

      await lifecycle.startClient()

      expect(syncManager.stop).toHaveBeenCalled()
      expect(syncManager.create).not.toHaveBeenCalled()
    })

    it('无 accessToken 时直接停止 sync', async () => {
      const { lifecycle, connectionManager, syncManager } = makeStartClientEnv()
      connectionManager.config = { homeserverUrl: 'https://hs' }

      await lifecycle.startClient()

      expect(syncManager.stop).toHaveBeenCalled()
      expect(syncManager.create).not.toHaveBeenCalled()
    })

    it('启动失败时置 ERROR 状态并重新抛出', async () => {
      const { lifecycle, connectionManager, client } = makeStartClientEnv()
      connectionManager.config = baseConfig()
      client.startClient.mockRejectedValue(new Error('start failed'))

      await expect(lifecycle.startClient()).rejects.toThrow('start failed')
      expect(connectionManager.updateConnectionState).toHaveBeenCalledWith('ERROR')
    })
  })

  describe('stopClient', () => {
    it('有 client 时注销监听器并停止', async () => {
      const made = makeLifecycle()
      const { lifecycle, connectionManager, eventRouter, syncManager, tokenManager, startClientGuard } = made
      const client = makeClient()
      connectionManager.client = client

      await lifecycle.stopClient()

      expect(tokenManager.clear).toHaveBeenCalled()
      expect(eventRouter.detach).toHaveBeenCalledWith(client, syncManager)
      expect(syncManager.stop).toHaveBeenCalled()
      expect(client.stopClient).toHaveBeenCalled()
      expect(AvatarUtils.setMxcResolver).toHaveBeenCalledWith(null)
      expect(connectionManager.updateConnectionState).toHaveBeenCalledWith('DISCONNECTED')
      expect(startClientGuard.reset).toHaveBeenCalled()
    })

    it('无 client 时仅清理 token 并返回', async () => {
      const { lifecycle, tokenManager, eventRouter } = makeLifecycle()
      await lifecycle.stopClient()
      expect(tokenManager.clear).toHaveBeenCalled()
      expect(eventRouter.detach).not.toHaveBeenCalled()
    })

    it('停止失败时重新抛出', async () => {
      const { lifecycle, connectionManager, client } = makeStartClientEnv()
      connectionManager.client = client
      client.stopClient.mockImplementation(() => {
        throw new Error('stop failed')
      })

      await expect(lifecycle.stopClient()).rejects.toThrow('stop failed')
    })
  })

  describe('waitForClientReady / waitForSlidingSyncReady', () => {
    it('waitForClientReady 委托给 connectionManager', async () => {
      const { lifecycle, connectionManager } = makeLifecycle()
      const client = makeClient()
      connectionManager.waitForClientReady.mockResolvedValue(client)
      const result = await lifecycle.waitForClientReady({ timeoutMs: 100 })
      expect(connectionManager.waitForClientReady).toHaveBeenCalledWith({ timeoutMs: 100 })
      expect(result).toBe(client)
    })

    it('waitForSlidingSyncReady 委托给 syncManager', async () => {
      const { lifecycle, syncManager } = makeLifecycle()
      const result = await lifecycle.waitForSlidingSyncReady(5000)
      expect(syncManager.waitForReady).toHaveBeenCalledWith(5000)
      expect(result).toBe(true)
    })
  })

  describe('resolveDeviceIdByWhoami', () => {
    type FetchMock = Mock<(...args: unknown[]) => Promise<unknown>>
    const getRuntimeAwareFetchMock = getRuntimeAwareFetch as unknown as Mock<() => FetchMock>

    beforeEach(() => {
      getRuntimeAwareFetchMock.mockReset()
      getRuntimeAwareFetchMock.mockReturnValue(vi.fn() as FetchMock)
    })

    it('ok 且含 device_id 时返回 device_id', async () => {
      const fetchMock = getRuntimeAwareFetchMock() as Mock<(...args: unknown[]) => Promise<unknown>>
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ device_id: 'WHOAMI-DEV' }) })

      const { lifecycle } = makeLifecycle()
      const result = await lifecycle.resolveDeviceIdByWhoami('tok', 'https://hs/')

      expect(fetchMock).toHaveBeenCalledWith('https://hs/_matrix/client/v3/account/whoami', {
        method: 'GET',
        headers: { Authorization: 'Bearer tok' }
      })
      expect(result).toBe('WHOAMI-DEV')
    })

    it('ok 但无 device_id 时返回 undefined', async () => {
      const fetchMock = getRuntimeAwareFetchMock() as Mock<(...args: unknown[]) => Promise<unknown>>
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ user_id: '@u' }) })

      const { lifecycle } = makeLifecycle()
      expect(await lifecycle.resolveDeviceIdByWhoami('tok', 'https://hs')).toBeUndefined()
    })

    it('非 ok 响应时返回 undefined', async () => {
      const fetchMock = getRuntimeAwareFetchMock() as Mock<(...args: unknown[]) => Promise<unknown>>
      fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })

      const { lifecycle } = makeLifecycle()
      expect(await lifecycle.resolveDeviceIdByWhoami('tok', 'https://hs')).toBeUndefined()
    })

    it('fetch 异常时返回 undefined', async () => {
      const fetchMock = getRuntimeAwareFetchMock() as Mock<(...args: unknown[]) => Promise<unknown>>
      fetchMock.mockRejectedValue(new Error('network error'))

      const { lifecycle } = makeLifecycle()
      expect(await lifecycle.resolveDeviceIdByWhoami('tok', 'https://hs')).toBeUndefined()
    })
  })

  describe('系统恢复重连 (forceReconnect)', () => {
    it('CONNECTED 状态下系统恢复时重建滑动同步并重启', async () => {
      vi.useFakeTimers()
      const made = makeLifecycle()
      const { lifecycle, connectionManager, eventRouter, syncManager } = made
      const client = makeClient()
      connectionManager.client = client
      connectionManager.config = { homeserverUrl: 'https://hs', accessToken: 'tok' }

      // 进入 doStartClient 以注册 resume listener，然后触发 onResume
      const startPromise = lifecycle.startClient()
      await vi.advanceTimersByTimeAsync(0)
      await startPromise

      const resumeCall = connectionManager.setupResumeListener.mock.calls[0]
      expect(resumeCall).toBeDefined()
      const onResume = resumeCall[0] as () => void

      // 触发系统恢复回调 → forceReconnect
      onResume()
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(0)

      expect(connectionManager.updateConnectionState).toHaveBeenCalledWith('RECONNECTING')
      expect(eventRouter.detach).toHaveBeenCalledWith(client, syncManager)
      expect(syncManager.create).toHaveBeenCalled()
      expect(eventRouter.setup).toHaveBeenCalled()
      expect(client.startClient).toHaveBeenCalled()
    })
  })
})

// 辅助：构造带 client 的 startClient 环境
function makeStartClientEnv() {
  const made = makeLifecycle()
  const client = makeClient()
  made.connectionManager.client = client
  return { ...made, client }
}
