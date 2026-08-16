import { warn as logWarn } from '@tauri-apps/plugin-log'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'
import matrixClientService from '../../MatrixClientService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: { enqueue: vi.fn() }
}))

const { matrixEventReportService } = await import('../MatrixEventReportService')

describe('MatrixEventReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
  })

  // FT-131-C: getEventReportManager 工厂方法抛错时不能静默吞错，必须记录日志
  describe('FT-131-C: manager factory error logging', () => {
    it('getEventReportManager() 抛错时记录 warn 日志（不再静默吞错）', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getEventReportManager: () => {
          throw new Error('event report manager factory boom')
        }
      } as unknown as MatrixClient)

      vi.mocked(logWarn).mockClear()
      // createReport 会调用 requireEventReportManager，触发 manager 解析
      await expect(
        matrixEventReportService.createReport({
          room_id: '!room:test',
          event_id: '$event:test',
          reason: 'spam'
        } as never)
      ).rejects.toThrow()

      expect(logWarn).toHaveBeenCalled()
      expect(vi.mocked(logWarn).mock.calls[0][0]).toContain('getEventReportManager')
    })
  })

  // Task 2: event-report 族统一走 getEventReportManager()，不得退化为 client.http.authedRequest 裸调。
  describe('event-report 统一经 getEventReportManager（消除裸 authedRequest 双轨）', () => {
    let authedRequestMock: ReturnType<typeof vi.fn>
    let manager: Record<string, ReturnType<typeof vi.fn>>

    beforeEach(() => {
      authedRequestMock = vi.fn()
      manager = {
        createReport: vi.fn().mockResolvedValue({ id: 1 }),
        listReports: vi.fn().mockResolvedValue([{ id: 1, status: 'open' }]),
        getReportsCount: vi.fn().mockResolvedValue({ total_reports: 5 }),
        getStatusCount: vi.fn().mockResolvedValue({ status: 'open', count: 2 }),
        resolveReport: vi.fn().mockResolvedValue({ id: 1, status: 'resolved' }),
        dismissReport: vi.fn().mockResolvedValue({ id: 1, status: 'dismissed' }),
        escalateReport: vi.fn().mockResolvedValue({ id: 1, status: 'escalated' }),
        deleteReport: vi.fn().mockResolvedValue(undefined),
        getReportHistory: vi.fn().mockResolvedValue([{ id: 1, action: 'create' }])
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getEventReportManager: () => manager,
        http: { authedRequest: authedRequestMock }
      } as unknown as MatrixClient)
    })

    it('listReports 走 manager.listReports，不触发 client.http.authedRequest', async () => {
      await expect(matrixEventReportService.listReports({ limit: 10 })).resolves.toEqual([{ id: 1, status: 'open' }])
      expect(manager.listReports).toHaveBeenCalledWith({ limit: 10 })
      expect(authedRequestMock).not.toHaveBeenCalled()
    })

    it('getReportsCount 走 manager.getReportsCount，不触发 authedRequest', async () => {
      await expect(matrixEventReportService.getReportsCount()).resolves.toEqual({ total_reports: 5 })
      expect(manager.getReportsCount).toHaveBeenCalled()
      expect(authedRequestMock).not.toHaveBeenCalled()
    })

    it('getStatusCount 走 manager.getStatusCount，不触发 authedRequest', async () => {
      await expect(matrixEventReportService.getStatusCount('open')).resolves.toEqual({ status: 'open', count: 2 })
      expect(manager.getStatusCount).toHaveBeenCalledWith('open')
      expect(authedRequestMock).not.toHaveBeenCalled()
    })

    it('resolve/dismiss/escalate/delete 均走 manager，不触发 authedRequest', async () => {
      await matrixEventReportService.resolveReport(1, { resolution_reason: 'ok' })
      await matrixEventReportService.dismissReport(1, { reason: 'no' })
      await matrixEventReportService.escalateReport(1)
      await matrixEventReportService.deleteReport(1)

      expect(manager.resolveReport).toHaveBeenCalledWith(1, { resolution_reason: 'ok' })
      expect(manager.dismissReport).toHaveBeenCalledWith(1, { reason: 'no' })
      expect(manager.escalateReport).toHaveBeenCalledWith(1, undefined)
      expect(manager.deleteReport).toHaveBeenCalledWith(1)
      expect(authedRequestMock).not.toHaveBeenCalled()
    })

    it('getReportHistory 走 manager.getReportHistory，不触发 authedRequest', async () => {
      await expect(matrixEventReportService.getReportHistory(1)).resolves.toEqual([{ id: 1, action: 'create' }])
      expect(manager.getReportHistory).toHaveBeenCalledWith(1)
      expect(authedRequestMock).not.toHaveBeenCalled()
    })
  })
})
