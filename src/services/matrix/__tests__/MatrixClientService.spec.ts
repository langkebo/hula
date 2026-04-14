import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixClientService } from '../MatrixClientService'
import * as sdk from 'matrix-js-sdk'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn()
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

vi.mock('matrix-js-sdk/src/manager-extensions', () => ({
  extendMatrixClientWithManagers: vi.fn(),
  isManagerExtensionsInitialized: vi.fn(() => true)
}))

vi.mock('matrix-js-sdk/src/telemetry', () => ({
  initTelemetryFromClient: vi.fn()
}))

vi.mock('matrix-js-sdk', () => {
  const mockClient = {
    login: vi.fn(),
    loginWithPassword: vi.fn(),
    logout: vi.fn(),
    startClient: vi.fn(),
    stopClient: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    getUserId: vi.fn().mockReturnValue('@user:example.com'),
    getDeviceId: vi.fn().mockReturnValue('DEVICE_ID'),
    getAccessToken: vi.fn().mockReturnValue('ACCESS_TOKEN'),
    getHomeserverUrl: vi.fn().mockReturnValue('https://matrix.example.com'),
    setAccessToken: vi.fn()
  }

  return {
    createClient: vi.fn(() => mockClient),
    SlidingSync: vi.fn().mockImplementation(function (this: {
      start: ReturnType<typeof vi.fn>
      stop: ReturnType<typeof vi.fn>
    }) {
      this.start = vi.fn()
      this.stop = vi.fn()
    }),
    MatrixClient: vi.fn()
  }
})

interface MatrixClientServiceInternal {
  client: unknown
  connectionState: string
}

describe('MatrixClientService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const serviceInternal = matrixClientService as unknown as MatrixClientServiceInternal
    serviceInternal.client = null
    serviceInternal.connectionState = 'DISCONNECTED'
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
    expect(matrixClientService.getConnectionState()).toBe('CONNECTING')
  })

  it('should return null when getting client before init', () => {
    const client = matrixClientService.getClient()
    expect(client).toBeNull()
  })

  it('should handle login successfully', async () => {
    const mockClient = sdk.createClient({ baseUrl: '' })
    vi.mocked(mockClient.login).mockResolvedValue({
      user_id: '@user:example.com',
      device_id: 'DEV1',
      access_token: 'token123'
    })

    await matrixClientService.initialize({ homeserverUrl: 'https://test.com' })

    const result = await matrixClientService.login('user', 'password')

    expect(result.success).toBe(true)
    expect(result.userId).toBe('@user:example.com')
  })

  it('should handle login failure', async () => {
    const mockClient = sdk.createClient({ baseUrl: '' })
    vi.mocked(mockClient.login).mockRejectedValue(new Error('Invalid password'))

    await matrixClientService.initialize({ homeserverUrl: 'https://test.com' })

    const result = await matrixClientService.login('user', 'wrong')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid password')
  })
})
