/**
 * MatrixSyncService 集成测试
 * 测试与真实后端服务器的同步交互
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { INTEGRATION_TEST_CONFIG, isIntegrationTestEnabled } from '../config'
import { createTestUser, createTestRoom, cleanupTestResources, checkServerHealth, TestUser } from '../fixtures'

describe.skipIf(!isIntegrationTestEnabled())('MatrixSyncService Integration Tests', () => {
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

  describe('initial sync', () => {
    it('should perform initial sync', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/sync?filter={"room":{"timeline":{"limit":10}}}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.next_batch).toBeDefined()
    })

    it('should handle incremental sync', async () => {
      const initialResponse = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/sync`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      const initialData = await initialResponse.json()

      const nextBatch = initialData.next_batch
      expect(nextBatch).toBeDefined()

      const incResponse = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/sync?since=${encodeURIComponent(nextBatch)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      expect(incResponse.ok).toBe(true)
    })

    it('should sync with timeout', async () => {
      const startTime = Date.now()
      const response = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/sync?timeout=1000`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      const elapsed = Date.now() - startTime

      expect(response.ok).toBe(true)
      expect(elapsed).toBeLessThan(5000)
    })
  })

  describe('presence sync', () => {
    it('should include presence in sync', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/sync?set_presence=online`,
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

  describe('room sync', () => {
    it('should sync room state', async () => {
      const room = await createTestRoom(testUser)

      const response = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/sync`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.rooms?.join?.[room.roomId]).toBeDefined()
    })
  })

  describe('filter management', () => {
    it('should create and use filter', async () => {
      const filterDef = {
        room: {
          timeline: { limit: 10 },
          state: { types: ['m.room.*'] }
        }
      }

      const createResponse = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/user/${encodeURIComponent(testUser.userId)}/filter`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify(filterDef)
        }
      )

      expect(createResponse.ok).toBe(true)
      const { filter_id } = await createResponse.json()
      expect(filter_id).toBeDefined()

      const syncResponse = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/sync?filter=${filter_id}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      expect(syncResponse.ok).toBe(true)
    })
  })
})
