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

vi.mock('../../MatrixRequestDeduper', () => ({
  MatrixRequestDeduper: {
    dedupe: vi.fn(async (_key: string, task: () => Promise<unknown>) => task())
  }
}))

vi.mock('../../MatrixRequestHelper', () => ({
  MatrixRequestHelper: {
    buildRoomPath: vi.fn((roomId: string, suffix: string) => `/_matrix/client/v3/rooms/${roomId}/${suffix}`),
    safeGet: vi.fn()
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

describe('MatrixRoomNotificationService', () => {
  let matrixClientService: typeof import('../../MatrixClientService').matrixClientService
  let matrixPushService: typeof import('../MatrixPushService').matrixPushService
  let matrixRequestHelper: typeof import('../../MatrixRequestHelper').MatrixRequestHelper
  let matrixRoomNotificationService: typeof import('../MatrixRoomNotificationService').matrixRoomNotificationService

  beforeEach(async () => {
    vi.clearAllMocks()
    matrixClientService = (await import('../../MatrixClientService')).matrixClientService
    matrixPushService = (await import('../MatrixPushService')).matrixPushService
    matrixRequestHelper = (await import('../../MatrixRequestHelper')).MatrixRequestHelper
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
      vi.mocked(matrixRequestHelper.safeGet).mockResolvedValue({ notification_count: 5, highlight_count: 2 })

      const result = await matrixRoomNotificationService.fetchUnreadCount('!u:server')

      expect(matrixRequestHelper.buildRoomPath).toHaveBeenCalledWith('!u:server', 'unread_count')
      expect(matrixRequestHelper.safeGet).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ notification_count: 5, highlight_count: 2 })
    })

    it('coerces missing fields to zero', async () => {
      vi.mocked(matrixRequestHelper.safeGet).mockResolvedValue({})

      const result = await matrixRoomNotificationService.fetchUnreadCount('!z:server')

      expect(result).toEqual({ notification_count: 0, highlight_count: 0 })
    })

    it('returns null when unread_count is not supported', async () => {
      vi.mocked(matrixRequestHelper.safeGet).mockRejectedValue({ httpStatus: 404 })

      const firstResult = await matrixRoomNotificationService.fetchUnreadCount('!n:server')
      const secondResult = await matrixRoomNotificationService.fetchUnreadCount('!n:server')

      expect(firstResult).toBeNull()
      expect(secondResult).toBeNull()
      expect(matrixRequestHelper.safeGet).toHaveBeenCalledTimes(1)
    })

    it('returns null when roomId is empty', async () => {
      const result = await matrixRoomNotificationService.fetchUnreadCount('')
      expect(result).toBeNull()
    })
  })
})
