import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixApplicationService } from '../MatrixApplicationService'

const mockAuthedRequest = vi.fn()

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({
      http: {
        authedRequest: mockAuthedRequest
      }
    }))
  }
}))

describe('MatrixApplicationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('register', () => {
    it('should register application service', async () => {
      mockAuthedRequest.mockResolvedValueOnce({})

      const result = await matrixApplicationService.register({
        url: 'https://as.example.com',
        as_token: 'token123',
        sender: '@as:example.com',
        namespaces: {
          users: [{ exclusive: true, pattern: '@_as_.*' }]
        }
      })

      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixApplicationService.register({
        url: 'https://as.example.com',
        as_token: 'token123',
        sender: '@as:example.com'
      })

      expect(result).toBe(false)
    })
  })

  describe('list', () => {
    it('should list application services', async () => {
      mockAuthedRequest.mockResolvedValueOnce({
        services: [
          { id: 'as1', url: 'https://as1.example.com' },
          { id: 'as2', url: 'https://as2.example.com' }
        ]
      })

      const result = await matrixApplicationService.list()

      expect(result).toHaveLength(2)
    })

    it('should return empty array on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixApplicationService.list()

      expect(result).toEqual([])
    })
  })

  describe('setEnabled', () => {
    it('should enable/disable service', async () => {
      mockAuthedRequest.mockResolvedValueOnce({})

      const result = await matrixApplicationService.setEnabled('as1', true)

      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixApplicationService.setEnabled('as1', true)

      expect(result).toBe(false)
    })
  })

  describe('getUsersNamespace', () => {
    it('should get user namespace', async () => {
      mockAuthedRequest.mockResolvedValueOnce({
        namespaces: {
          users: [{ exclusive: true, pattern: '@_as_.*' }]
        }
      })

      const result = await matrixApplicationService.getUsersNamespace('as1')

      expect(Array.isArray(result)).toBe(true)
    })

    it('should return empty array on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixApplicationService.getUsersNamespace('as1')

      expect(result).toEqual([])
    })
  })

  describe('getRoomsNamespace', () => {
    it('should get room namespace', async () => {
      mockAuthedRequest.mockResolvedValueOnce({
        namespaces: {
          rooms: [{ exclusive: true, pattern: '#_as_.*' }]
        }
      })

      const result = await matrixApplicationService.getRoomsNamespace('as1')

      expect(Array.isArray(result)).toBe(true)
    })

    it('should return empty array on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixApplicationService.getRoomsNamespace('as1')

      expect(result).toEqual([])
    })
  })
})
