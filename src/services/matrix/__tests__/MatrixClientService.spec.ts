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
    connectionManager: { setClient: (c: unknown) => void; getClient: () => unknown }
    connectionState: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR'
  }

  type LoginCapableClient = MatrixClient & {
    login: ReturnType<typeof vi.fn>
    loginRequest: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    ;(matrixClientService as unknown as MatrixClientServiceInternals).connectionManager.setClient(null)
    ;(matrixClientService as unknown as MatrixClientServiceInternals).connectionState = 'DISCONNECTED'
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
