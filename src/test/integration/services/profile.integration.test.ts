/**
 * MatrixProfileService 集成测试
 * 测试与真实后端服务器的用户资料交互
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { INTEGRATION_TEST_CONFIG, isIntegrationTestEnabled } from '../config'
import { createTestUser, cleanupTestResources, checkServerHealth, TestUser } from '../fixtures'

describe.skipIf(!isIntegrationTestEnabled())('MatrixProfileService Integration Tests', () => {
  let testUser: TestUser
  let accessToken: string

  beforeAll(async () => {
    const serverOk = await checkServerHealth()
    if (!serverOk) {
      throw new Error('Backend server is not running.')
    }
  }, INTEGRATION_TEST_CONFIG.timeout.medium)

  afterAll(async () => {
    await cleanupTestResources()
  }, INTEGRATION_TEST_CONFIG.timeout.long)

  beforeEach(async () => {
    testUser = await createTestUser()
    accessToken = testUser.accessToken
  })

  describe('getProfile', () => {
    it('should get user profile', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/profile/${encodeURIComponent(testUser.userId)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      expect(response.ok).toBe(true)
      const profile = await response.json()
      expect(profile).toBeDefined()
    })

    it('should get displayname', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/profile/${encodeURIComponent(testUser.userId)}/displayname`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      expect(response.ok).toBe(true)
    })

    it('should get avatar url', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/profile/${encodeURIComponent(testUser.userId)}/avatar_url`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      expect(response.ok).toBe(true)
    })
  })

  describe('setProfile', () => {
    it('should set displayname', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/profile/${encodeURIComponent(testUser.userId)}/displayname`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            displayname: 'Integration Test User'
          })
        }
      )

      expect(response.ok).toBe(true)

      const getResponse = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/profile/${encodeURIComponent(testUser.userId)}/displayname`
      )
      const data = await getResponse.json()
      expect(data.displayname).toBe('Integration Test User')
    })

    it('should set avatar url', async () => {
      const avatarUrl = 'mxc://localhost/testavatar'

      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/profile/${encodeURIComponent(testUser.userId)}/avatar_url`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            avatar_url: avatarUrl
          })
        }
      )

      expect(response.ok).toBe(true)
    })
  })

  describe('presence', () => {
    it('should set presence status', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/presence/${encodeURIComponent(testUser.userId)}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            presence: 'online',
            status_msg: 'Integration testing'
          })
        }
      )

      expect(response.ok).toBe(true)
    })

    it('should get presence status', async () => {
      await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/presence/${encodeURIComponent(testUser.userId)}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            presence: 'online'
          })
        }
      )

      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/presence/${encodeURIComponent(testUser.userId)}/status`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.presence).toBeDefined()
    })
  })

  describe('account data', () => {
    it('should set and get account data', async () => {
      const testData = { custom_field: 'test_value' }

      const setResponse = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/user/${encodeURIComponent(testUser.userId)}/account_data/test.type`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify(testData)
        }
      )

      expect(setResponse.ok).toBe(true)

      const getResponse = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/user/${encodeURIComponent(testUser.userId)}/account_data/test.type`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      expect(getResponse.ok).toBe(true)
      const data = await getResponse.json()
      expect(data.custom_field).toBe('test_value')
    })
  })
})
