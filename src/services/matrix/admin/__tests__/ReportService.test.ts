import type { MatrixClient } from 'matrix-js-sdk'
import type { AdminManager } from 'matrix-js-sdk/admin'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import { AdminReportService } from '../ReportService'

const TEST_BASE_URL = 'https://matrix.example.com'

const server = setupMswServer(
  http.post(`${TEST_BASE_URL}/rooms/:roomId/report`, () => {
    return HttpResponse.json({ report_id: 'rep-1' })
  }),
  http.put(`${TEST_BASE_URL}/rooms/:roomId/report/:eventId/score`, () => {
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
      async (method: string, path: string, queryParams?: unknown, body?: unknown) => {
        const url = new URL(`${TEST_BASE_URL}${path}`)
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

  it('reportEvent 委托 client.reportEvent 并默认空说明', async () => {
    client.reportEvent.mockResolvedValueOnce(undefined)

    await service.reportEvent({ roomId: '!r:hs', eventId: '$e1', reason: 'spam' })

    expect(client.reportEvent).toHaveBeenCalledWith('!r:hs', '$e1', 'spam', '')
  })

  it('reportRoom 走 v3 房间举报端点', async () => {
    await expect(service.reportRoom('!r:hs', 'abuse', 'desc')).resolves.toEqual({ report_id: 'rep-1' })
    expect(authedRequestImpl).toHaveBeenCalledWith('POST', '/rooms/!r%3Ahs/report', undefined, {
      reason: 'abuse',
      description: 'desc'
    })
  })

  it('reportRoom v3 失败时回退到首条时间线事件举报', async () => {
    server.use(
      http.post(`${TEST_BASE_URL}/rooms/:roomId/report`, () => {
        return HttpResponse.json({ errcode: 'M_UNRECOGNIZED' }, { status: 400 })
      })
    )
    client.reportEvent.mockResolvedValueOnce(undefined)
    client.getRoom.mockReturnValueOnce({
      timeline: [{ getId: () => '$first' }]
    })

    await expect(service.reportRoom('!r:hs', 'abuse')).resolves.toEqual({ report_id: '' })
    expect(client.reportEvent).toHaveBeenCalledWith('!r:hs', '$first', 'abuse', '')
  })

  it('scoreReport 校验分值范围（-100~0），越界不发请求', async () => {
    await expect(service.scoreReport('!r:hs', '$e1', 5)).rejects.toThrow('matrix_error.admin.score_range_invalid')
    await expect(service.scoreReport('!r:hs', '$e1', -101)).rejects.toThrow('matrix_error.admin.score_range_invalid')
    expect(authedRequestImpl).not.toHaveBeenCalled()

    await service.scoreReport('!r:hs', '$e1', -50)
    expect(authedRequestImpl).toHaveBeenCalledWith('PUT', '/rooms/!r%3Ahs/report/%24e1/score', undefined, {
      score: -50
    })
  })

  it('getAdminReports 组装查询参数并映射响应', async () => {
    await expect(service.getAdminReports('!r:hs', 25, 'from-1')).resolves.toEqual({
      reports: [{ id: 'rep-1' }],
      next_batch: 'nb'
    })
    expect(authedRequestImpl).toHaveBeenCalledWith('GET', '/_synapse/admin/v1/reports', {
      limit: '25',
      room_id: '!r:hs',
      from: 'from-1'
    })
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
    expect(authedRequestImpl).toHaveBeenCalledWith('DELETE', '/_synapse/admin/v1/reports/rep-1')

    server.use(
      http.delete(`${TEST_BASE_URL}/_synapse/admin/v1/reports/:reportId`, () => {
        return new HttpResponse(null, { status: 500 })
      })
    )
    await expect(service.dismissReport('rep-1')).resolves.toBe(false)
  })
})
