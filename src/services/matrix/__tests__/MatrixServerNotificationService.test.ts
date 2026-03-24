import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixServerNotificationService } from '../MatrixServerNotificationService'

// Mock MatrixClientService
vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({
      getUserId: vi.fn(() => '@test:example.com'),
      http: {
        authedRequest: vi.fn()
      }
    }))
  }
}))

describe('MatrixServerNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createNotification', () => {
    it('should create notification', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        notification_id: 1,
        room_id: '!room:example.com',
        type: 'test',
        severity: 'info',
        title: 'Test',
        content: 'Content',
        timestamp: Date.now(),
        active: true,
        read: false,
        dismissed: false
      })

      const result = await matrixServerNotificationService.createNotification({
        roomId: '!room:example.com',
        type: 'test',
        title: 'Test',
        content: 'Content'
      })

      expect(result).toBeTruthy()
      expect(result?.notificationId).toBe(1)
    })
  })

  describe('getNotification', () => {
    it('should get notification by ID', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        notification_id: 1,
        type: 'test',
        severity: 'warning',
        title: 'Test',
        content: 'Content',
        timestamp: Date.now()
      })

      const result = await matrixServerNotificationService.getNotification(1)

      expect(result).toBeTruthy()
      expect(result?.notificationId).toBe(1)
    })
  })

  describe('listActive', () => {
    it('should list active notifications', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        notifications: [
          { notification_id: 1, type: 'test', title: 'Test 1' },
          { notification_id: 2, type: 'test', title: 'Test 2' }
        ]
      })

      const result = await matrixServerNotificationService.listActive()

      expect(result).toHaveLength(2)
    })
  })

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({})

      const result = await matrixServerNotificationService.markAsRead(1)

      expect(result).toBe(true)
    })
  })

  describe('dismiss', () => {
    it('should dismiss notification', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({})

      const result = await matrixServerNotificationService.dismiss(1)

      expect(result).toBe(true)
    })
  })

  describe('delete', () => {
    it('should delete notification', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({})

      const result = await matrixServerNotificationService.delete(1)

      expect(result).toBe(true)
    })
  })

  describe('listTemplates', () => {
    it('should list templates', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        templates: [{ name: 'template1', type: 'test' }]
      })

      const result = await matrixServerNotificationService.listTemplates()

      expect(Array.isArray(result)).toBe(true)
    })
  })
})
