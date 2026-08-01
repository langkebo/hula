import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationTypeEnum } from '@/enums'
import matrixClientService from '../../MatrixClientService'

vi.mock('../MatrixPushService', () => ({
  matrixPushService: {
    muteRoom: vi.fn().mockResolvedValue(undefined),
    unmuteRoom: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('../../MatrixRequestDeduper', () => ({
  MatrixRequestDeduper: {
    dedupe: vi.fn(async (_key: string, task: () => Promise<unknown>) => task())
  }
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
}))

function mockClientWithUnreadCount(result: { notification_count: number; highlight_count: number } | Error) {
  const getRoomUnreadCount = vi.fn()
  if (result instanceof Error) {
    const err = result as Error & { httpStatus?: number }
    getRoomUnreadCount.mockRejectedValue(err)
  } else {
    getRoomUnreadCount.mockResolvedValue(result)
  }
  vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
    getRoom: vi.fn(() => ({
      getAccountData: vi.fn(() => ({ getContent: () => ({}) }))
    })),
    setRoomAccountData: vi.fn().mockResolvedValue(undefined),
    getRoomSummaryManager: () => ({ getRoomUnreadCount })
  } as unknown as MatrixClient)
  return getRoomUnreadCount
}

describe('MatrixRoomNotificationService', () => {
  let matrixPushService: typeof import('../MatrixPushService').matrixPushService
  let matrixRoomNotificationService: typeof import('../MatrixRoomNotificationService').matrixRoomNotificationService

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    matrixPushService = (await import('../MatrixPushService')).matrixPushService
    matrixRoomNotificationService = (await import('../MatrixRoomNotificationService')).matrixRoomNotificationService
    ;(
      matrixRoomNotificationService as unknown as {
        isUnreadCountSupported: boolean
        hasLoggedUnreadCountFallback: boolean
      }
    ).isUnreadCountSupported = true
  })

  describe('setRoomNotification', () => {
    it('should mute room for NOT_DISTURB', async () => {
      const setRoomAccountData = vi.fn().mockResolvedValue(undefined)
      vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
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
      vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
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
      vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
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
    it('returns notification + highlight from SDK getRoomUnreadCount', async () => {
      const getRoomUnreadCount = mockClientWithUnreadCount({ notification_count: 5, highlight_count: 2 })

      const result = await matrixRoomNotificationService.fetchUnreadCount('!u:server')

      expect(getRoomUnreadCount).toHaveBeenCalledWith('!u:server')
      expect(result).toEqual({ notification_count: 5, highlight_count: 2 })
    })

    it('coerces missing fields to zero', async () => {
      mockClientWithUnreadCount({ notification_count: 0, highlight_count: 0 })

      const result = await matrixRoomNotificationService.fetchUnreadCount('!z:server')

      expect(result).toEqual({ notification_count: 0, highlight_count: 0 })
    })

    it('returns null when unread_count is not supported (404)', async () => {
      const err = new Error('HTTP 404') as Error & { httpStatus: number }
      err.httpStatus = 404
      const getRoomUnreadCount = mockClientWithUnreadCount(err)

      const firstResult = await matrixRoomNotificationService.fetchUnreadCount('!n:server')
      const secondResult = await matrixRoomNotificationService.fetchUnreadCount('!n:server')

      expect(firstResult).toBeNull()
      expect(secondResult).toBeNull()
      expect(getRoomUnreadCount).toHaveBeenCalledTimes(1)
    })

    it('returns null when roomId is empty', async () => {
      const result = await matrixRoomNotificationService.fetchUnreadCount('')
      expect(result).toBeNull()
    })
  })
})
