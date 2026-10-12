import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getClientMock } = vi.hoisted(() => ({
  getClientMock: vi.fn()
}))

vi.mock('../MatrixClientService', () => ({
  matrixClientService: { getClient: getClientMock }
}))

import {
  createMatrixTransportError,
  normalizeMatrixError,
  safeDelete,
  safeGet,
  safePost,
  safePut
} from '../MatrixRequestHelper'

describe('createMatrixTransportError', () => {
  it('normalizes 404 + M_NOT_FOUND without collapsing to a bare HTTP text', () => {
    const error = createMatrixTransportError({
      status: 404,
      statusText: 'Not Found',
      bodyText: '{"errcode":"M_NOT_FOUND"}'
    })

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('MatrixTransportError')
    expect(error.errcode).toBe('M_NOT_FOUND')
    expect(error.httpStatus).toBe(404)
    expect(error.errcode).not.toBe('')
    expect(error.message.startsWith('HTTP 404:')).toBe(false)
  })

  it('extracts retryAfterMs from the 429 body and mirrors it as snake_case', () => {
    const error = createMatrixTransportError({
      status: 429,
      bodyText: '{"errcode":"M_LIMIT_EXCEEDED","retry_after_ms":2000}'
    })

    expect(error.errcode).toBe('M_LIMIT_EXCEEDED')
    expect(error.httpStatus).toBe(429)
    expect(error.retryAfterMs).toBe(2000)
    expect(error.retry_after_ms).toBe(2000)
  })

  it('normalizes 401 + M_UNKNOWN_TOKEN', () => {
    const error = createMatrixTransportError({
      status: 401,
      bodyText: '{"errcode":"M_UNKNOWN_TOKEN"}'
    })

    expect(error.errcode).toBe('M_UNKNOWN_TOKEN')
    expect(error.httpStatus).toBe(401)
  })

  it('falls back to a non-empty errcode derived from the status code', () => {
    const error = createMatrixTransportError({ status: 404, bodyText: '' })

    expect(error.errcode).toBe('M_NOT_FOUND')
    expect(error.data).toEqual({})
  })

  it('reads retry-after seconds from the Retry-After header', () => {
    const error = createMatrixTransportError({
      status: 429,
      bodyText: '',
      headers: { get: (name: string) => (name === 'Retry-After' ? '5' : null) }
    })

    expect(error.retryAfterMs).toBe(5000)
  })

  it('uses the response body error field as the message', () => {
    const error = createMatrixTransportError({
      status: 403,
      bodyText: '{"error":"forbidden"}'
    })

    expect(error.message).toBe('forbidden')
    expect(error.errcode).toBe('M_FORBIDDEN')
  })

  it('honors an explicit message override', () => {
    const error = createMatrixTransportError({
      status: 429,
      bodyText: '',
      message: 'rate_limited_key'
    })

    expect(error.message).toBe('rate_limited_key')
    expect(error.errcode).toBe('M_LIMIT_EXCEEDED')
  })
})

describe('normalizeMatrixError', () => {
  it('returns an existing MatrixTransportError unchanged', () => {
    const original = createMatrixTransportError({ status: 500, bodyText: '{}' })
    expect(normalizeMatrixError(original)).toBe(original)
  })

  it('extracts errcode/httpStatus/retryAfterMs from an SDK-shaped error', () => {
    const sdkError = {
      errcode: 'M_LIMIT_EXCEEDED',
      httpStatus: 429,
      data: { retry_after_ms: 1500 },
      message: 'Too many requests'
    }

    const error = normalizeMatrixError(sdkError)

    expect(error.errcode).toBe('M_LIMIT_EXCEEDED')
    expect(error.httpStatus).toBe(429)
    expect(error.retryAfterMs).toBe(1500)
    expect(error.retry_after_ms).toBe(1500)
    expect(error.message).toBe('Too many requests')
  })

  it('wraps a plain Error with a non-empty errcode and zero status', () => {
    const error = normalizeMatrixError(new Error('boom'))

    expect(error.errcode).toBe('M_UNKNOWN')
    expect(error.httpStatus).toBe(0)
    expect(error.message).toBe('boom')
  })
})

describe('safe request helpers', () => {
  let authedRequest: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    authedRequest = vi.fn()
    getClientMock.mockReturnValue({ http: { authedRequest } })
  })

  it('safeGet issues a GET through the SDK auth channel', async () => {
    authedRequest.mockResolvedValueOnce({ ok: true })

    await expect(safeGet<{ ok: boolean }>('/p', { a: '1' })).resolves.toEqual({ ok: true })
    expect(authedRequest).toHaveBeenCalledWith('GET', '/p', { a: '1' })
  })

  it('safePost and safePut forward the body', async () => {
    authedRequest.mockResolvedValue({ ok: true })

    await safePost('/p', { x: 1 })
    expect(authedRequest).toHaveBeenCalledWith('POST', '/p', undefined, { x: 1 })

    await safePut('/p', { y: 2 }, { q: 'z' })
    expect(authedRequest).toHaveBeenCalledWith('PUT', '/p', { q: 'z' }, { y: 2 })
  })

  it('safeDelete issues a DELETE', async () => {
    authedRequest.mockResolvedValue({})

    await safeDelete('/p')
    expect(authedRequest).toHaveBeenCalledWith('DELETE', '/p', undefined)
  })

  it('normalizes a rejection into a MatrixTransportError', async () => {
    authedRequest.mockRejectedValueOnce({ errcode: 'M_FORBIDDEN', httpStatus: 403, message: 'denied' })

    await expect(safeGet('/p')).rejects.toMatchObject({
      name: 'MatrixTransportError',
      errcode: 'M_FORBIDDEN',
      httpStatus: 403
    })
  })

  it('throws a normalized error when the client is not initialized', async () => {
    getClientMock.mockReturnValueOnce(null)

    await expect(safeGet('/p')).rejects.toMatchObject({
      name: 'MatrixTransportError',
      httpStatus: 0
    })
    expect(authedRequest).not.toHaveBeenCalled()
  })
})
