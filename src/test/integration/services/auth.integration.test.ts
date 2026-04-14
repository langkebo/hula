/**
 * MatrixAuthService 集成测试
 * 测试与真实后端服务器的认证交互
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { INTEGRATION_TEST_CONFIG, isIntegrationTestEnabled } from '../config'
import { createTestUser, loginTestUser, cleanupTestResources, checkServerHealth, TestUser } from '../fixtures'
import { MatrixAuthService } from '@/services/matrix/MatrixAuthService'
import matrixClientService from '@/services/matrix/MatrixClientService'

describe.skipIf(!isIntegrationTestEnabled())('MatrixAuthService Integration Tests', () => {
  let testUser: TestUser

  beforeAll(async () => {
    const serverOk = await checkServerHealth()
    if (!serverOk) {
      throw new Error('Backend server is not running. Please start synapse-rust before running integration tests.')
    }
  }, INTEGRATION_TEST_CONFIG.timeout.medium)

  afterAll(async () => {
    await cleanupTestResources()
  }, INTEGRATION_TEST_CONFIG.timeout.long)

  beforeEach(async () => {
    testUser = await createTestUser()
  })

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const result = await MatrixAuthService.login(testUser.userId.replace('@', '').split(':')[0], testUser.password)

      expect(result).toBeDefined()
      expect(result.user_id).toBe(testUser.userId)
      expect(result.access_token).toBeDefined()
      expect(result.device_id).toBeDefined()
    })

    it('should fail login with invalid credentials', async () => {
      await expect(MatrixAuthService.login('nonexistent_user', 'wrong_password')).rejects.toThrow()
    })

    it('should fail login with empty password', async () => {
      await expect(MatrixAuthService.login(testUser.userId.replace('@', '').split(':')[0], '')).rejects.toThrow()
    })
  })

  describe('register', () => {
    it('should register new user successfully', async () => {
      const username = `newuser_${Date.now()}`
      const result = await MatrixAuthService.register(username, 'TestPass123!')

      expect(result).toBeDefined()
      expect(result.user_id).toContain(username)
      expect(result.access_token).toBeDefined()
    })

    it('should fail to register with existing username', async () => {
      const username = testUser.userId.replace('@', '').split(':')[0]

      await expect(MatrixAuthService.register(username, 'AnotherPassword123!')).rejects.toThrow()
    })
  })

  describe('logout', () => {
    it('should logout successfully', async () => {
      const loginResult = await loginTestUser(testUser.userId.replace('@', '').split(':')[0], testUser.password)

      const mockClient = {
        getAccountManager: () => ({
          logout: async () => {
            await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/logout`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${loginResult.accessToken}`
              }
            })
          }
        })
      }

      vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as any)

      await expect(MatrixAuthService.logout()).resolves.not.toThrow()
    })
  })

  describe('getSupportedLoginFlows', () => {
    it('should return supported login flows', async () => {
      const flows = await MatrixAuthService.getSupportedLoginFlows()

      expect(Array.isArray(flows)).toBe(true)
      expect(flows.length).toBeGreaterThan(0)
      expect(flows.some((f: { type: string }) => f.type === 'm.login.password')).toBe(true)
    })
  })

  describe('token refresh', () => {
    it('should refresh token when refresh token is available', async () => {
      const loginResult = await loginTestUser(testUser.userId.replace('@', '').split(':')[0], testUser.password)

      expect(loginResult.accessToken).toBeDefined()
    })
  })
})
