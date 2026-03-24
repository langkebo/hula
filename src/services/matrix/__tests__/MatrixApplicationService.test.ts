import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixApplicationService } from '../MatrixApplicationService'

// Mock MatrixClientService
vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({
      http: {
        authedRequest: vi.fn()
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
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({})

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
  })

  describe('list', () => {
    it('should list application services', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        services: [
          { id: 'as1', url: 'https://as1.example.com' },
          { id: 'as2', url: 'https://as2.example.com' }
        ]
      })

      const result = await matrixApplicationService.list()

      expect(result).toHaveLength(2)
    })
  })

  describe('setEnabled', () => {
    it('should enable/disable service', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({})

      const result = await matrixApplicationService.setEnabled('as1', true)

      expect(result).toBe(true)
    })
  })

  describe('getUsersNamespace', () => {
    it('should get user namespace', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        namespaces: {
          users: [{ exclusive: true, pattern: '@_as_.*' }]
        }
      })

      const result = await matrixApplicationService.getUsersNamespace('as1')

      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getRoomsNamespace', () => {
    it('should get room namespace', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        namespaces: {
          rooms: [{ exclusive: true, pattern: '#_as_.*' }]
        }
      })

      const result = await matrixApplicationService.getRoomsNamespace('as1')

      expect(Array.isArray(result)).toBe(true)
    })
  })
})
