import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('@/services/matrix/MatrixWorkerHost', () => ({
  matrixWorkerHost: { isStarted: false }
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => true
}))

vi.mock('@/utils/HttpClient', async () => {
  const actual = await vi.importActual<typeof import('@/utils/HttpClient')>('@/utils/HttpClient')
  return {
    ...actual,
    HttpClient: {
      get: vi.fn(),
      post: vi.fn()
    }
  }
})

import { HttpClient, HttpClientError } from '@/utils/HttpClient'
import { MatrixDiagnostics } from '../MatrixDiagnostics'
import { classifySlidingSyncEndpointStatus } from '../slidingSyncEndpointStatus'
import { matrixLoginFlowsResponse, matrixVersionsResponse } from './fixtures/matrixDiagnostics'

const get = HttpClient.get as unknown as ReturnType<typeof vi.fn>
const post = HttpClient.post as unknown as ReturnType<typeof vi.fn>

function mockVersionsAndLoginFlows(): void {
  get.mockResolvedValueOnce(matrixVersionsResponse)
  get.mockResolvedValueOnce(matrixLoginFlowsResponse)
}

describe('MatrixDiagnostics', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    mockVersionsAndLoginFlows()
  })

  /**
   * 回归：主线程探测走 HttpClient，401 表示端点已路由但需要认证。
   * 旧实现只读 `httpStatus`，读不到 HttpClientError.status，把 401 当成网络错误，
   * 于是对确实支持 Sliding Sync 的服务器误报「未找到可用的 Sliding Sync 端点」。
   */
  it('401（端点存在但需认证）判定为可用', async () => {
    post.mockRejectedValue(new HttpClientError('POST /sync failed with 401 Unauthorized', 401, 'Unauthorized', ''))

    const results = await new MatrixDiagnostics('https://matrix.test').runAll()
    const sliding = results.find((result) => result.name === 'Sliding Sync Endpoints')

    expect(sliding?.status).toBe('success')
  })

  it('404（端点不存在）仍判为错误', async () => {
    post.mockRejectedValue(new HttpClientError('POST /sync failed with 404 Not Found', 404, 'Not Found', ''))

    const results = await new MatrixDiagnostics('https://matrix.test').runAll()
    const sliding = results.find((result) => result.name === 'Sliding Sync Endpoints')

    expect(sliding?.status).toBe('error')
  })

  /**
   * POST 空 body 探测时，400/401/403/405/429 都说明路由已注册（body 不完整 / 缺鉴权 /
   * 方法受限 / 限流），不能判成「端点不存在」。
   */
  it('400（空 body 被拒绝）判定为可用', async () => {
    post.mockRejectedValue(new HttpClientError('POST /sync failed with 400 Bad Request', 400, 'Bad Request', ''))

    const results = await new MatrixDiagnostics('https://matrix.test').runAll()
    const sliding = results.find((result) => result.name === 'Sliding Sync Endpoints')

    expect(sliding?.status).toBe('success')
  })

  it('403 判定为可用（需鉴权）', async () => {
    post.mockRejectedValue(new HttpClientError('POST /sync failed with 403 Forbidden', 403, 'Forbidden', ''))

    const results = await new MatrixDiagnostics('https://matrix.test').runAll()
    const sliding = results.find((result) => result.name === 'Sliding Sync Endpoints')

    expect(sliding?.status).toBe('success')
    expect(sliding?.message).toBe('diagnostics.sliding_sync_requires_auth')
  })

  it('501（未实现）判为未实现，而不是网络错误', async () => {
    post.mockRejectedValue(
      new HttpClientError('POST /sync failed with 501 Not Implemented', 501, 'Not Implemented', '')
    )

    const results = await new MatrixDiagnostics('https://matrix.test').runAll()
    const sliding = results.find((result) => result.name === 'Sliding Sync Endpoints')

    expect(sliding?.status).toBe('error')
    expect(sliding?.message).toBe('diagnostics.sliding_sync_not_implemented')
  })

  it('网络异常标注为不可达（warning），不再误报未实现', async () => {
    post.mockRejectedValue(new TypeError('Failed to fetch'))

    const results = await new MatrixDiagnostics('https://matrix.test').runAll()
    const sliding = results.find((result) => result.name === 'Sliding Sync Endpoints')

    expect(sliding?.status).toBe('warning')
    expect(sliding?.message).toBe('diagnostics.sliding_sync_unreachable')
  })
})

describe('classifySlidingSyncEndpointStatus', () => {
  it.each([
    [400, 'available'],
    [401, 'available'],
    [403, 'available'],
    [405, 'available'],
    [429, 'available'],
    [200, 'available'],
    [404, 'not_implemented'],
    [501, 'not_implemented'],
    ['error', 'unreachable'],
    [undefined, 'unreachable'],
    [500, 'unreachable']
  ] as const)('%s → %s', (status, expected) => {
    expect(classifySlidingSyncEndpointStatus(status)).toBe(expected)
  })
})
