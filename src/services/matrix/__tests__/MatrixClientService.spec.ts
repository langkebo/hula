import { fetch as nativeFetch } from '@tauri-apps/plugin-http'
import type { MatrixClient } from 'matrix-js-sdk'
import * as sdk from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../MatrixClientService'

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

// Mock matrix-js-sdk
vi.mock('matrix-js-sdk', () => {
  const mockClient = {
    login: vi.fn(),
    loginRequest: vi.fn(),
    loginWithPassword: vi.fn(),
    logout: vi.fn(),
    startClient: vi.fn(),
    stopClient: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    removeListener: vi.fn(),
    getUserId: vi.fn().mockReturnValue('@user:example.com'),
    getDeviceId: vi.fn().mockReturnValue('DEVICE_ID'),
    getAccessToken: vi.fn().mockReturnValue('ACCESS_TOKEN')
  }

  return {
    createClient: vi.fn(() => mockClient),
    initializeManagerExtensions: vi.fn().mockResolvedValue(undefined),
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
    // 完整重置连接管理器（含 config），确保幂等守卫从干净状态开始判断
    internals().connectionManager.resetState()
    internals().connectionState = 'DISCONNECTED'
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
})
