import type { MatrixClient } from 'matrix-js-sdk'
import type { AdminManager } from 'matrix-js-sdk/admin'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import { MATRIX_PATHS } from '../../paths'
import { AdminReportService } from '../ReportService'

const TEST_BASE_URL = 'https://matrix.example.com'
const PREFIX_V3 = '/_matrix/client/v3'

const server = setupMswServer(
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/rooms/:roomId/report`, () => {
    return HttpResponse.json({ report_id: 'rep-1' })
  }),
  http.put(`${TEST_BASE_URL}/_matrix/client/v3/rooms/:roomId/report/:eventId/score`, () => {
    return HttpResponse.json({})
  }),
  http.get(`${TEST_BASE_URL}/_synapse/admin/v1/reports`, () => {
    return HttpResponse.json({
      reports: [{ id: 'rep-1' }],
      next_batch: 'nb'
    })
  }),
  http.delete(`${TEST_BASE_URL}/_synapse/admin/v1/reports/:reportId`, () => {
    return HttpResponse.json({})
  })
)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const adminManager = {
  listReports: vi.fn(),
  listRoomReports: vi.fn(),
  getReport: vi.fn(),
  deleteReport: vi.fn()
}
const sdkAdmin = async () => adminManager as unknown as AdminManager

const authedRequestImpl = vi.fn()

const makeClient = () => ({
  reportEvent: vi.fn(),
  getRooms: vi.fn(() => []),
  getRoom: vi.fn(),
  http: { authedRequest: authedRequestImpl }
})

describe('AdminReportService', () => {
  let client: ReturnType<typeof makeClient>
  let service: AdminReportService

  beforeEach(() => {
    vi.clearAllMocks()
    authedRequestImpl.mockImplementation(
      async (method: string, path: string, queryParams?: unknown, body?: unknown, opts?: { prefix?: string }) => {
        const defaultPrefix = path.startsWith('/_') ? '' : PREFIX_V3
        const prefix = opts?.prefix ?? defaultPrefix
        const url = new URL(`${TEST_BASE_URL}${prefix}${path}`)
        if (queryParams && typeof queryParams === 'object') {
          for (const [key, value] of Object.entries(queryParams as Record<string, string>)) {
            url.searchParams.set(key, value)
          }
        }
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-access-token'
        }
        const response = await fetch(url.toString(), {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.json()
      }
    )
    client = makeClient()
    service = new AdminReportService(sdkAdmin, () => client as unknown as MatrixClient)
  })

  describe('reportEvent via ReportingManager', () => {
    it('调用 getReportingManager().reportEvent 并传 -50 中性 score', async () => {
      const reportEventMock = vi.fn().mockResolvedValue({})
      // 注入 ReportingManager 到 client 上
      ;(client as unknown as { getReportingManager?: () => unknown }).getReportingManager = () => ({
        reportEvent: reportEventMock
      })

      await service.reportEvent({ roomId: '!r:hs', eventId: '$e1', reason: 'spam' })

      expect(reportEventMock).toHaveBeenCalledWith('!r:hs', '$e1', -50, 'spam')
      // 不应再调用 client.reportEvent（旧 SDK 高层方法）
      expect(client.reportEvent).not.toHaveBeenCalled()
    })

    it('携带 explanation 时拼接到 reason', async () => {
      const reportEventMock = vi.fn().mockResolvedValue({})
      ;(client as unknown as { getReportingManager?: () => unknown }).getReportingManager = () => ({
        reportEvent: reportEventMock
      })

      await service.reportEvent({
        roomId: '!r:hs',
        eventId: '$e1',
        reason: 'spam',
        explanation: 'details'
      })

      expect(reportEventMock).toHaveBeenCalledWith('!r:hs', '$e1', -50, 'spam: details')
    })
  })

  it('reportRoom 走 v3 房间举报端点（FT-091: 使用 MATRIX_PATHS.MODERATION.REPORT_ROOM）', async () => {
    // 验证 L3 常量值（完整路径含 v3 前缀）
    expect(MATRIX_PATHS.MODERATION.REPORT_ROOM('!r:hs')).toBe('/_matrix/client/v3/rooms/!r%3Ahs/report')
    await expect(service.reportRoom('!r:hs', 'abuse', 'desc')).resolves.toEqual({ report_id: 'rep-1' })
    // prefixedAuthedRequest 剥离默认 v3 前缀后，authedRequest 收到相对路径（v3 是 SDK 默认前缀，opts=undefined）
    expect(authedRequestImpl).toHaveBeenCalledWith(
      'POST',
      '/rooms/!r%3Ahs/report',
      undefined,
      { reason: 'abuse', description: 'desc' },
      undefined
    )
  })

  it('reportRoom v3 失败时回退到首条时间线事件举报', async () => {
    server.use(
      http.post(`${TEST_BASE_URL}/_matrix/client/v3/rooms/:roomId/report`, () => {
        return HttpResponse.json({ errcode: 'M_UNRECOGNIZED' }, { status: 400 })
      })
    )
    // 回退会调用 reportEvent → ReportingManager.reportEvent
    const reportEventMock = vi.fn().mockResolvedValue({})
    ;(client as unknown as { getReportingManager?: () => unknown }).getReportingManager = () => ({
      reportEvent: reportEventMock
    })
    client.getRoom.mockReturnValueOnce({
      timeline: [{ getId: () => '$first' }]
    })

    await expect(service.reportRoom('!r:hs', 'abuse')).resolves.toEqual({ report_id: '' })
    expect(reportEventMock).toHaveBeenCalledWith('!r:hs', '$first', -50, 'abuse')
  })

  it('scoreReport 校验分值范围并委托 ReportingManager.scoreReport', async () => {
    const scoreReportMock = vi.fn().mockResolvedValue(undefined)
    ;(client as unknown as { getReportingManager?: () => unknown }).getReportingManager = () => ({
      scoreReport: scoreReportMock
    })

    await expect(service.scoreReport('!r:hs', '$e1', 5)).rejects.toThrow('matrix_error.admin.score_range_invalid')
    await expect(service.scoreReport('!r:hs', '$e1', -101)).rejects.toThrow('matrix_error.admin.score_range_invalid')
    expect(scoreReportMock).not.toHaveBeenCalled()

    await service.scoreReport('!r:hs', '$e1', -50)
    expect(scoreReportMock).toHaveBeenCalledWith('!r:hs', '$e1', -50)
  })

  it('getAdminReports 按 roomId 委托 listRoomReports 并映射响应', async () => {
    adminManager.listRoomReports.mockResolvedValue({
      reports: [{ id: 'rep-1' }],
      next_batch: 'nb'
    })

    await expect(service.getAdminReports('!r:hs', 25, 'from-1')).resolves.toEqual({
      reports: [{ id: 'rep-1' }],
      next_batch: 'nb'
    })
    expect(adminManager.listRoomReports).toHaveBeenCalledWith('!r:hs', { from: 'from-1', limit: 25 })
  })

  it('getAdminReports 无 roomId 时委托 listReports，出错时降级为空列表', async () => {
    adminManager.listReports.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getAdminReports()).resolves.toEqual({ reports: [] })
    expect(adminManager.listReports).toHaveBeenCalledWith({ from: undefined, limit: 50 })
  })

  it('dismissReport 委托 deleteReport 且失败时返回 false', async () => {
    adminManager.deleteReport.mockResolvedValueOnce(undefined)
    await expect(service.dismissReport('rep-1')).resolves.toBe(true)
    expect(adminManager.deleteReport).toHaveBeenCalledWith('rep-1')

    adminManager.deleteReport.mockRejectedValueOnce(new Error('boom'))
    await expect(service.dismissReport('rep-1')).resolves.toBe(false)
  })

  // FT-131-D: 所有降级方法支持 throwOnError 选项，让调用方可控区分 "not found" 与 "API 失败"
  describe('FT-131-D: throwOnError option', () => {
    it('getAdminReports throwOnError=true 时向上抛出而非降级空列表', async () => {
      adminManager.listReports.mockRejectedValueOnce(new Error('boom'))
      await expect(service.getAdminReports(undefined, 50, undefined, true)).rejects.toThrow()
    })

    it('dismissReport throwOnError=true 时向上抛出而非返回 false', async () => {
      adminManager.deleteReport.mockRejectedValueOnce(new Error('boom'))
      await expect(service.dismissReport('rep-1', true)).rejects.toThrow()
    })

    it('getAdminReport throwOnError=true 时向上抛出而非返回 null', async () => {
      adminManager.getReport.mockRejectedValueOnce(new Error('boom'))
      await expect(service.getAdminReport('rep-1', true)).rejects.toThrow()
    })
  })

  // Task 2: event-report 族已整体迁移至 MatrixEventReportService（走 getEventReportManager），
  // ReportService 不再裸调 /_synapse/admin/v1/event_reports，杜绝双轨。
  describe('event-report 族已删除（双轨消除）', () => {
    it('不再暴露任何裸调 event_reports 方法', () => {
      const svc = service as unknown as Record<string, unknown>
      const removedMethods = [
        'listEventReports',
        'listEventReportsByStatus',
        'countAllEventReports',
        'countEventReportsByStatus',
        'resolveEventReport',
        'dismissEventReport',
        'escalateEventReport',
        'deleteEventReport',
        'getEventReportHistory'
      ]
      for (const name of removedMethods) {
        expect(svc[name], `${name} 应已从 ReportService 删除，改由 MatrixEventReportService 承担`).toBeUndefined()
      }
    })
  })
})
