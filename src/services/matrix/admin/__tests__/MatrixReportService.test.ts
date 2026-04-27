import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reportService } from '../MatrixReportService'
import { matrixClientService } from '../../MatrixClientService'

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixReportService', () => {
  let mockHttp: { authedRequest: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockHttp = { authedRequest: vi.fn().mockResolvedValue({}) }
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      http: mockHttp,
      reportEvent: vi.fn().mockResolvedValue({}),
      getRoom: vi.fn().mockReturnValue({
        timeline: [{ getId: vi.fn(() => '$event1') }]
      })
    } as any)
  })

  describe('reportEvent', () => {
    it('should report an event', async () => {
      await reportService.reportEvent({
        roomId: '!room:server',
        eventId: '$event1',
        reason: 'spam'
      })
    })
  })

  describe('getAdminReports', () => {
    it('should get admin reports with filters', async () => {
      const mockReports = {
        reports: [{ id: '1', room_id: '!room:server', event_id: '$event1' }],
        next_batch: 'token1'
      }
      mockHttp.authedRequest.mockResolvedValue(mockReports)

      const result = await reportService.getAdminReports('!room:server', 50, 'from_token')

      expect(result.reports).toHaveLength(1)
      expect(result.next_batch).toBe('token1')
    })

    it('should return empty reports on error', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('fail'))

      const result = await reportService.getAdminReports()
      expect(result.reports).toEqual([])
    })
  })

  describe('getAdminReport', () => {
    it('should get a single report', async () => {
      const mockReport = { id: '1', reason: 'spam', score: -100 }
      mockHttp.authedRequest.mockResolvedValue(mockReport)

      const result = await reportService.getAdminReport('1')
      expect(result).toEqual(mockReport)
    })

    it('should return null on error', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('fail'))
      const result = await reportService.getAdminReport('1')
      expect(result).toBeNull()
    })
  })

  describe('dismissReport', () => {
    it('should dismiss a report', async () => {
      const result = await reportService.dismissReport('1')
      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('fail'))
      const result = await reportService.dismissReport('1')
      expect(result).toBe(false)
    })
  })
})
