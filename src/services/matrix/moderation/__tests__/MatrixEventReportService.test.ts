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
})
