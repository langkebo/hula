import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixClientService } from '../MatrixClientService'
import * as sdk from 'matrix-js-sdk'

// Mock tauri plugin log
vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn()
}))

// Mock matrix-js-sdk
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
    getAccessToken: vi.fn().mockReturnValue('ACCESS_TOKEN')
  }

  return {
    createClient: vi.fn(() => mockClient),
    SlidingSync: class {
      start = vi.fn()
      stop = vi.fn()
    }
  }
})

describe('MatrixClientService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset service state if possible (may need to cast to any to access private props for testing)
    ;(matrixClientService as any).client = null
    ;(matrixClientService as any).connectionState = 'DISCONNECTED'
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
    const mockClient = sdk.createClient({ baseUrl: '' })
    ;(mockClient.login as any).mockResolvedValue({
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
    const mockClient = sdk.createClient({ baseUrl: '' })
    ;(mockClient.login as any).mockRejectedValue(new Error('Invalid password'))

    // Pre-initialize
    await matrixClientService.initialize({ homeserverUrl: 'https://test.com' })
    
    const result = await matrixClientService.login('user', 'wrong')
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid password')
  })
})
