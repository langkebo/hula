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

const sdkAdmin = async () => ({}) as unknown as AdminManager

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

  it('scoreReport 校验分值范围（-100~0），越界不发请求（FT-091: 使用 MATRIX_PATHS.MODERATION.REPORT_EVENT_SCORE）', async () => {
    // 验证 L3 常量值
    expect(MATRIX_PATHS.MODERATION.REPORT_EVENT_SCORE('v3', '!r:hs', '$e1')).toBe(
      '/_matrix/client/v3/rooms/!r%3Ahs/report/%24e1/score'
    )
    await expect(service.scoreReport('!r:hs', '$e1', 5)).rejects.toThrow('matrix_error.admin.score_range_invalid')
    await expect(service.scoreReport('!r:hs', '$e1', -101)).rejects.toThrow('matrix_error.admin.score_range_invalid')
    expect(authedRequestImpl).not.toHaveBeenCalled()

    await service.scoreReport('!r:hs', '$e1', -50)
    // prefixedAuthedRequest 剥离默认 v3 前缀后，authedRequest 收到相对路径（opts=undefined）
    expect(authedRequestImpl).toHaveBeenCalledWith(
      'PUT',
      '/rooms/!r%3Ahs/report/%24e1/score',
      undefined,
      { score: -50 },
      undefined
    )
  })

  it('getAdminReports 组装查询参数并映射响应', async () => {
    await expect(service.getAdminReports('!r:hs', 25, 'from-1')).resolves.toEqual({
      reports: [{ id: 'rep-1' }],
      next_batch: 'nb'
    })
    expect(authedRequestImpl).toHaveBeenCalledWith(
      'GET',
      '/reports',
      {
        limit: '25',
        room_id: '!r:hs',
        from: 'from-1'
      },
      undefined,
      { prefix: '/_synapse/admin/v1' }
    )
  })

  it('getAdminReports 出错时降级为空列表', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/_synapse/admin/v1/reports`, () => {
        return new HttpResponse(null, { status: 500 })
      })
    )
    await expect(service.getAdminReports()).resolves.toEqual({ reports: [] })
  })

  it('dismissReport 使用 DELETE 且失败时返回 false', async () => {
    await expect(service.dismissReport('rep-1')).resolves.toBe(true)
    expect(authedRequestImpl).toHaveBeenCalledWith('DELETE', '/reports/rep-1', undefined, undefined, {
      prefix: '/_synapse/admin/v1'
    })

    server.use(
      http.delete(`${TEST_BASE_URL}/_synapse/admin/v1/reports/:reportId`, () => {
        return new HttpResponse(null, { status: 500 })
      })
    )
    await expect(service.dismissReport('rep-1')).resolves.toBe(false)
  })

  // FT-131-D: 所有降级方法支持 throwOnError 选项，让调用方可控区分 "not found" 与 "API 失败"
  describe('FT-131-D: throwOnError option', () => {
    it('getAdminReports throwOnError=true 时向上抛出而非降级空列表', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_synapse/admin/v1/reports`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      await expect(service.getAdminReports(undefined, 50, undefined, true)).rejects.toThrow()
    })

    it('dismissReport throwOnError=true 时向上抛出而非返回 false', async () => {
      server.use(
        http.delete(`${TEST_BASE_URL}/_synapse/admin/v1/reports/:reportId`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      await expect(service.dismissReport('rep-1', true)).rejects.toThrow()
    })

    it('getAdminReport throwOnError=true 时向上抛出而非返回 null', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_synapse/admin/v1/reports/:reportId`, () => {
          return new HttpResponse(null, { status: 404 })
        })
      )
      await expect(service.getAdminReport('rep-1', true)).rejects.toThrow()
    })

    it('countAllEventReports throwOnError=true 时向上抛出而非返回 0', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_synapse/admin/v1/event_reports/count`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      await expect(service.countAllEventReports(true)).rejects.toThrow()
    })

    it('deleteEventReport throwOnError=true 时向上抛出而非返回 false', async () => {
      server.use(
        http.delete(`${TEST_BASE_URL}/_synapse/admin/v1/event_reports/:id`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      await expect(service.deleteEventReport(1, true)).rejects.toThrow()
    })
  })
})
