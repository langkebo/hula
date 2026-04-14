/**
 * MatrixAdminService 集成测试
 * 测试与真实后端服务器的管理 API 交互
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { INTEGRATION_TEST_CONFIG, isIntegrationTestEnabled } from '../config'
import {
  createTestUser,
  createTestRoom,
  cleanupTestResources,
  checkServerHealth,
  loginTestUser,
  TestUser
} from '../fixtures'

describe.skipIf(!isIntegrationTestEnabled())('MatrixAdminService Integration Tests', () => {
  let adminToken: string
  let testUser: TestUser

  beforeAll(async () => {
    const serverOk = await checkServerHealth()
    if (!serverOk) {
      throw new Error('Backend server is not running.')
    }

    try {
      const admin = await loginTestUser(
        INTEGRATION_TEST_CONFIG.adminUser.username,
        INTEGRATION_TEST_CONFIG.adminUser.password
      )
      adminToken = admin.accessToken
    } catch {}

    testUser = await createTestUser()
  }, INTEGRATION_TEST_CONFIG.timeout.medium)

  afterAll(async () => {
    await cleanupTestResources()
  }, INTEGRATION_TEST_CONFIG.timeout.long)

  describe('server info', () => {
    it('should get server version', async () => {
      const response = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/versions`)

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.versions).toBeDefined()
      expect(Array.isArray(data.versions)).toBe(true)
    })

    it('should get server capabilities', async () => {
      const response = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/capabilities`, {
        headers: {
          Authorization: `Bearer ${testUser.accessToken}`
        }
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.capabilities).toBeDefined()
    })
  })

  describe('user management (admin)', () => {
    it.skipIf(!adminToken)('should list users', async () => {
      const response = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_synapse/admin/v2/users?limit=10`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(Array.isArray(data.users)).toBe(true)
    })

    it.skipIf(!adminToken)('should get user info', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_synapse/admin/v2/users/${encodeURIComponent(testUser.userId)}`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`
          }
        }
      )

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.name).toBe(testUser.userId)
    })
  })

  describe('room management (admin)', () => {
    let testRoom: { roomId: string }

    beforeAll(async () => {
      testRoom = await createTestRoom(testUser)
    })

    it.skipIf(!adminToken)('should list rooms', async () => {
      const response = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_synapse/admin/v1/rooms?limit=10`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(Array.isArray(data.rooms)).toBe(true)
    })

    it.skipIf(!adminToken)('should get room info', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_synapse/admin/v1/rooms/${encodeURIComponent(testRoom.roomId)}`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`
          }
        }
      )

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.room_id).toBe(testRoom.roomId)
    })

    it.skipIf(!adminToken)('should get room members', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_synapse/admin/v1/rooms/${encodeURIComponent(testRoom.roomId)}/members`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`
          }
        }
      )

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(Array.isArray(data.members)).toBe(true)
    })
  })

  describe('server statistics', () => {
    it.skipIf(!adminToken)('should get server status', async () => {
      const response = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_synapse/admin/v1/server_stats`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      })

      expect(response.ok).toBe(true)
    })
  })

  describe('federation', () => {
    it('should get federation status', async () => {
      const response = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/login`, {
        method: 'GET'
      })

      expect(response.ok).toBe(true)
    })
  })
})
