import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixFederationBlacklistService } from '../MatrixFederationBlacklistService'

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixFederationBlacklistService', () => {
  let requestSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    requestSpy = vi.spyOn(matrixFederationBlacklistService as any, 'request')
  })

  describe('list', () => {
    it('should get blacklist entries', async () => {
      requestSpy.mockResolvedValue({
        blacklist: [
          { domain: 'bad-server.com', reason: 'spam' },
          { server_name: 'evil.org', added_by: '@admin:server' }
        ]
      })

      const result = await matrixFederationBlacklistService.list()
      expect(result).toHaveLength(2)
      expect(result[0].domain).toBe('bad-server.com')
      expect(result[1].domain).toBe('evil.org')
    })

    it('should return empty array on error', async () => {
      requestSpy.mockRejectedValue(new Error('fail'))
      const result = await matrixFederationBlacklistService.list()
      expect(result).toEqual([])
    })
  })

  describe('add', () => {
    it('should add domain to blacklist', async () => {
      requestSpy.mockResolvedValue({})
      const result = await matrixFederationBlacklistService.add({ domain: 'bad-server.com' })
      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      requestSpy.mockRejectedValue(new Error('fail'))
      const result = await matrixFederationBlacklistService.add({ domain: 'bad-server.com' })
      expect(result).toBe(false)
    })
  })

  describe('remove', () => {
    it('should remove domain from blacklist', async () => {
      requestSpy.mockResolvedValue({})
      const result = await matrixFederationBlacklistService.remove('bad-server.com')
      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      requestSpy.mockRejectedValue(new Error('fail'))
      const result = await matrixFederationBlacklistService.remove('bad-server.com')
      expect(result).toBe(false)
    })
  })

  describe('getFederationStatus', () => {
    it('should get federation status', async () => {
      const mockStatus = { online: true, last_sync: 1234567890 }
      requestSpy.mockResolvedValue(mockStatus)

      const result = await matrixFederationBlacklistService.getFederationStatus()
      expect(result).toEqual(mockStatus)
    })

    it('should return empty object on error', async () => {
      requestSpy.mockRejectedValue(new Error('fail'))
      const result = await matrixFederationBlacklistService.getFederationStatus()
      expect(result).toEqual({})
    })
  })

  describe('getFederationDestinations', () => {
    it('should get federation destinations', async () => {
      const mockDests = { destinations: [{ destination: 'server1.com', retry_last_ts: 0 }] }
      requestSpy.mockResolvedValue(mockDests)

      const result = await matrixFederationBlacklistService.getFederationDestinations()
      expect(result).toHaveLength(1)
    })

    it('should return empty array on error', async () => {
      requestSpy.mockRejectedValue(new Error('fail'))
      const result = await matrixFederationBlacklistService.getFederationDestinations()
      expect(result).toEqual([])
    })
  })
})
