import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixServerNotificationService } from '../MatrixServerNotificationService'

const mockAuthedRequest = vi.fn()

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({
      getUserId: vi.fn(() => '@test:example.com'),
      http: {
        authedRequest: mockAuthedRequest
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
      mockAuthedRequest.mockResolvedValueOnce({
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

    it('should return null on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixServerNotificationService.createNotification({
        type: 'test',
        title: 'Test',
        content: 'Content'
      })

      expect(result).toBeNull()
    })
  })

  describe('getNotification', () => {
    it('should get notification by ID', async () => {
      mockAuthedRequest.mockResolvedValueOnce({
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

    it('should return null on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Not found'))

      const result = await matrixServerNotificationService.getNotification(999)

      expect(result).toBeNull()
    })
  })

  describe('listActive', () => {
    it('should list active notifications', async () => {
      mockAuthedRequest.mockResolvedValueOnce({
        notifications: [
          { notification_id: 1, type: 'test', title: 'Test 1' },
          { notification_id: 2, type: 'test', title: 'Test 2' }
        ]
      })

      const result = await matrixServerNotificationService.listActive()

      expect(result).toHaveLength(2)
    })

    it('should return empty array on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixServerNotificationService.listActive()

      expect(result).toEqual([])
    })
  })

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockAuthedRequest.mockResolvedValueOnce({})

      const result = await matrixServerNotificationService.markAsRead(1)

      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixServerNotificationService.markAsRead(1)

      expect(result).toBe(false)
    })
  })

  describe('dismiss', () => {
    it('should dismiss notification', async () => {
      mockAuthedRequest.mockResolvedValueOnce({})

      const result = await matrixServerNotificationService.dismiss(1)

      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixServerNotificationService.dismiss(1)

      expect(result).toBe(false)
    })
  })

  describe('delete', () => {
    it('should delete notification', async () => {
      mockAuthedRequest.mockResolvedValueOnce({})

      const result = await matrixServerNotificationService.delete(1)

      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixServerNotificationService.delete(1)

      expect(result).toBe(false)
    })
  })

  describe('listTemplates', () => {
    it('should list templates', async () => {
      mockAuthedRequest.mockResolvedValueOnce({
        templates: [{ name: 'template1', type: 'test' }]
      })

      const result = await matrixServerNotificationService.listTemplates()

      expect(Array.isArray(result)).toBe(true)
    })

    it('should return empty array on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixServerNotificationService.listTemplates()

      expect(result).toEqual([])
    })
  })
})
