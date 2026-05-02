import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatrixRequestHelper } from '../MatrixRequestHelper'

vi.mock('../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => null as MatrixClient | null)
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixRequestHelper', () => {
  let matrixClientService: typeof import('../MatrixClientService').matrixClientService
  let mockHttp: { authedRequest: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    vi.clearAllMocks()
    matrixClientService = (await import('../MatrixClientService')).matrixClientService
    mockHttp = { authedRequest: vi.fn().mockResolvedValue({}) }
    vi.mocked(matrixClientService.getClient).mockReturnValue({
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
      mockHttp.authedRequest.mockResolvedValue({ key: 'value' })
      const result = await MatrixRequestHelper.safeGet<{ key: string }>('/test')
      expect(result?.key).toBe('value')
    })

    it('should return default value on error', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('fail'))
      const result = await MatrixRequestHelper.safeGet('/test', undefined, { defaultValue: { fallback: true } })
      expect((result as Record<string, unknown> | null)?.fallback).toBe(true)
    })

    it('should throw on error when throwOnError is true', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('fail'))
      await expect(MatrixRequestHelper.safeGet('/test', undefined, { throwOnError: true })).rejects.toThrow('fail')
    })
  })

  describe('safePost', () => {
    it('should return null when client not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      const result = await MatrixRequestHelper.safePost('/test')
      expect(result).toBeNull()
    })

    it('should return data on success', async () => {
      mockHttp.authedRequest.mockResolvedValue({ event_id: '$e1' })
      const result = await MatrixRequestHelper.safePost<{ event_id: string }>('/test', { body: 'data' })
      expect(result?.event_id).toBe('$e1')
    })

    it('should return default value on error', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('fail'))
      const result = await MatrixRequestHelper.safePost('/test')
      expect(result).toBeNull()
    })

    it('should throw on error when throwOnError is true', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('fail'))
      await expect(MatrixRequestHelper.safePost('/test', undefined, { throwOnError: true })).rejects.toThrow('fail')
    })
  })

  describe('safePut', () => {
    it('should return null when client not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      const result = await MatrixRequestHelper.safePut('/test')
      expect(result).toBeNull()
    })

    it('should return data on success', async () => {
      mockHttp.authedRequest.mockResolvedValue({ updated: true })
      const result = await MatrixRequestHelper.safePut<{ updated: boolean }>('/test', { data: 'value' })
      expect(result?.updated).toBe(true)
    })

    it('should return default value on error', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('fail'))
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
      mockHttp.authedRequest.mockResolvedValue({})
      const result = await MatrixRequestHelper.safeDelete('/test')
      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('fail'))
      const result = await MatrixRequestHelper.safeDelete('/test')
      expect(result).toBe(false)
    })

    it('should throw on error when throwOnError is true', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('fail'))
      await expect(MatrixRequestHelper.safeDelete('/test', { throwOnError: true })).rejects.toThrow('fail')
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
