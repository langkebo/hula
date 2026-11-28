import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClient, Room } from '@/services/matrix/sdk'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { matrixClientService } from '../../MatrixClientService'
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

    it('should ignore a duplicate click while the same emoji is in flight', async () => {
      let resolveFirst: (value: string) => void = () => {}
      reactToMessageMock.mockReturnValueOnce(
        new Promise<string>((resolve) => {
          resolveFirst = resolve
        })
      )

      const first = matrixReactionService.addReaction('!room:example.com', '$event_1', '👍')
      const second = await matrixReactionService.addReaction('!room:example.com', '$event_1', '👍')

      expect(second).toBe('')
      expect(reactToMessageMock).toHaveBeenCalledTimes(1)

      resolveFirst('$reaction_event_1')
      await expect(first).resolves.toBe('$reaction_event_1')
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
  describe('getReactionsForEvent — SDK 关系容器优先', () => {
    const makeReaction = (key: string, sender: string, target = '$event_1', eventId?: string, redacted = false) =>
      ({
        getId: () => eventId,
        getType: () => 'm.reaction',
        getContent: () => ({ 'm.relates_to': { rel_type: 'm.annotation', event_id: target, key } }),
        getSender: () => sender,
        isRedacted: () => redacted,
        isRedaction: () => false,
        getRedactionTargetId: () => undefined
      }) as never

    /** 本地下发的撤回事件（room v11+ 目标在 content.redacts）。 */
    const makeRedaction = (targetEventId: string) =>
      ({
        getId: () => `$redaction_${targetEventId}`,
        getType: () => 'm.room.redaction',
        getContent: () => ({ redacts: targetEventId }),
        getSender: () => '@a:x',
        isRedacted: () => false,
        isRedaction: () => true,
        getRedactionTargetId: () => targetEventId
      }) as never

    const makeRoom = (opts: { container?: never[]; timeline?: never[]; relations?: ReturnType<typeof vi.fn> }) =>
      ({
        getChildEventsForEvent: () => (opts.container ? { getRelations: () => opts.container } : undefined),
        getUnfilteredTimelineSet: () => ({
          getLiveTimeline: () => ({ getEvents: () => opts.timeline ?? [] })
        }),
        getRelations: opts.relations
      }) as never

    it('容器与 timeline 按 event_id 合并去重（容器里的回应不再让时间线被跳过）', () => {
      const inContainer = makeReaction('👍', '@a:x', '$event_1', '$r1')
      const duplicate = makeReaction('👍', '@a:x', '$event_1', '$r1')
      const timelineOnly = makeReaction('👍', '@b:x', '$event_1', '$r2')
      mockClient.getRoom = vi.fn(() => makeRoom({ container: [inContainer], timeline: [duplicate, timelineOnly] }))

      const result = matrixReactionService.getReactionsForEvent('!room:example.com', '$event_1')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ key: '👍', count: 2 })
    })

    it('容器为空时回退扫 live timeline', () => {
      mockClient.getRoom = vi.fn(() =>
        makeRoom({ timeline: [makeReaction('🔥', '@user:example.com'), makeReaction('🔥', '@b:x')] })
      )

      const result = matrixReactionService.getReactionsForEvent('!room:example.com', '$event_1')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ key: '🔥', count: 2, me: true })
    })

    it('refreshReactions 走 room.getRelations 拉服务端全量并聚合', async () => {
      const getRelations = vi.fn().mockResolvedValue({
        events: [makeReaction('❤️', '@a:x'), makeReaction('❤️', '@b:x'), makeReaction('❤️', '@c:x')]
      })
      mockClient.getRoom = vi.fn(() => makeRoom({ relations: getRelations }))

      const result = await matrixReactionService.refreshReactions('!room:example.com', '$event_1')

      expect(getRelations).toHaveBeenCalledWith('$event_1', 'm.annotation', 'm.reaction', { limit: 200 })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ key: '❤️', count: 3, me: false })
    })

    it('撤回后的回应不计入聚合（取消回应后 chip 必须消失）', () => {
      const active = makeReaction('👍', '@a:x', '$event_1', '$r1')
      const redacted = makeReaction('👍', '@b:x', '$event_1', '$r2', true)
      mockClient.getRoom = vi.fn(() => makeRoom({ timeline: [active, redacted] }))

      const result = matrixReactionService.getReactionsForEvent('!room:example.com', '$event_1')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ key: '👍', count: 1 })
    })

    it('refreshReactions 过滤服务端返回的已撤回回应', async () => {
      const getRelations = vi.fn().mockResolvedValue({
        events: [makeReaction('❤️', '@a:x', '$event_1', '$r1'), makeReaction('❤️', '@b:x', '$event_1', '$r2', true)]
      })
      mockClient.getRoom = vi.fn(() => makeRoom({ relations: getRelations }))

      const result = await matrixReactionService.refreshReactions('!room:example.com', '$event_1')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ key: '❤️', count: 1 })
    })

    it('refreshReactions 全部回应已撤回时返回空（不回退本地陈旧副本）', async () => {
      const getRelations = vi.fn().mockResolvedValue({
        events: [makeReaction('❤️', '@a:x', '$event_1', '$r1', true)]
      })
      mockClient.getRoom = vi.fn(() =>
        makeRoom({ relations: getRelations, timeline: [makeReaction('❤️', '@a:x', '$event_1', '$r1')] })
      )

      const result = await matrixReactionService.refreshReactions('!room:example.com', '$event_1')

      expect(result).toEqual([])
    })

    it('refreshReactions 服务端返回原 content（isRedacted=false）但本地已有撤回事件时仍要过滤', async () => {
      // synapse-rust 的 /relations 把已撤回的回应照旧返回，且不带 unsigned.redacted_because，
      // 只靠 isRedacted() 会漏过，必须用本地 redaction 交叉校验。
      const getRelations = vi.fn().mockResolvedValue({
        events: [makeReaction('1', '@user:example.com', '$event_1', '$r1')]
      })
      mockClient.getRoom = vi.fn(() => makeRoom({ relations: getRelations, timeline: [makeRedaction('$r1')] }))

      const result = await matrixReactionService.refreshReactions('!room:example.com', '$event_1')

      expect(result).toEqual([])
    })

    it('容器里仍有未撤回副本、但本地已有撤回事件时不复活 chip', () => {
      const staleCopy = makeReaction('1', '@user:example.com', '$event_1', '$r1')
      mockClient.getRoom = vi.fn(() =>
        makeRoom({ container: [staleCopy], timeline: [staleCopy, makeRedaction('$r1')] })
      )

      const result = matrixReactionService.getReactionsForEvent('!room:example.com', '$event_1')

      expect(result).toEqual([])
    })

    it('refreshReactions 失败时回退本地（不抛错）', async () => {
      const getRelations = vi.fn().mockRejectedValue(new Error('boom'))
      mockClient.getRoom = vi.fn(() => makeRoom({ relations: getRelations, timeline: [makeReaction('😮', '@a:x')] }))

      const result = await matrixReactionService.refreshReactions('!room:example.com', '$event_1')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ key: '😮', count: 1 })
    })
  })
})
