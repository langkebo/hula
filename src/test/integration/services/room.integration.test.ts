/**
 * MatrixRoomService 集成测试
 * 测试与真实后端服务器的房间交互
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
import { matrixRoomService } from '@/services/matrix/MatrixRoomService'
import matrixClientService from '@/services/matrix/MatrixClientService'

describe.skipIf(!isIntegrationTestEnabled())('MatrixRoomService Integration Tests', () => {
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

  const mockClient = (token: string) => ({
    getRoomSummaryManager: () => ({
      getRoomSummary: async (roomId: string) => {
        const response = await fetch(
          `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_synapse/room_summary/v1/summary/${roomId}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        )
        if (!response.ok) throw new Error('Failed to get room summary')
        return response.json()
      },
      getRoomMembers: async (roomId: string) => {
        const response = await fetch(
          `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/rooms/${roomId}/members`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        )
        if (!response.ok) throw new Error('Failed to get room members')
        return response.json()
      }
    }),
    getRooms: () => [],
    getRoom: () => null
  })

  describe('getRoomSummary', () => {
    it('should get room summary for existing room', async () => {
      vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient(accessToken) as any)

      const summary = await matrixRoomService.getRoomSummary(testRoom.roomId)

      expect(summary).toBeDefined()
      expect(summary?.roomId).toBe(testRoom.roomId)
    })

    it('should fail for non-existent room', async () => {
      vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient(accessToken) as any)

      await expect(matrixRoomService.getRoomSummary('!nonexistent:localhost')).rejects.toThrow()
    })
  })

  describe('getRoomMembers', () => {
    it('should get room members for existing room', async () => {
      vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient(accessToken) as any)

      const members = await matrixRoomService.getMembers(testRoom.roomId)

      expect(members).toBeDefined()
      expect(Array.isArray(members)).toBe(true)
      expect(members.length).toBeGreaterThan(0)
    })
  })

  describe('createRoom', () => {
    it('should create room successfully', async () => {
      const response = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/createRoom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          name: 'Integration Test Room',
          preset: 'private_chat'
        })
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.room_id).toBeDefined()
    })

    it('should create public room', async () => {
      const response = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/createRoom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          name: 'Public Test Room',
          preset: 'public_chat',
          visibility: 'public'
        })
      })

      expect(response.ok).toBe(true)
    })
  })

  describe('joinRoom', () => {
    it('should join public room', async () => {
      const publicRoom = await createTestRoom(testUser, 'Public Room', { isPublic: true, preset: 'public_chat' })

      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/join/${encodeURIComponent(publicRoom.roomId)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      expect(response.ok).toBe(true)
    })
  })

  describe('leaveRoom', () => {
    it('should leave room successfully', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/rooms/${testRoom.roomId}/leave`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      expect(response.ok).toBe(true)
    })
  })

  describe('room state', () => {
    it('should get room state', async () => {
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/rooms/${testRoom.roomId}/state`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      expect(response.ok).toBe(true)
      const state = await response.json()
      expect(Array.isArray(state)).toBe(true)
    })
  })

  describe('room messages', () => {
    it('should send message to room', async () => {
      const txnId = `txn_${Date.now()}`
      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/client/v3/rooms/${testRoom.roomId}/send/m.room.message/${txnId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            msgtype: 'm.text',
            body: 'Integration test message'
          })
        }
      )

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.event_id).toBeDefined()
    })
  })
})
