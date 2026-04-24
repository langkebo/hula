import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { retentionService } from '../MatrixRetentionService'

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
  error: vi.fn()
}))

const mockClient = {
  getRoomStateEvent: vi.fn(),
  sendStateEvent: vi.fn(),
  redact: vi.fn(),
  getServerRetention: vi.fn()
} as any

describe('RetentionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(matrixClientService.getClient).mockReset()
  })

  it('should throw error when no runtime client is available', async () => {
    const service = new (retentionService.constructor as any)()

    await expect(service.getRoomRetention('!room:example.org')).rejects.toThrow('Client 未初始化')
  })

  it('should use matrixClientService client when initialize is not called', async () => {
    mockClient.getRoomStateEvent.mockResolvedValueOnce({
      min_lifetime: 1000,
      max_lifetime: 2000
    })
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient)

    const service = new (retentionService.constructor as any)()
    const result = await service.getRoomRetention('!room:example.org')

    expect(matrixClientService.getClient).toHaveBeenCalled()
    expect(mockClient.getRoomStateEvent).toHaveBeenCalledWith('!room:example.org', 'm.room.retention', '')
    expect(result).toEqual({
      roomId: '!room:example.org',
      policy: {
        min_lifetime: 1000,
        max_lifetime: 2000
      }
    })
  })
})
