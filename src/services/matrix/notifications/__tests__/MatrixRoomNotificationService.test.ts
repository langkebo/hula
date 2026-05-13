import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationTypeEnum } from '@/enums'

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => null as MatrixClient | null)
  }
}))

vi.mock('../MatrixPushService', () => ({
  matrixPushService: {
    muteRoom: vi.fn().mockResolvedValue(undefined),
    unmuteRoom: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
}))

describe('MatrixRoomNotificationService', () => {
  let matrixClientService: typeof import('../../MatrixClientService').matrixClientService
  let matrixPushService: typeof import('../MatrixPushService').matrixPushService
  let matrixRoomNotificationService: typeof import('../MatrixRoomNotificationService').matrixRoomNotificationService

  beforeEach(async () => {
    vi.clearAllMocks()
    matrixClientService = (await import('../../MatrixClientService')).matrixClientService
    matrixPushService = (await import('../MatrixPushService')).matrixPushService
    matrixRoomNotificationService = (await import('../MatrixRoomNotificationService')).matrixRoomNotificationService
  })

  describe('setRoomNotification', () => {
    it('should mute room for NOT_DISTURB', async () => {
      const setRoomAccountData = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => ({
          getAccountData: vi.fn(() => ({ getContent: () => ({}) }))
        })),
        setRoomAccountData
      } as unknown as MatrixClient)

      await matrixRoomNotificationService.setRoomNotification('!room:server', NotificationTypeEnum.NOT_DISTURB)

      expect(matrixPushService.muteRoom).toHaveBeenCalledWith('!room:server')
      expect(setRoomAccountData).toHaveBeenCalled()
    })

    it('should unmute room for other notification types', async () => {
      const setRoomAccountData = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => ({
          getAccountData: vi.fn(() => ({ getContent: () => ({}) }))
        })),
        setRoomAccountData
      } as unknown as MatrixClient)

      await matrixRoomNotificationService.setRoomNotification('!room:server', NotificationTypeEnum.RECEPTION)

      expect(matrixPushService.unmuteRoom).toHaveBeenCalledWith('!room:server')
    })
  })

  describe('setRoomShield', () => {
    it('should save shield setting', async () => {
      const setRoomAccountData = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => ({
          getAccountData: vi.fn(() => ({ getContent: () => ({}) }))
        })),
        setRoomAccountData
      } as unknown as MatrixClient)

      await matrixRoomNotificationService.setRoomShield('!room:server', true)
      expect(setRoomAccountData).toHaveBeenCalled()
    })
  })

  describe('fetchUnreadCount', () => {
    it('returns notification + highlight from /unread_count', async () => {
      const authedRequest = vi.fn().mockResolvedValue({ notification_count: 5, highlight_count: 2 })
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        http: { authedRequest }
      } as unknown as MatrixClient)

      const result = await matrixRoomNotificationService.fetchUnreadCount('!u:server')

      expect(authedRequest).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ notification_count: 5, highlight_count: 2 })
    })

    it('coerces missing fields to zero', async () => {
      const authedRequest = vi.fn().mockResolvedValue({})
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        http: { authedRequest }
      } as unknown as MatrixClient)

      const result = await matrixRoomNotificationService.fetchUnreadCount('!z:server')

      expect(result).toEqual({ notification_count: 0, highlight_count: 0 })
    })

    it('returns null when client is missing', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      const result = await matrixRoomNotificationService.fetchUnreadCount('!n:server')
      expect(result).toBeNull()
    })
  })
})
