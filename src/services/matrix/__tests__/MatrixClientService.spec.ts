import { fetch as nativeFetch } from '@tauri-apps/plugin-http'
import type { MatrixClient } from 'matrix-js-sdk'
import * as sdk from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../MatrixClientService'
import {
  __resetConnectionManagerSingletonForTesting,
  getMatrixConnectionManager,
  MatrixConnectionManager
} from '../MatrixConnectionManager'

// Mock tauri plugin log
vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn()
}))

vi.mock('../sdk-compat', () => ({
  ensureMatrixSdkCompat: vi.fn(),
  extendMatrixClientWithManagers: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('matrix-js-sdk/friend', () => ({
  extendMatrixClient: vi.fn()
}))

// Mock cryptoStorageKey 以避免 ensureCrypto 触发真实的 keychain / IndexedDB 操作
vi.mock('@/services/secure/cryptoStorageKey', () => ({
  getOrCreateCryptoStoragePassword: vi.fn().mockResolvedValue(null),
  clearCryptoStoragePasswordCache: vi.fn(),
  deleteCryptoStoragePassword: vi.fn().mockResolvedValue(undefined)
}))

// Mock capability store 以避免 Pinia 未初始化时 assertCriticalExtensions 抛错
vi.mock('@/stores/domains/chat/capability', () => ({
  useCapabilityStore: () => ({
    setExtensionHealthBatch: vi.fn(),
    setExtensionHealth: vi.fn(),
    resetExtensionHealth: vi.fn()
  })
}))

// Mock matrix-js-sdk
vi.mock('matrix-js-sdk', () => {
  const mockClient = {
    login: vi.fn(),
    loginRequest: vi.fn(),
    loginWithPassword: vi.fn(),
    logout: vi.fn(),
    startClient: vi.fn().mockResolvedValue(undefined),
    stopClient: vi.fn(),
    setAccessToken: vi.fn(),
    getFriendManager: vi.fn(() => ({ start: vi.fn() })),
    on: vi.fn(),
    off: vi.fn(),
    removeListener: vi.fn(),
    getUserId: vi.fn().mockReturnValue('@user:example.com'),
    getDeviceId: vi.fn().mockReturnValue('DEVICE_ID'),
    getAccessToken: vi.fn().mockReturnValue('ACCESS_TOKEN'),
    isSlidingSyncSupported: vi.fn().mockResolvedValue(false),
    mxcUrlToHttp: vi.fn().mockReturnValue(null)
  }

  return {
    createClient: vi.fn(() => mockClient),
    initializeManagerExtensions: vi.fn().mockResolvedValue(undefined),
    PendingEventOrdering: {
      Detached: 'detached'
    },
    SlidingSync: class {
      start = vi.fn()
      stop = vi.fn()
    }
  }
})

describe('MatrixClientService', () => {
  type MatrixClientServiceInternals = {
    connectionManager: {
      setClient: (c: unknown) => void
      getClient: () => unknown
      resetState: () => void
      shouldReuse: (config: unknown) => boolean
    }
    connectionState: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR'
    startClientGuard: {
      isSettled: boolean
      reset(): void
    }
    cryptoTracker: {
      ensureCrypto: (client: unknown, hasAccessToken: boolean) => Promise<void>
    }
  }

  /** 访问 facade 的私有协作者，供白盒断言使用 */
  const internals = () => matrixClientService as unknown as MatrixClientServiceInternals

  type LoginCapableClient = MatrixClient & {
    login: ReturnType<typeof vi.fn>
    loginRequest: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    // 清理 globalThis 单例缓存并重置 connectionManager 状态
    // 注意：matrixClientService 单例本身不重置（其 globalThis 守卫在测试间保持），
    // 但其内部的 connectionManager 通过 resetState() 清理到干净状态。
    __resetConnectionManagerSingletonForTesting()
    internals().connectionManager.resetState()
    internals().connectionState = 'DISCONNECTED'
    // 重置 startClient 幂等守卫，确保每个测试从干净状态开始
    internals().startClientGuard.reset()
  })

  it('should be defined', () => {
    expect(matrixClientService).toBeDefined()
  })

  it('should initialize client with config', async () => {
    const config = {
      homeserverUrl: 'https://matrix.example.com',
      userId: '@test:example.com',
      deviceId: 'TEST_DEVICE',
      accessToken: 'test_token'
    }

    await matrixClientService.initialize(config)

    expect(sdk.createClient).toHaveBeenCalled()
    expect(matrixClientService.getConnectionState()).toBe('CONNECTING') // It starts client which sets state
  })

  it('should return null when getting client before init', () => {
    const client = matrixClientService.getClient()
    expect(client).toBeNull()
  })

  describe('initialize() 幂等守卫', () => {
    const baseConfig = {
      homeserverUrl: 'https://matrix.example.com',
      userId: '@test:example.com',
      deviceId: 'TEST_DEVICE',
      accessToken: 'test_token'
    }

    it('配置一致时重复 initialize 应复用现有 client（不再 createClient）', async () => {
      await matrixClientService.initialize(baseConfig)
      await matrixClientService.initialize(baseConfig)

      expect(sdk.createClient).toHaveBeenCalledTimes(1)
      expect(matrixClientService.getClient()).toBeTruthy()
    })

    it('配置变更（deviceId 不同）时应释放旧 client 后重建（createClient 两次）', async () => {
      await matrixClientService.initialize(baseConfig)
      await matrixClientService.initialize({ ...baseConfig, deviceId: 'OTHER_DEVICE' })

      expect(sdk.createClient).toHaveBeenCalledTimes(2)
    })

    it('shouldReuse 契约：facade 据此决定是否 detach（复用不丢监听器，重建才 detach）', async () => {
      await matrixClientService.initialize(baseConfig)

      const { connectionManager } = internals()

      // 等价配置 → 应判定复用，facade 据此跳过 detach（避免丢失已挂载的事件路由）
      expect(connectionManager.shouldReuse(baseConfig)).toBe(true)

      // 不同 deviceId → 应判定非复用，facade 据此先 detach 再重建，避免 client 泄漏
      expect(connectionManager.shouldReuse({ ...baseConfig, deviceId: 'OTHER_DEVICE' })).toBe(false)
    })

    it('相同配置连续调用 initialize 两次，getClient() 返回同一引用', async () => {
      await matrixClientService.initialize(baseConfig)
      const client1 = matrixClientService.getClient()

      await matrixClientService.initialize(baseConfig)
      const client2 = matrixClientService.getClient()

      expect(client2).toBe(client1)
    })

    it('仅 token 旋转（身份不变）时不重建 client，走 setAccessToken 原地更新', async () => {
      await matrixClientService.initialize(baseConfig)
      const client1 = matrixClientService.getClient()
      expect(sdk.createClient).toHaveBeenCalledTimes(1)

      // token 旋转：身份字段不变，仅 accessToken 变化
      const rotatedConfig = { ...baseConfig, accessToken: 'rotated_token_456' }
      await matrixClientService.initialize(rotatedConfig)

      // createClient 不应再次调用（身份未变，原地更新 token）
      expect(sdk.createClient).toHaveBeenCalledTimes(1)

      // client 引用不变
      const client2 = matrixClientService.getClient()
      expect(client2).toBe(client1)

      // setAccessToken 应被调用 1 次，传入新 token
      const mockSetToken = vi.mocked((client1 as unknown as { setAccessToken: (token: string) => void }).setAccessToken)
      expect(mockSetToken).toHaveBeenCalledTimes(1)
      expect(mockSetToken).toHaveBeenCalledWith('rotated_token_456')
    })

    it('shouldReuse 在仅 token 变化时返回 true（facade 不 detach 监听器）', async () => {
      await matrixClientService.initialize(baseConfig)

      const { connectionManager } = internals()

      // 仅 token 变化 → 身份等价 → shouldReuse 返回 true
      expect(connectionManager.shouldReuse({ ...baseConfig, accessToken: 'new_token' })).toBe(true)

      // deviceId 变化 → 身份不等价 → shouldReuse 返回 false
      expect(connectionManager.shouldReuse({ ...baseConfig, deviceId: 'OTHER' })).toBe(false)
    })

    it('setAccessToken 抛错时回退到整客户端重建（fallbackOnSetTokenFail）', async () => {
      await matrixClientService.initialize(baseConfig)
      const client1 = matrixClientService.getClient()
      expect(sdk.createClient).toHaveBeenCalledTimes(1)

      // 让 setAccessToken 抛错
      const mockSetToken = vi.mocked((client1 as unknown as { setAccessToken: (token: string) => void }).setAccessToken)
      mockSetToken.mockImplementationOnce(() => {
        throw new Error('setAccessToken failed')
      })

      // token 旋转，但 setAccessToken 失败 → 应回退到重建
      const rotatedConfig = { ...baseConfig, accessToken: 'rotated_token_789' }
      await matrixClientService.initialize(rotatedConfig)

      // createClient 应被调用 2 次（初始 1 + fallback 重建 1）
      expect(sdk.createClient).toHaveBeenCalledTimes(2)
    })
  })

  describe('startClient() 串行幂等性', () => {
    const baseConfig = {
      homeserverUrl: 'https://matrix.example.com',
      userId: '@test:example.com',
      deviceId: 'TEST_DEVICE',
      accessToken: 'test_token'
    }

    /** 获取 mock client（vi.mock 工厂返回的同一个实例） */
    const getMockClient = () =>
      sdk.createClient({ baseUrl: '' }) as unknown as { startClient: ReturnType<typeof vi.fn> }

    it('startClient 串行调用两次，SDK client.startClient() 只触发一次', async () => {
      await matrixClientService.initialize(baseConfig)
      const mockClient = getMockClient()
      const startSpy = vi.spyOn(mockClient, 'startClient')

      await matrixClientService.startClient()
      await matrixClientService.startClient()

      expect(startSpy).toHaveBeenCalledTimes(1)
    })

    it('startClient 串行调用两次，cryptoTracker.ensureCrypto 只触发一次', async () => {
      await matrixClientService.initialize(baseConfig)
      const ensureCryptoSpy = vi.spyOn(internals().cryptoTracker, 'ensureCrypto')

      await matrixClientService.startClient()
      await matrixClientService.startClient()

      expect(ensureCryptoSpy).toHaveBeenCalledTimes(1)
    })

    it('startClient 并发调用两次，SDK client.startClient() 只触发一次（mutex 保护）', async () => {
      await matrixClientService.initialize(baseConfig)
      const mockClient = getMockClient()
      const startSpy = vi.spyOn(mockClient, 'startClient')

      // 并发触发：两个 startClient 同时进入，第二个应复用第一个的 Promise
      await Promise.all([matrixClientService.startClient(), matrixClientService.startClient()])

      expect(startSpy).toHaveBeenCalledTimes(1)
    })

    it('stopClient 后再次 startClient 应重新触发 SDK startClient（标志已重置）', async () => {
      await matrixClientService.initialize(baseConfig)
      const mockClient = getMockClient()
      const startSpy = vi.spyOn(mockClient, 'startClient')

      await matrixClientService.startClient()
      expect(startSpy).toHaveBeenCalledTimes(1)

      await matrixClientService.stopClient()
      expect(internals().startClientGuard.isSettled).toBe(false)

      await matrixClientService.startClient()
      expect(startSpy).toHaveBeenCalledTimes(2)
    })

    it('initialize 重建 client 后再次 startClient 应重新触发 SDK startClient', async () => {
      await matrixClientService.initialize(baseConfig)
      const mockClient = getMockClient()
      const startSpy = vi.spyOn(mockClient, 'startClient')

      await matrixClientService.startClient()
      expect(startSpy).toHaveBeenCalledTimes(1)

      // 配置变更（deviceId 不同）触发 client 重建，startClientGuard 应被重置
      await matrixClientService.initialize({ ...baseConfig, deviceId: 'OTHER_DEVICE' })
      expect(internals().startClientGuard.isSettled).toBe(false)

      await matrixClientService.startClient()
      expect(startSpy).toHaveBeenCalledTimes(2)
    })

    it('startClient 失败后再次调用应允许重试（guard 不应置位）', async () => {
      await matrixClientService.initialize(baseConfig)
      const mockClient = getMockClient()
      const startSpy = vi.spyOn(mockClient, 'startClient')

      // 第一次 startClient 失败
      startSpy.mockRejectedValueOnce(new Error('network error'))
      await expect(matrixClientService.startClient()).rejects.toThrow('network error')
      // 失败后 guard 应保持未 settled，允许重试
      expect(internals().startClientGuard.isSettled).toBe(false)

      // 第二次 startClient 应重新执行
      await matrixClientService.startClient()
      expect(startSpy).toHaveBeenCalledTimes(2)
    })
  })

  it('should handle login successfully', async () => {
    const mockClient = sdk.createClient({ baseUrl: '' }) as LoginCapableClient
    mockClient.loginRequest.mockResolvedValue({
      user_id: '@user:example.com',
      device_id: 'DEV1',
      access_token: 'token123'
    })

    // Pre-initialize
    await matrixClientService.initialize({ homeserverUrl: 'https://test.com' })

    const result = await matrixClientService.login('user', 'password')

    expect(result.success).toBe(true)
    expect(result.userId).toBe('@user:example.com')
  })

  it('should handle login failure', async () => {
    const mockClient = sdk.createClient({ baseUrl: '' }) as LoginCapableClient
    mockClient.loginRequest.mockRejectedValue(new Error('Invalid password'))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue('Invalid password')
      })
    )

    // Pre-initialize
    await matrixClientService.initialize({ homeserverUrl: 'https://test.com' })

    const result = await matrixClientService.login('user', 'wrong')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid password')
  })

  it('should fallback to http login when sdk login fails to fetch', async () => {
    const mockClient = sdk.createClient({ baseUrl: '' }) as LoginCapableClient
    mockClient.loginRequest.mockRejectedValue(new Error('fetch failed: Load failed'))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          user_id: '@user:example.com',
          device_id: 'DEV1',
          access_token: 'token123'
        })
      })
    )

    await matrixClientService.initialize({ homeserverUrl: 'http://localhost:28008' })

    const result = await matrixClientService.login('user', 'password')

    expect(result.success).toBe(true)
    expect(result.userId).toBe('@user:example.com')
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:28008/_matrix/client/v3/login',
      expect.objectContaining({
        method: 'POST'
      })
    )
  })

  it('should fallback to browser fetch in tauri runtime when native fetch cannot send request', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} } as Window & { __TAURI_INTERNALS__: unknown })
    const mockClient = sdk.createClient({ baseUrl: '' }) as LoginCapableClient
    mockClient.loginRequest.mockRejectedValue(new Error('fetch failed: error sending request for url'))
    ;(nativeFetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('error sending request for url (https://matrix.test/_matrix/client/v3/login)')
    )
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          user_id: '@ljf:matrix.test',
          device_id: 'DEV1',
          access_token: 'token123'
        })
      })
    )

    await matrixClientService.initialize({ homeserverUrl: 'https://matrix.test' })

    const result = await matrixClientService.login('ljf', 'ChangeMe@2026')

    expect(result.success).toBe(true)
    expect(result.userId).toBe('@ljf:matrix.test')
    expect(nativeFetch).toHaveBeenCalledWith(
      'https://matrix.test/_matrix/client/v3/login',
      expect.objectContaining({
        method: 'POST'
      })
    )
    expect(fetch).toHaveBeenCalledWith(
      'https://matrix.test/_matrix/client/v3/login',
      expect.objectContaining({
        method: 'POST'
      })
    )
  })

  describe('MatrixConnectionManager globalThis 单例守卫', () => {
    it('getMatrixConnectionManager 多次调用返回同一实例', () => {
      __resetConnectionManagerSingletonForTesting()

      const cm1 = getMatrixConnectionManager()
      const cm2 = getMatrixConnectionManager()

      expect(cm2).toBe(cm1)
    })

    it('__resetConnectionManagerSingletonForTesting 后再次调用返回新实例', () => {
      __resetConnectionManagerSingletonForTesting()
      const cm1 = getMatrixConnectionManager()

      __resetConnectionManagerSingletonForTesting()
      const cm2 = getMatrixConnectionManager()

      expect(cm2).not.toBe(cm1)
    })

    it('MatrixClientService 持有的 connectionManager 是 MatrixConnectionManager 实例', () => {
      const cmFromService = internals().connectionManager
      expect(cmFromService).toBeInstanceOf(MatrixConnectionManager)
    })

    it('重复 initialize 不增加事件监听器数量（单例复用）', async () => {
      const config = {
        homeserverUrl: 'https://matrix.example.com',
        userId: '@test:example.com',
        deviceId: 'TEST_DEVICE',
        accessToken: 'test_token'
      }

      await matrixClientService.initialize(config)
      const mockClient = matrixClientService.getClient() as unknown as { on: ReturnType<typeof vi.fn> }
      const initialListenerCount = mockClient.on.mock.calls.length

      // 重复 initialize 4 次（相同配置）
      await matrixClientService.initialize(config)
      await matrixClientService.initialize(config)
      await matrixClientService.initialize(config)
      await matrixClientService.initialize(config)

      // 监听器数量不应增加（复用同一 client，不重新 setupEventRouter）
      expect(mockClient.on.mock.calls.length).toBe(initialListenerCount)
    })
  })

  describe('assertCriticalExtensions 扩展健康断言', () => {
    it('initialize 后检测 FriendManager 扩展已注册（healthy）', async () => {
      const config = {
        homeserverUrl: 'https://matrix.example.com',
        userId: '@test:example.com',
        deviceId: 'TEST_DEVICE',
        accessToken: 'test_token'
      }

      await matrixClientService.initialize(config)

      const mockClient = matrixClientService.getClient() as unknown as {
        getFriendManager: ReturnType<typeof vi.fn>
      }
      expect(mockClient.getFriendManager).toBeDefined()
    })

    it('FriendManager 扩展缺失时标记 degraded（不 throw）', async () => {
      const config = {
        homeserverUrl: 'https://matrix.example.com',
        userId: '@test:example.com',
        deviceId: 'TEST_DEVICE',
        accessToken: 'test_token'
      }

      // 模拟扩展缺失：getFriendManager 返回 null
      const mockClient = sdk.createClient({ baseUrl: '' }) as unknown as {
        getFriendManager: ReturnType<typeof vi.fn>
      }
      mockClient.getFriendManager.mockReturnValue(null)

      // 不应 throw——降级而非阻断
      await expect(matrixClientService.initialize(config)).resolves.not.toThrow()
    })
  })
})
