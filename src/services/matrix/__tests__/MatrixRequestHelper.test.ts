import type { MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import { matrixClientService } from '../MatrixClientService'
import { MatrixRequestHelper } from '../MatrixRequestHelper'

const TEST_BASE_URL = 'https://matrix.example.com'

const server = setupMswServer(
  http.get(`${TEST_BASE_URL}/test`, () => {
    return HttpResponse.json({ key: 'value' })
  }),
  http.post(`${TEST_BASE_URL}/test`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ event_id: '$e1', ...(body as Record<string, unknown>) })
  }),
  http.put(`${TEST_BASE_URL}/test`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ updated: true, ...(body as Record<string, unknown>) })
  }),
  http.delete(`${TEST_BASE_URL}/test`, () => {
    return HttpResponse.json({})
  })
)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixRequestHelper', () => {
  let mockHttp: { authedRequest: ReturnType<typeof vi.fn> }

  const authedRequestImpl = vi
    .fn()
    .mockImplementation(async (method: string, path: string, queryParams?: unknown, body?: unknown) => {
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
    })

  beforeEach(() => {
    vi.clearAllMocks()
    mockHttp = { authedRequest: authedRequestImpl }
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
      http: mockHttp as unknown as MatrixClient['http']
    } as unknown as MatrixClient)
  })

  describe('safeGet', () => {
    it('should return null when client not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      const result = await MatrixRequestHelper.safeGet('/test')
      expect(result).toBeNull()
    })

    it('should return data on success', async () => {
      const result = await MatrixRequestHelper.safeGet<{ key: string }>('/test')
      expect(result?.key).toBe('value')
    })

    it('should return default value on error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/test`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      const result = await MatrixRequestHelper.safeGet('/test', undefined, { defaultValue: { fallback: true } })
      expect((result as Record<string, unknown> | null)?.fallback).toBe(true)
    })

    it('should throw on error when throwOnError is true', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/test`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      await expect(MatrixRequestHelper.safeGet('/test', undefined, { throwOnError: true })).rejects.toThrow()
    })
  })

  describe('safePost', () => {
    it('should return null when client not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      const result = await MatrixRequestHelper.safePost('/test')
      expect(result).toBeNull()
    })

    it('should return data on success', async () => {
      const result = await MatrixRequestHelper.safePost<{ event_id: string }>('/test', { body: 'data' })
      expect(result?.event_id).toBe('$e1')
    })

    it('should return default value on error', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/test`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      const result = await MatrixRequestHelper.safePost('/test')
      expect(result).toBeNull()
    })

    it('should throw on error when throwOnError is true', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/test`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      await expect(MatrixRequestHelper.safePost('/test', undefined, { throwOnError: true })).rejects.toThrow()
    })
  })

  describe('safePut', () => {
    it('should return null when client not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      const result = await MatrixRequestHelper.safePut('/test')
      expect(result).toBeNull()
    })

    it('should return data on success', async () => {
      const result = await MatrixRequestHelper.safePut<{ updated: boolean }>('/test', { data: 'value' })
      expect(result?.updated).toBe(true)
    })

    it('should return default value on error', async () => {
      server.use(
        http.put(`${TEST_BASE_URL}/test`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      const result = await MatrixRequestHelper.safePut('/test')
      expect(result).toBeNull()
    })
  })

  describe('safeDelete', () => {
    it('should return false when client not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      const result = await MatrixRequestHelper.safeDelete('/test')
      expect(result).toBe(false)
    })

    it('should return true on success', async () => {
      const result = await MatrixRequestHelper.safeDelete('/test')
      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      server.use(
        http.delete(`${TEST_BASE_URL}/test`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      const result = await MatrixRequestHelper.safeDelete('/test')
      expect(result).toBe(false)
    })

    it('should throw on error when throwOnError is true', async () => {
      server.use(
        http.delete(`${TEST_BASE_URL}/test`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      await expect(MatrixRequestHelper.safeDelete('/test', { throwOnError: true })).rejects.toThrow()
    })
  })

  describe('encodeMatrixId', () => {
    it('should encode room ID', () => {
      const result = MatrixRequestHelper.encodeMatrixId('!room:server')
      expect(result).toBe('!room%3Aserver')
    })

    it('should encode user ID', () => {
      const result = MatrixRequestHelper.encodeMatrixId('@user:server')
      expect(result).toBe('%40user%3Aserver')
    })
  })

  describe('buildRoomPath', () => {
    it('should build room path with suffix', () => {
      const result = MatrixRequestHelper.buildRoomPath('!room:server', 'state')
      expect(result).toBe('/_matrix/client/v3/rooms/!room%3Aserver/state')
    })
  })

  describe('buildUserPath', () => {
    it('should build user path with suffix', () => {
      const result = MatrixRequestHelper.buildUserPath('@user:server', 'account_data')
      expect(result).toBe('/_matrix/client/v3/user/%40user%3Aserver/account_data')
    })
  })
})
