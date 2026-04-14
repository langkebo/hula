/**
 * MatrixAuthService 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MatrixAuthService } from '../MatrixAuthService'
import matrixClientService from '../MatrixClientService'

vi.mock('../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    getConfig: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('login', () => {
    it('应该使用 SDK Manager 登录成功', async () => {
      const mockClient = {
        getAccountManager: vi.fn().mockReturnValue({
          loginRequest: vi.fn().mockResolvedValue({
            user_id: '@test:example.com',
            access_token: 'test_token',
            device_id: 'test_device',
            home_server: 'example.com',
            refresh_token: 'refresh_token',
            expires_in_ms: 3600000
          })
        })
      }

      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await MatrixAuthService.login('testuser', 'password123')

      expect(result.user_id).toBe('@test:example.com')
      expect(result.access_token).toBe('test_token')
      expect(result.device_id).toBe('test_device')
      expect(mockClient.getAccountManager).toHaveBeenCalled()
    })

    it('应该在 SDK Manager 失败时降级到 MatrixClientService', async () => {
      const mockClient = {
        getAccountManager: vi.fn().mockReturnValue({
          loginRequest: vi.fn().mockRejectedValue(new Error('SDK error'))
        })
      }

      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)
      vi.mocked(matrixClientService.login).mockResolvedValue({
        success: true,
        userId: '@test:example.com',
        accessToken: 'fallback_token',
        deviceId: 'fallback_device'
      })

      const result = await MatrixAuthService.login('testuser', 'password123')

      expect(result.user_id).toBe('@test:example.com')
      expect(result.access_token).toBe('fallback_token')
    })

    it('应该在所有登录方式失败时抛出错误', async () => {
      const mockClient = {
        getAccountManager: vi.fn().mockReturnValue({
          loginRequest: vi.fn().mockRejectedValue(new Error('SDK error'))
        })
      }

      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)
      vi.mocked(matrixClientService.login).mockResolvedValue({
        success: false,
        error: 'Login failed'
      })

      await expect(MatrixAuthService.login('testuser', 'password123')).rejects.toThrow()
    })
  })

  describe('register', () => {
    it('应该使用 SDK Manager 注册成功', async () => {
      const mockClient = {
        register: vi.fn().mockResolvedValue({
          user_id: '@newuser:example.com',
          access_token: 'new_token',
          device_id: 'new_device'
        })
      }

      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await MatrixAuthService.register('newuser', 'password123')

      expect(result.user_id).toBe('@newuser:example.com')
      expect(result.access_token).toBe('new_token')
    })
  })

  describe('logout', () => {
    it('应该使用 SDK Manager 登出成功', async () => {
      const mockClient = {
        getAccountManager: vi.fn().mockReturnValue({
          logout: vi.fn().mockResolvedValue(undefined)
        })
      }

      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      await MatrixAuthService.logout()

      expect(mockClient.getAccountManager).toHaveBeenCalled()
    })
  })

  describe('getSupportedLoginFlows', () => {
    it('应该获取支持的登录流程', async () => {
      const mockFlows = [{ type: 'm.login.password' }, { type: 'm.login.sso' }]

      const mockClient = {
        getAuthManager: vi.fn().mockReturnValue({
          getSupportedLoginFlows: vi.fn().mockResolvedValue(mockFlows)
        })
      }

      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await MatrixAuthService.getSupportedLoginFlows()

      expect(result).toEqual(mockFlows)
    })
  })
})
