import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixHttpClient } from '../MatrixHttpClient'

const { getMatrixClientMock, infoMock, errorMock } = vi.hoisted(() => ({
  getMatrixClientMock: vi.fn(),
  infoMock: vi.fn(),
  errorMock: vi.fn()
}))

vi.mock('../matrixClientAccessor', () => ({
  getMatrixClient: getMatrixClientMock
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: infoMock,
  error: errorMock,
  warn: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => key
  })
}))

describe('MatrixHttpClient', () => {
  let authedRequest: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    authedRequest = vi.fn().mockResolvedValue({})
    getMatrixClientMock.mockReturnValue({
      http: { authedRequest }
    } as unknown as MatrixClient)
  })

  it('uses the accessor-provided Matrix client for GET requests', async () => {
    authedRequest.mockResolvedValueOnce({ ok: true })

    const result = await matrixHttpClient.get<{ ok: boolean }>('/test')

    expect(authedRequest).toHaveBeenCalledWith('GET', '/test', undefined)
    expect(result).toEqual({ ok: true })
  })

  it('passes body for POST requests', async () => {
    await matrixHttpClient.post('/send', { body: 'hello' })

    expect(authedRequest).toHaveBeenCalledWith('POST', '/send', undefined, { body: 'hello' })
    expect(infoMock).toHaveBeenCalled()
  })

  it('returns the default value when safe request fails', async () => {
    authedRequest.mockRejectedValueOnce(new Error('boom'))

    const result = await matrixHttpClient.get('/test', {
      defaultValue: { fallback: true }
    })

    expect(result).toEqual({ fallback: true })
    expect(errorMock).toHaveBeenCalled()
  })

  it('throws when throwOnError is enabled', async () => {
    authedRequest.mockRejectedValueOnce(new Error('boom'))

    await expect(
      matrixHttpClient.get('/test', {
        throwOnError: true
      })
    ).rejects.toThrow('boom')
  })

  it('returns false for delete when request fails', async () => {
    authedRequest.mockRejectedValueOnce(new Error('boom'))

    await expect(matrixHttpClient.delete('/test')).resolves.toBe(false)
  })

  it('builds encoded room and user paths', () => {
    expect(matrixHttpClient.buildRoomPath('!room:server', 'state')).toBe(
      '/_matrix/client/v3/rooms/!room%3Aserver/state'
    )
    expect(matrixHttpClient.buildUserPath('@user:server', 'account_data')).toBe(
      '/_matrix/client/v3/user/%40user%3Aserver/account_data'
    )
  })

  it('fails when the Matrix client accessor has not been registered', async () => {
    getMatrixClientMock.mockReturnValueOnce(null)

    await expect(matrixHttpClient.request('GET', '/test')).rejects.toThrow('matrix_error.common.client_not_initialized')
  })
})
