import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../MatrixClientService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

/**
 * FT-117: MatrixApplicationService 整体绕过SDK AdminManager
 *
 * 验证应用服务管理操作优先使用 SDK AdminManager，仅在 manager 不可用时
 * 回退到直接 HTTP 调用（遵循 MatrixPushService 的 SDK-first + REST fallback 模式）。
 * 错误必须抛给调用方，而不是静默返回 false/空数组。
 */
describe('MatrixApplicationService — SDK AdminManager (FT-117)', () => {
  let mockAuthedRequest: ReturnType<typeof vi.fn>
  let adminManagerMocks: Record<string, ReturnType<typeof vi.fn>>

  function buildMockClient(withAdminManager: boolean) {
    const client: Record<string, unknown> = {
      http: { authedRequest: mockAuthedRequest }
    }
    if (withAdminManager) {
      client.getAdminManager = () => adminManagerMocks
    }
    return client
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthedRequest = vi.fn().mockResolvedValue({})
    adminManagerMocks = {
      listApplicationServices: vi.fn().mockResolvedValue({ services: [], next_token: undefined }),
      registerApplicationService: vi.fn().mockResolvedValue({ id: 'as1' }),
      getApplicationService: vi.fn().mockResolvedValue(null),
      updateApplicationService: vi.fn().mockResolvedValue(undefined),
      deleteApplicationService: vi.fn().mockResolvedValue(undefined)
    }
  })

  function setClient(withAdminManager: boolean) {
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(
      buildMockClient(withAdminManager) as unknown as MatrixClient
    )
  }

  // ---- register ----
  describe('register', () => {
    it('uses SDK AdminManager.registerApplicationService when manager is available', async () => {
      setClient(true)
      const { matrixApplicationService } = await import('../MatrixApplicationService')

      const payload = {
        url: 'https://as.example.com',
        as_token: 'tok-1',
        sender: '@as:example.com'
      }
      await matrixApplicationService.register(payload)

      expect(adminManagerMocks.registerApplicationService).toHaveBeenCalledWith('tok-1', payload)
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })

    it('falls back to HTTP POST /appservices when AdminManager is unavailable', async () => {
      setClient(false)
      const { matrixApplicationService } = await import('../MatrixApplicationService')

      const payload = {
        url: 'https://as.example.com',
        as_token: 'tok-1',
        sender: '@as:example.com'
      }
      await matrixApplicationService.register(payload)

      expect(mockAuthedRequest).toHaveBeenCalledTimes(1)
      expect(mockAuthedRequest.mock.calls[0][0]).toBe('POST')
      expect(mockAuthedRequest.mock.calls[0][1]).toContain('/appservices')
    })

    it('propagates SDK errors instead of returning false', async () => {
      setClient(true)
      const { matrixApplicationService } = await import('../MatrixApplicationService')

      adminManagerMocks.registerApplicationService.mockRejectedValueOnce(new Error('HTTP 403'))

      await expect(
        matrixApplicationService.register({ url: 'https://as.example.com', as_token: 't', sender: '@as:x' })
      ).rejects.toThrow('HTTP 403')
    })
  })

  // ---- list ----
  describe('list', () => {
    it('uses SDK AdminManager.listApplicationServices when manager is available', async () => {
      setClient(true)
      const { matrixApplicationService } = await import('../MatrixApplicationService')

      adminManagerMocks.listApplicationServices.mockResolvedValueOnce({
        services: [{ id: 'as1', url: 'https://as1.example.com' }],
        next_token: 't'
      })
      const result = await matrixApplicationService.list()

      expect(adminManagerMocks.listApplicationServices).toHaveBeenCalled()
      expect(mockAuthedRequest).not.toHaveBeenCalled()
      expect(result).toEqual([{ id: 'as1', url: 'https://as1.example.com' }])
    })

    it('falls back to HTTP GET /appservices when AdminManager is unavailable', async () => {
      setClient(false)
      const { matrixApplicationService } = await import('../MatrixApplicationService')

      mockAuthedRequest.mockResolvedValueOnce({
        services: [{ id: 'as2', url: 'https://as2.example.com' }]
      })
      const result = await matrixApplicationService.list()

      expect(mockAuthedRequest).toHaveBeenCalledTimes(1)
      expect(mockAuthedRequest.mock.calls[0][0]).toBe('GET')
      expect(mockAuthedRequest.mock.calls[0][1]).toContain('/appservices')
      expect(result).toEqual([{ id: 'as2', url: 'https://as2.example.com' }])
    })

    it('propagates HTTP errors instead of returning empty array', async () => {
      setClient(false)
      const { matrixApplicationService } = await import('../MatrixApplicationService')

      mockAuthedRequest.mockRejectedValueOnce(new Error('HTTP 500'))

      await expect(matrixApplicationService.list()).rejects.toThrow('HTTP 500')
    })
  })

  // ---- setEnabled ----
  describe('setEnabled', () => {
    it('uses SDK AdminManager.updateApplicationService when manager is available', async () => {
      setClient(true)
      const { matrixApplicationService } = await import('../MatrixApplicationService')

      await matrixApplicationService.setEnabled('as1', false)

      expect(adminManagerMocks.updateApplicationService).toHaveBeenCalledWith('as1', { enabled: false })
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })

    it('falls back to HTTP PUT /appservices/:id when AdminManager is unavailable', async () => {
      setClient(false)
      const { matrixApplicationService } = await import('../MatrixApplicationService')

      await matrixApplicationService.setEnabled('as1', true)

      expect(mockAuthedRequest).toHaveBeenCalledTimes(1)
      expect(mockAuthedRequest.mock.calls[0][0]).toBe('PUT')
      expect(mockAuthedRequest.mock.calls[0][1]).toContain('/appservices/as1')
      expect(mockAuthedRequest.mock.calls[0][3]).toEqual({ enabled: true })
    })

    it('propagates SDK errors instead of returning false', async () => {
      setClient(true)
      const { matrixApplicationService } = await import('../MatrixApplicationService')

      adminManagerMocks.updateApplicationService.mockRejectedValueOnce(new Error('HTTP 403'))

      await expect(matrixApplicationService.setEnabled('as1', true)).rejects.toThrow('HTTP 403')
    })
  })

  // ---- getUsersNamespace ----
  describe('getUsersNamespace', () => {
    it('uses SDK AdminManager.getApplicationService when manager is available', async () => {
      setClient(true)
      const { matrixApplicationService } = await import('../MatrixApplicationService')

      adminManagerMocks.getApplicationService.mockResolvedValueOnce({
        namespaces: {
          users: [{ exclusive: true, pattern: '@as_.*' }]
        }
      })
      const result = await matrixApplicationService.getUsersNamespace('as1')

      expect(adminManagerMocks.getApplicationService).toHaveBeenCalledWith('as1')
      expect(mockAuthedRequest).not.toHaveBeenCalled()
      expect(result).toEqual([{ exclusive: true, pattern: '@as_.*' }])
    })

    it('falls back to HTTP GET /appservices/:id when AdminManager is unavailable', async () => {
      setClient(false)
      const { matrixApplicationService } = await import('../MatrixApplicationService')

      mockAuthedRequest.mockResolvedValueOnce({
        namespaces: {
          rooms: [{ exclusive: false, pattern: '#as_.*' }]
        }
      })
      const result = await matrixApplicationService.getRoomsNamespace('as1')

      expect(mockAuthedRequest).toHaveBeenCalledTimes(1)
      expect(mockAuthedRequest.mock.calls[0][0]).toBe('GET')
      expect(mockAuthedRequest.mock.calls[0][1]).toContain('/appservices/as1')
      expect(result).toEqual([{ exclusive: false, pattern: '#as_.*' }])
    })

    it('propagates errors instead of returning empty array', async () => {
      setClient(false)
      const { matrixApplicationService } = await import('../MatrixApplicationService')

      mockAuthedRequest.mockRejectedValueOnce(new Error('HTTP 404'))

      await expect(matrixApplicationService.getUsersNamespace('as1')).rejects.toThrow('HTTP 404')
    })
  })
})
