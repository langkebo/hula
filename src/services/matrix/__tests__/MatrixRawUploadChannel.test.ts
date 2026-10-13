import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAbsoluteEndpointUrl, performRawUpload, RAW_UPLOAD_TIMEOUT_MS } from '../MatrixRawUploadChannel'

const { getMatrixHomeserverUrlMock, getMatrixAccessTokenMock, runtimeFetchMock, errorMock } = vi.hoisted(() => ({
  getMatrixHomeserverUrlMock: vi.fn(),
  getMatrixAccessTokenMock: vi.fn(),
  runtimeFetchMock: vi.fn(),
  errorMock: vi.fn()
}))

vi.mock('../matrixClientAccessor', () => ({
  getMatrixHomeserverUrl: getMatrixHomeserverUrlMock,
  getMatrixAccessToken: getMatrixAccessTokenMock
}))

vi.mock('@/services/backend', () => ({
  resolveMatrixRuntimeEndpointConfig: () => ({ homeserverUrl: 'https://fallback.matrix.test' })
}))

vi.mock('../network/runtimeFetch', () => ({
  getRuntimeAwareFetch: () => runtimeFetchMock,
  // 打标记即可验证「通道确实套了 dev 同源改写」，且不依赖 import.meta.env/DEV 环境
  rewriteToDevProxyUrl: (url: string) => `proxied:${url}`
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: errorMock, debug: vi.fn() })
}))

function jsonResponse(body: unknown, init: { status?: number; statusText?: string } = {}) {
  const status = init.status ?? 200
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: init.statusText ?? 'OK',
    headers: new Headers(),
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
  } as unknown as Response
}

describe('buildAbsoluteEndpointUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMatrixHomeserverUrlMock.mockReturnValue('https://hs.example.com/')
  })

  it('拼接 homeserver 与相对路径（去重斜杠）', () => {
    expect(buildAbsoluteEndpointUrl('_matrix/media/v3/upload')).toBe('https://hs.example.com/_matrix/media/v3/upload')
  })

  it('保留绝对 URL', () => {
    expect(buildAbsoluteEndpointUrl('https://other.example.com/x')).toBe('https://other.example.com/x')
  })

  it('追加并编码查询参数', () => {
    const url = buildAbsoluteEndpointUrl('_matrix/media/v3/upload', { filename: 'a b.txt', content_type: 'text/plain' })
    expect(url).toContain('filename=a+b.txt')
    expect(url).toContain('content_type=text%2Fplain')
  })

  it('homeserver 缺失时回退到运行时配置', () => {
    getMatrixHomeserverUrlMock.mockReturnValue(null)
    expect(buildAbsoluteEndpointUrl('x')).toBe('https://fallback.matrix.test/x')
  })
})

describe('performRawUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMatrixHomeserverUrlMock.mockReturnValue('https://hs.example.com')
    getMatrixAccessTokenMock.mockReturnValue('tok-1')
    runtimeFetchMock.mockResolvedValue(jsonResponse({ content_uri: 'mxc://ok' }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('POST 原始 body，并带 Content-Type 与 Authorization', async () => {
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })

    await expect(
      performRawUpload<{ content_uri: string }>('_matrix/media/v3/upload', file, { contentType: 'text/plain' })
    ).resolves.toEqual({ content_uri: 'mxc://ok' })

    expect(runtimeFetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = runtimeFetchMock.mock.calls[0]
    expect(url).toBe('proxied:https://hs.example.com/_matrix/media/v3/upload')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(file)
    expect(init.headers['Content-Type']).toBe('text/plain')
    expect(init.headers.Authorization).toBe('Bearer tok-1')
  })

  it('无 token 时不注入 Authorization', async () => {
    getMatrixAccessTokenMock.mockReturnValue(null)

    await performRawUpload('_matrix/media/v3/upload', new Blob(['x']), { contentType: 'text/plain' })

    expect(runtimeFetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('调用方显式给出的 Authorization 不被覆盖', async () => {
    await performRawUpload('_matrix/media/v3/upload', new Blob(['x']), {
      headers: { Authorization: 'Bearer custom' }
    })

    expect(runtimeFetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer custom')
  })

  it('非 2xx ⇒ 抛归一化错误并带 httpStatus（供 isPayloadTooLarge 等既有分流识别）', async () => {
    runtimeFetchMock.mockResolvedValue(
      jsonResponse({ errcode: 'M_TOO_LARGE', error: 'too big' }, { status: 413, statusText: 'Payload Too Large' })
    )

    let error: (Error & { httpStatus?: number; errcode?: string }) | undefined
    try {
      await performRawUpload('_matrix/media/v3/upload', new Blob(['x']))
    } catch (err) {
      error = err as Error & { httpStatus?: number; errcode?: string }
    }

    expect(error?.httpStatus).toBe(413)
    expect(error?.errcode).toBe('M_TOO_LARGE')
    expect(errorMock).toHaveBeenCalled()
  })

  it('200 但空响应体 ⇒ 返回 {}（不抛 JSON 解析错）', async () => {
    runtimeFetchMock.mockResolvedValue(jsonResponse(''))
    await expect(performRawUpload('p', new Blob(['x']))).resolves.toEqual({})
  })

  it('超时 ⇒ 中止请求（signal 被触发）', async () => {
    vi.useFakeTimers()
    let aborted = false
    runtimeFetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            aborted = true
            reject(new Error('aborted'))
          })
        })
    )

    const promise = performRawUpload('p', new Blob(['x']))
    const assertion = expect(promise).rejects.toThrow('aborted')
    await vi.advanceTimersByTimeAsync(RAW_UPLOAD_TIMEOUT_MS + 1)

    await assertion
    expect(aborted).toBe(true)
  })

  it('外部 signal 已中止 ⇒ 请求立即中止（不再发网络）', async () => {
    const controller = new AbortController()
    controller.abort()
    runtimeFetchMock.mockImplementation((_url: string, init: RequestInit) => {
      expect(init.signal?.aborted).toBe(true)
      return Promise.reject(new Error('aborted'))
    })

    await expect(performRawUpload('p', new Blob(['x']), { signal: controller.signal })).rejects.toThrow('aborted')
  })

  it('timeoutMs<=0 ⇒ 不设超时信号（signal 未被预置中止）', async () => {
    runtimeFetchMock.mockImplementation((_url: string, init: RequestInit) => {
      expect(init.signal?.aborted).toBe(false)
      return Promise.resolve(jsonResponse({ ok: true }))
    })

    await expect(performRawUpload('p', new Blob(['x']), { timeoutMs: 0 })).resolves.toEqual({ ok: true })
  })
})
