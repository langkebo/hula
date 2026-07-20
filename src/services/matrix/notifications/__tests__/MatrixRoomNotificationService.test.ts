import type { MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import { NotificationTypeEnum } from '@/enums'
import matrixClientService from '../../MatrixClientService'

const TEST_BASE_URL = 'https://matrix.test'

const server = setupMswServer(
  http.get(`${TEST_BASE_URL}/_matrix/client/v3/rooms/:roomId/unread_count`, () => {
    return HttpResponse.json({ notification_count: 5, highlight_count: 2 })
  })
)

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

const buildRoomPathImpl = vi.fn((roomId: string, suffix: string) => {
  return `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/${suffix}`
})

const getImpl = vi.fn(async (path: string) => {
  const url = `${TEST_BASE_URL}${path}`
  const response = await fetch(url)
  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}`) as Error & { httpStatus: number }
    err.httpStatus = response.status
    throw err
  }
  return response.json()
})

vi.mock('../../MatrixHttpClient', () => ({
  matrixHttpClient: {
    buildRoomPath: buildRoomPathImpl,
    get: getImpl
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
      const result = await matrixRoomNotificationService.fetchUnreadCount('!u:server')

      expect(buildRoomPathImpl).toHaveBeenCalledWith('!u:server', 'unread_count')
      expect(getImpl).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ notification_count: 5, highlight_count: 2 })
    })

    it('coerces missing fields to zero', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_matrix/client/v3/rooms/:roomId/unread_count`, () => {
          return HttpResponse.json({})
        })
      )

      const result = await matrixRoomNotificationService.fetchUnreadCount('!z:server')

      expect(result).toEqual({ notification_count: 0, highlight_count: 0 })
    })

    it('returns null when unread_count is not supported', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_matrix/client/v3/rooms/:roomId/unread_count`, () => {
          return new HttpResponse(null, { status: 404 })
        })
      )

      const firstResult = await matrixRoomNotificationService.fetchUnreadCount('!n:server')
      const secondResult = await matrixRoomNotificationService.fetchUnreadCount('!n:server')

      expect(firstResult).toBeNull()
      expect(secondResult).toBeNull()
      expect(getImpl).toHaveBeenCalledTimes(1)
    })

    it('returns null when roomId is empty', async () => {
      const result = await matrixRoomNotificationService.fetchUnreadCount('')
      expect(result).toBeNull()
    })
  })
})
