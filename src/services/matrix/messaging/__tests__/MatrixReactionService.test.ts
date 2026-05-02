import type { MatrixClient, Room } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import matrixClientService from '../../MatrixClientService'
import { matrixReactionService } from '../MatrixReactionService'

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn()
  }
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    enqueue: vi.fn(() => 'offline_id')
  }
}))

describe('MatrixReactionService', () => {
  let mockClient: Partial<MatrixClient>

  beforeEach(() => {
    mockClient = {
      sendEvent: vi.fn().mockResolvedValue({ event_id: '$reaction_event_1' }),
      redactEvent: vi.fn().mockResolvedValue({}),
      getRoom: vi.fn(),
      getUserId: vi.fn(() => '@user:example.com')
    }

    vi.mocked(matrixClientService.getClient).mockReset()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)
  })

  describe('addReaction', () => {
    it('should send reaction event', async () => {
      const result = await matrixReactionService.addReaction('!room:example.com', '$event_1', '👍')

      expect(mockClient.sendEvent).toHaveBeenCalledWith(
        '!room:example.com',
        'm.reaction',
        expect.objectContaining({
          'm.relates_to': expect.objectContaining({
            rel_type: 'm.annotation',
            event_id: '$event_1',
            key: '👍'
          })
        })
      )
      expect(result).toBe('$reaction_event_1')
    })

    it('should enqueue when offline', async () => {
      // 模拟离线状态
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true
      })

      const roomId = '!room:example.com'
      const eventId = '$event_1'
      const emoji = '👍'

      const result = await matrixReactionService.addReaction(roomId, eventId, emoji)

      expect(offlineQueueService.enqueue).toHaveBeenCalledWith('reaction', roomId, {
        roomId,
        eventId,
        emoji
      })
      expect(result).toBe('offline_id')

      // 恢复在线状态
      Object.defineProperty(navigator, 'onLine', {
        value: originalOnLine,
        configurable: true
      })
    })

    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixReactionService.addReaction('!room', '$event', '👍')).rejects.toThrow()
    })
  })

  describe('removeReaction', () => {
    it('should redact reaction event', async () => {
      await matrixReactionService.removeReaction('!room:example.com', '$reaction_1')

      expect(mockClient.redactEvent).toHaveBeenCalledWith('!room:example.com', '$reaction_1')
    })

    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixReactionService.removeReaction('!room', '$reaction')).rejects.toThrow()
    })
  })

  describe('toggleReaction', () => {
    it('should add reaction when not existing', async () => {
      mockClient.getRoom = vi.fn(
        () =>
          ({
            getUnfilteredTimelineSet: vi.fn(() => ({
              getLiveTimeline: vi.fn(() => ({
                getEvents: vi.fn(() => [])
              }))
            }))
          }) as unknown as Room
      )

      const result = await matrixReactionService.toggleReaction('!room:example.com', '$event_1', '👍')

      expect(result.added).toBe(true)
      expect(result.eventId).toBe('$reaction_event_1')
    })

    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixReactionService.toggleReaction('!room', '$event', '👍')).rejects.toThrow()
    })
  })

  describe('getReactionsForEvent', () => {
    it('should return empty array when room not found', async () => {
      mockClient.getRoom = vi.fn(() => null)

      const result = await matrixReactionService.getReactionsForEvent('!room:example.com', '$event_1')

      expect(result).toEqual([])
    })
  })
})
