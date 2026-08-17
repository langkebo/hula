import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'
import matrixClientService from '../../MatrixClientService'
import { matrixBurnAfterReadService } from '../../messaging/MatrixBurnAfterReadService'
import { MatrixRoomAccountDataService } from '../AccountDataService'

type AccountDataManagerInstance = ReturnType<NonNullable<MatrixClient['getAccountDataManager']>>

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

// 各 Manager 方法 mock（迁移后服务不再直接 authedRequest，改走 SDK Manager）
const getScannerInfoMock = vi.fn()
const signRoomEventMock = vi.fn()
const verifyRoomEventMock = vi.fn()
const getRoomMessageQueueMock = vi.fn()
const getEncryptedEventsMock = vi.fn()
const getRoomVaultDataMock = vi.fn()
const setRoomVaultDataMock = vi.fn()
const getAntiScreenshotMock = vi.fn()
const setAntiScreenshotMock = vi.fn()
const getRoomSummaryMembersMock = vi.fn()
const getAllSummaryStateMock = vi.fn()
const listServicesMock = vi.fn()

describe('MatrixRoomAccountDataService', () => {
  let service: InstanceType<typeof MatrixRoomAccountDataService>
  let accountDataMgr: {
    getRoomAccountDataFromServer: ReturnType<typeof vi.fn>
    setRoomAccountData: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    accountDataMgr = {
      getRoomAccountDataFromServer: vi.fn(),
      setRoomAccountData: vi.fn()
    }
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    vi.spyOn(matrixBurnAfterReadService, 'enableBurn')
    service = new MatrixRoomAccountDataService()
  })

  const makeClient = (userId: string) => ({
    getUserId: () => userId,
    http: { authedRequest: vi.fn() },
    getAccountDataManager: () => accountDataMgr as unknown as AccountDataManagerInstance,
    getReportingManager: () => ({ getScannerInfo: getScannerInfoMock }),
    getRoomSummaryManager: () => ({
      signRoomEvent: signRoomEventMock,
      verifyRoomEvent: verifyRoomEventMock,
      getRoomMessageQueue: getRoomMessageQueueMock,
      getEncryptedEvents: getEncryptedEventsMock,
      getRoomVaultData: getRoomVaultDataMock,
      setRoomVaultData: setRoomVaultDataMock,
      getAntiScreenshot: getAntiScreenshotMock,
      setAntiScreenshot: setAntiScreenshotMock,
      getRoomSummaryMembers: getRoomSummaryMembersMock,
      getAllSummaryState: getAllSummaryStateMock
    }),
    getExternalServiceManager: () => ({ listServices: listServicesMock })
  })

  describe('getRoomAccountData via AccountDataManager', () => {
    it('throws when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      await expect(service.getRoomAccountData('!r', 'm.x')).rejects.toThrow('客户端未初始化')
    })

    it('calls getRoomAccountDataFromServer and returns event content', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      const eventContent = { foo: 1 }
      accountDataMgr.getRoomAccountDataFromServer.mockResolvedValue({
        getContent: () => eventContent
      })
      expect(await service.getRoomAccountData('!r:e', 'm.fully_read')).toEqual({ foo: 1 })
      expect(accountDataMgr.getRoomAccountDataFromServer).toHaveBeenCalledWith('!r:e', 'm.fully_read')
    })

    it('returns null when manager returns undefined (data not found)', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      accountDataMgr.getRoomAccountDataFromServer.mockResolvedValue(undefined)
      expect(await service.getRoomAccountData('!r:e', 'm.x')).toBeNull()
    })

    it('swallows backend errors and returns null', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      accountDataMgr.getRoomAccountDataFromServer.mockRejectedValue(new Error('HTTP 404'))
      expect(await service.getRoomAccountData('!r', 'x')).toBeNull()
    })
  })

  describe('setRoomAccountData via AccountDataManager', () => {
    it('calls setRoomAccountData with roomId/eventType/content', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      accountDataMgr.setRoomAccountData.mockResolvedValue(undefined)
      await service.setRoomAccountData('!r', 'm.x', { a: 1 })
      expect(accountDataMgr.setRoomAccountData).toHaveBeenCalledWith('!r', 'm.x', { a: 1 })
    })

    it('re-throws backend errors', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      accountDataMgr.setRoomAccountData.mockRejectedValue(new Error('HTTP 403'))
      await expect(service.setRoomAccountData('!r', 'x', {})).rejects.toThrow('403')
    })
  })

  describe('getReportScannerInfo', () => {
    it('delegates to ReportingManager.getScannerInfo', async () => {
      getScannerInfoMock.mockResolvedValue({ clean: true })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getReportScannerInfo('!r', '$e')).toEqual({ clean: true })
      expect(getScannerInfoMock).toHaveBeenCalledWith('!r', '$e')
    })

    it('swallows backend errors and returns null', async () => {
      getScannerInfoMock.mockRejectedValue(new Error('HTTP 404'))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getReportScannerInfo('!r', '$e')).toBeNull()
    })
  })

  describe('setReadLifetime', () => {
    it('delegates to matrixBurnAfterReadService.enableBurn', async () => {
      vi.mocked(matrixBurnAfterReadService.enableBurn).mockResolvedValue({ enabled: true, burnAfterMs: 5000 })
      await service.setReadLifetime('!r', 5000)
      expect(matrixBurnAfterReadService.enableBurn).toHaveBeenCalledWith('!r', 5000, true)
    })

    it('re-throws backend errors', async () => {
      vi.mocked(matrixBurnAfterReadService.enableBurn).mockRejectedValue(new Error('HTTP 403'))
      await expect(service.setReadLifetime('!r', 1000)).rejects.toThrow('403')
    })
  })

  describe('signEvent', () => {
    it('delegates to RoomSummaryManager.signRoomEvent', async () => {
      signRoomEventMock.mockResolvedValue({ signed: true })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.signEvent('!r:e', '$ev:1')).toEqual({ signed: true })
      expect(signRoomEventMock).toHaveBeenCalledWith('!r:e', '$ev:1')
    })

    it('re-throws backend errors', async () => {
      signRoomEventMock.mockRejectedValue(new Error('HTTP 403'))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      await expect(service.signEvent('!r:e', '$ev:1')).rejects.toThrow('403')
    })
  })

  describe('verifyEvent', () => {
    it('delegates to RoomSummaryManager.verifyRoomEvent and maps valid', async () => {
      verifyRoomEventMock.mockResolvedValue({ valid: true })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.verifyEvent('!r:e', '$ev:1')).toEqual({ valid: true })
      expect(verifyRoomEventMock).toHaveBeenCalledWith('!r:e', '$ev:1')
    })

    it('re-throws backend errors', async () => {
      verifyRoomEventMock.mockRejectedValue(new Error('HTTP 500'))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      await expect(service.verifyEvent('!r:e', '$ev:1')).rejects.toThrow('500')
    })
  })

  describe('getMessageQueue', () => {
    it('delegates to RoomSummaryManager.getRoomMessageQueue', async () => {
      getRoomMessageQueueMock.mockResolvedValue({ queue: { pending: [] } })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getMessageQueue('!r:e')).toEqual({ queue: { pending: [] } })
      expect(getRoomMessageQueueMock).toHaveBeenCalledWith('!r:e')
    })

    it('swallows backend errors and returns {}', async () => {
      getRoomMessageQueueMock.mockRejectedValue(new Error('HTTP 500'))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getMessageQueue('!r:e')).toEqual({})
    })
  })

  describe('getEncryptedEvents', () => {
    it('delegates to RoomSummaryManager.getEncryptedEvents', async () => {
      getEncryptedEventsMock.mockResolvedValue({ events: [{ event_id: '$e:1' }] })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect((await service.getEncryptedEvents('!r:e')).events).toEqual([{ event_id: '$e:1' }])
      expect(getEncryptedEventsMock).toHaveBeenCalledWith('!r:e')
    })

    it('swallows backend errors and returns {}', async () => {
      getEncryptedEventsMock.mockRejectedValue(new Error('HTTP 500'))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getEncryptedEvents('!r:e')).toEqual({})
    })
  })

  describe('getExternalServices', () => {
    it('unwraps `services` array from ExternalServiceManager.listServices', async () => {
      listServicesMock.mockResolvedValue({ services: [{ id: 'a' }] })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getExternalServices()).toEqual([{ id: 'a' }])
      expect(listServicesMock).toHaveBeenCalled()
    })

    it('returns [] when backend omits `services`', async () => {
      listServicesMock.mockResolvedValue({})
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getExternalServices()).toEqual([])
    })

    it('swallows backend errors and returns []', async () => {
      listServicesMock.mockRejectedValue(new Error('HTTP 500'))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getExternalServices()).toEqual([])
    })
  })
})
