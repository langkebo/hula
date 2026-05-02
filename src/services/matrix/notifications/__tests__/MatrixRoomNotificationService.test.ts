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
})
