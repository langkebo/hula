import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { getRuntimeAwareFetch } from '../../network/runtimeFetch'
import { SynapseExtensionHttpBase } from '../SynapseExtensionHttpBase'

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getHomeserverUrl: vi.fn(),
    getAccessToken: vi.fn(),
    waitForClientReady: vi.fn()
  }
}))

vi.mock('../../network/runtimeFetch', () => ({
  getRuntimeAwareFetch: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

/** 暴露 protected 方法的测试子类 */
class TestExt extends SynapseExtensionHttpBase {
  public init(): Promise<void> {
    return this.initialize()
  }
  public req<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, options)
  }
  public unwrap<T>(response: unknown): T | undefined {
    return this.unwrapMaybeWrappedData<T>(response as never)
  }
  public avail(endpoint: string): Promise<boolean> {
    return this.checkEndpointAvailability(endpoint)
  }
}

function makeResponse(args: { ok: boolean; status: number; textResp?: string; retryAfter?: string }): Response {
  return {
    ok: args.ok,
    status: args.status,
    text: async () => args.textResp ?? '',
    headers: { get: (k: string) => (k === 'Retry-After' ? (args.retryAfter ?? null) : null) }
  } as unknown as Response
}

describe('SynapseExtensionHttpBase', () => {
  const getHomeserverUrl = matrixClientService.getHomeserverUrl as ReturnType<typeof vi.fn>
  const getAccessToken = matrixClientService.getAccessToken as ReturnType<typeof vi.fn>
  const getRuntimeAwareFetchMock = getRuntimeAwareFetch as ReturnType<typeof vi.fn>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getHomeserverUrl.mockReset()
    getAccessToken.mockReset()
    getRuntimeAwareFetchMock.mockReset()
    fetchMock = vi.fn()
    getRuntimeAwareFetchMock.mockReturnValue(fetchMock)
    getHomeserverUrl.mockReturnValue('https://hs.example.com')
    getAccessToken.mockReturnValue('tok')
  })

  describe('unwrapMaybeWrappedData', () => {
    it('returns plain object unchanged', () => {
      const ext = new TestExt()
      expect(ext.unwrap({ a: 1 })).toEqual({ a: 1 })
    })

    it('returns wrapped data for {data}', () => {
      const ext = new TestExt()
      expect(ext.unwrap({ data: { id: 1 } })).toEqual({ id: 1 })
    })

    it('throws on {status:error, message}', () => {
      const ext = new TestExt()
      expect(() => ext.unwrap({ status: 'error', message: 'boom' })).toThrow('boom')
    })

    it('throws default message on {status:error} without message', () => {
      const ext = new TestExt()
      expect(() => ext.unwrap({ status: 'error' })).toThrow('matrix_error.common.request_failed')
    })

    it('returns undefined for {status:ok} with no data and no extra fields', () => {
      const ext = new TestExt()
      expect(ext.unwrap({ status: 'ok', data: undefined })).toBeUndefined()
    })

    it('returns remaining fields for {status:ok} with no data', () => {
      const ext = new TestExt()
      expect(ext.unwrap({ status: 'ok', data: undefined, extra: 1 })).toEqual({ extra: 1 })
    })

    it('returns primitive unchanged', () => {
      const ext = new TestExt()
      expect(ext.unwrap(42)).toBe(42)
      expect(ext.unwrap(null)).toBeNull()
    })
  })

  describe('request', () => {
    it('parses JSON response', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{"ok":true}' }))
      const ext = new TestExt()
      await ext.init()
      const result = await ext.req<{ ok: boolean }>('/endpoint')
      expect(result).toEqual({ ok: true })
    })

    it('returns {} for empty body', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '  ' }))
      const ext = new TestExt()
      await ext.init()
      expect(await ext.req('/e')).toEqual({})
    })

    it('returns {} for non-JSON body', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: 'hello' }))
      const ext = new TestExt()
      await ext.init()
      expect(await ext.req('/e')).toEqual({})
    })

    it('adds auth header and no content-type for GET', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      const ext = new TestExt()
      await ext.init()
      await ext.req('/e')

      const [, init] = fetchMock.mock.calls[0]
      expect(init).toMatchObject({ headers: { Authorization: 'Bearer tok' } })
      expect(init.headers['Content-Type']).toBeUndefined()
    })

    it('adds content-type for POST', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      const ext = new TestExt()
      await ext.init()
      await ext.req('/e', { method: 'POST' })

      const [, init] = fetchMock.mock.calls[0]
      expect(init.headers['Content-Type']).toBe('application/json')
    })

    it('throws rate_limited on 429', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: false, status: 429, retryAfter: '5' }))
      const ext = new TestExt()
      await ext.init()
      await expect(ext.req('/e')).rejects.toThrow('matrix_error.extensions.rate_limited')
    })

    it('throws parsed error message on 4xx', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: false, status: 403, textResp: '{"error":"forbidden"}' }))
      const ext = new TestExt()
      await ext.init()
      await expect(ext.req('/e')).rejects.toThrow('forbidden')
    })
  })

  describe('checkEndpointAvailability', () => {
    it('uses HEAD and caches true for ok', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200 }))
      const ext = new TestExt()
      await ext.init()
      expect(await ext.avail('/e')).toBe(true)
      expect(fetchMock).toHaveBeenCalledWith('https://hs.example.com/e', {
        method: 'HEAD',
        headers: { Authorization: 'Bearer tok' }
      })
    })

    it('treats 405 as available', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: false, status: 405 }))
      const ext = new TestExt()
      await ext.init()
      expect(await ext.avail('/e')).toBe(true)
    })

    it('treats 404 as unavailable', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: false, status: 404 }))
      const ext = new TestExt()
      await ext.init()
      expect(await ext.avail('/e')).toBe(false)
    })

    it('caches result and does not refetch', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200 }))
      const ext = new TestExt()
      await ext.init()
      await ext.avail('/e')
      await ext.avail('/e')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('caches false on network error', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      const ext = new TestExt()
      await ext.init()
      expect(await ext.avail('/e')).toBe(false)
    })
  })

  describe('initialize / clear / stop', () => {
    it('initialize reads config when client config present', async () => {
      const ext = new TestExt()
      await ext.init()
      expect(matrixClientService.waitForClientReady).not.toHaveBeenCalled()
    })

    it('clear resets state and stop clears token', async () => {
      const ext = new TestExt()
      await ext.init()
      ext.stop()
      // stop 后 token 被清空，重新请求应重新初始化
      await ext.init()
      ext.clear()
    })
  })
})
