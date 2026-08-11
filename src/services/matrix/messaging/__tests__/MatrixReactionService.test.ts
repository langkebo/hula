import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClient, Room } from '@/services/matrix/sdk'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import matrixClientService from '../../MatrixClientService'
import { matrixReactionService } from '../MatrixReactionService'

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    enqueue: vi.fn(() => 'offline_id')
  }
}))

describe('MatrixReactionService', () => {
  let mockClient: Partial<MatrixClient>
  let reactToMessageMock: ReturnType<typeof vi.fn>
  let redactReactionMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Migration 2026-08-11: switched from client.sendEvent/redactEvent to
    // SDK ReactionsManager.reactToMessage/redactReaction.
    reactToMessageMock = vi.fn().mockResolvedValue('$reaction_event_1')
    redactReactionMock = vi.fn().mockResolvedValue({ event_id: '$redact:hs' })

    const reactionsManager = {
      reactToMessage: reactToMessageMock,
      redactReaction: redactReactionMock
    }

    mockClient = {
      getReactionsManager: (() => reactionsManager) as unknown as MatrixClient['getReactionsManager'],
      getRoom: vi.fn(),
      getUserId: vi.fn(() => '@user:example.com')
    }

    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as MatrixClient)
  })

  describe('addReaction', () => {
    it('should send reaction event', async () => {
      const result = await matrixReactionService.addReaction('!room:example.com', '$event_1', '👍')

      // SDK ReactionsManager.reactToMessage constructs the m.reaction event internally
      expect(reactToMessageMock).toHaveBeenCalledWith('!room:example.com', '$event_1', '👍')
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

      // SDK ReactionsManager.redactReaction delegates to client.redactEvent internally
      expect(redactReactionMock).toHaveBeenCalledWith('!room:example.com', '$reaction_1')
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
