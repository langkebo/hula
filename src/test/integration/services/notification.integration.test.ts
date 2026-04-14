/**
 * MatrixNotificationService 集成测试
 * 测试与真实后端服务器的通知交互
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { INTEGRATION_TEST_CONFIG, isIntegrationTestEnabled } from '../config'
import {
  createTestUser,
  createTestRoom,
  cleanupTestResources,
  checkServerHealth,
  TestUser,
  TestRoom
} from '../fixtures'

describe.skipIf(!isIntegrationTestEnabled())('MatrixNotificationService Integration Tests', () => {
  let testUser: TestUser
  let testRoom: TestRoom
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
    testRoom = await createTestRoom(testUser)
  })

  describe('pushers', () => {
    it('should get pushers', async () => {
      const response = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/pushers`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(Array.isArray(data.pushers)).toBe(true)
    })

    it('should set pusher', async () => {
      const pusherData = {
        pushkey: `test_pushkey_${Date.now()}`,
        kind: 'http',
        app_id: 'com.test.app',
        app_display_name: 'Test App',
        device_display_name: 'Test Device',
        profile_tag: 'test_tag',
        lang: 'en',
        data: {
          url: 'https://example.com/push'
        }
      }

      const response = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/pushers/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(pusherData)
      })

      expect(response.ok).toBe(true)
    })

    it('should delete pusher', async () => {
      const pusherData = {
        pushkey: `test_pushkey_delete_${Date.now()}`,
        kind: null,
        app_id: 'com.test.app'
      }

      const response = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/pushers/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(pusherData)
      })

      expect(response.ok).toBe(true)
    })
  })

  describe('push rules', () => {
    it('should get push rules', async () => {
      const response = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/pushrules`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.global).toBeDefined()
    })

    it('should get push rules for room', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/pushrules/global/room/${encodeURIComponent(testRoom.roomId)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      expect([200, 404]).toContain(response.status)
    })

    it('should enable/disable push rule', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/pushrules/global/override/.m.rule.master/enabled`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ enabled: false })
        }
      )

      expect(response.ok).toBe(true)
    })
  })

  describe('notifications', () => {
    it('should get notifications', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/notifications?limit=10`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(Array.isArray(data.notifications)).toBe(true)
    })
  })

  describe('room notifications', () => {
    it('should get room notification settings', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/rooms/${testRoom.roomId}/account_data/m.room.push_rules`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      expect([200, 404]).toContain(response.status)
    })
  })
})
