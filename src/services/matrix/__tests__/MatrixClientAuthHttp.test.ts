import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loginByHttpFallback, tokenLoginByHttpFallback } from '../MatrixClientAuthHttp'
import { getRuntimeAwareFetch } from '../network/runtimeFetch'

vi.mock('../network/runtimeFetch', () => ({
  getRuntimeAwareFetch: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

interface FakeRespArgs {
  ok: boolean
  status: number
  json?: unknown
  text?: string
}

function makeResponse({ ok, status, json, text }: FakeRespArgs): Response {
  return {
    ok,
    status,
    json: async () => json,
    text: async () => text ?? '',
    clone: () => ({ json: async () => json })
  } as unknown as Response
}

describe('MatrixClientAuthHttp', () => {
  const getRuntimeAwareFetchMock = getRuntimeAwareFetch as ReturnType<typeof vi.fn>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getRuntimeAwareFetchMock.mockReset()
    fetchMock = vi.fn()
    getRuntimeAwareFetchMock.mockReturnValue(fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loginByHttpFallback builds correct url and password body', async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, json: { user_id: '@u' } }))
    const result = await loginByHttpFallback('https://hs.example.com/', 'u', 'pw', 'MyDevice')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hs.example.com/_matrix/client/v3/login',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'm.login.password',
          user: 'u',
          password: 'pw',
          initial_device_display_name: 'MyDevice'
        })
      })
    )
    expect(result).toEqual({ user_id: '@u' })
  })

  it('loginByHttpFallback defaults device name', async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, json: { user_id: '@u' } }))
    await loginByHttpFallback('https://hs.example.com', 'u', 'pw')
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body)
    expect(body.initial_device_display_name).toBe('Tjg Client')
  })

  it('tokenLoginByHttpFallback builds token body', async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, json: { user_id: '@u' } }))
    await tokenLoginByHttpFallback('https://hs.example.com', 'sso_token')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hs.example.com/_matrix/client/v3/login',
      expect.objectContaining({
        body: JSON.stringify({ type: 'm.login.token', token: 'sso_token' })
      })
    )
  })

  it('retries after short 429 and succeeds', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 429, json: { retry_after_ms: 100 } }))
      .mockResolvedValueOnce(makeResponse({ ok: true, status: 200, json: { user_id: '@u' } }))

    const promise = loginByHttpFallback('https://hs.example.com', 'u', 'pw')
    await vi.advanceTimersByTimeAsync(100)
    const result = await promise

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ user_id: '@u' })
  })

  it('throws M_LIMIT_EXCEEDED when retry_after_ms > 60s', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(makeResponse({ ok: false, status: 429, json: { retry_after_ms: 900000 } }))

    const promise = loginByHttpFallback('https://hs.example.com', 'u', 'pw')
    await expect(promise).rejects.toMatchObject({ errcode: 'M_LIMIT_EXCEEDED', retry_after_ms: 900000 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws error text for non-2xx non-429', async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: false, status: 403, text: 'forbidden' }))
    await expect(loginByHttpFallback('https://hs.example.com', 'u', 'pw')).rejects.toThrow('forbidden')
  })

  it('throws login failure error when 429 persists beyond max retries', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(makeResponse({ ok: false, status: 429, json: { retry_after_ms: 100 } }))

    const promise = loginByHttpFallback('https://hs.example.com', 'u', 'pw')
    promise.catch(() => {}) // 防止 fake timers 期间的 unhandled rejection
    await vi.advanceTimersByTimeAsync(1000)
    await expect(promise).rejects.toThrow('matrix_error.auth.login_failed_with_status')
    expect(fetchMock).toHaveBeenCalledTimes(3) // maxRetries(2) + 1 次原始尝试
  })
})
