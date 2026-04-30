import { describe, expect, it, vi } from 'vitest'

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    reactive: (obj: Record<string, unknown>) => obj
  }
})

vi.mock('@/utils/messageBody', () => ({
  getBodyReply: (body: unknown) => {
    if (body && typeof body === 'object' && 'reply' in body) {
      return (body as Record<string, unknown>).reply
    }
    return undefined
  }
}))

import { createReplyTracker } from '../replyTracker'
import type { MessageType } from '../types'

function makeMessage(id: string, roomId: string, replyToId?: string): MessageType {
  const body: Record<string, unknown> = { content: 'test' }
  if (replyToId) {
    body.reply = { id: replyToId, content: 'original' }
  }
  return {
    message: {
      id,
      roomId,
      sendTime: Date.now(),
      type: 1 as never,
      body: body as never
    },
    fromUser: { uid: 'user1' }
  }
}

describe('replyTracker', () => {
  it('creates tracker with empty state', () => {
    const tracker = createReplyTracker()
    expect(tracker.replyMapping).toEqual({})
  })

  it('upsertReplyReference adds a reply mapping', () => {
    const tracker = createReplyTracker()
    const msg = makeMessage('reply1', 'room1', 'original1')
    tracker.upsertReplyReference('room1', 'reply1', msg)

    const roomMap = tracker.getRoomReplyMap('room1')
    expect(roomMap['original1']).toContain('reply1')
  })

  it('upsertReplyReference does nothing without reply in message', () => {
    const tracker = createReplyTracker()
    const msg = makeMessage('msg1', 'room1') // no reply
    tracker.upsertReplyReference('room1', 'msg1', msg)

    const roomMap = tracker.getRoomReplyMap('room1')
    expect(Object.keys(roomMap)).toHaveLength(0)
  })

  it('upsertReplyReference does not duplicate', () => {
    const tracker = createReplyTracker()
    const msg = makeMessage('reply1', 'room1', 'original1')
    tracker.upsertReplyReference('room1', 'reply1', msg)
    tracker.upsertReplyReference('room1', 'reply1', msg)

    const roomMap = tracker.getRoomReplyMap('room1')
    expect(roomMap['original1']).toHaveLength(1)
  })

  it('removeReplyReferences removes a reply', () => {
    const tracker = createReplyTracker()
    const msg = makeMessage('reply1', 'room1', 'original1')
    tracker.upsertReplyReference('room1', 'reply1', msg)

    tracker.removeReplyReferences('room1', 'reply1')
    const roomMap = tracker.getRoomReplyMap('room1')
    expect(roomMap['original1']).toBeUndefined()
  })

  it('syncReplyReference replaces old references', () => {
    const tracker = createReplyTracker()
    const msg1 = makeMessage('reply1', 'room1', 'original1')
    tracker.upsertReplyReference('room1', 'reply1', msg1)

    const msg2 = makeMessage('reply1', 'room1', 'original2')
    tracker.syncReplyReference('room1', 'reply1', msg2)

    const roomMap = tracker.getRoomReplyMap('room1')
    expect(roomMap['original1']).toBeUndefined()
    expect(roomMap['original2']).toContain('reply1')
  })

  it('rebuildReplyMapping rebuilds from scratch', () => {
    const tracker = createReplyTracker()

    const messages: Record<string, MessageType> = {
      reply1: makeMessage('reply1', 'room1', 'original1'),
      reply2: makeMessage('reply2', 'room1', 'original1'),
      reply3: makeMessage('reply3', 'room1', 'original2'),
      msg4: makeMessage('msg4', 'room1') // no reply
    }

    tracker.rebuildReplyMapping('room1', messages)

    const roomMap = tracker.getRoomReplyMap('room1')
    expect(roomMap['original1']).toHaveLength(2)
    expect(roomMap['original1']).toContain('reply1')
    expect(roomMap['original1']).toContain('reply2')
    expect(roomMap['original2']).toHaveLength(1)
    expect(roomMap['original2']).toContain('reply3')
  })

  it('clearRoomReplies clears all mappings for a room', () => {
    const tracker = createReplyTracker()
    const msg = makeMessage('reply1', 'room1', 'original1')
    tracker.upsertReplyReference('room1', 'reply1', msg)

    tracker.clearRoomReplies('room1')
    const roomMap = tracker.getRoomReplyMap('room1')
    expect(Object.keys(roomMap)).toHaveLength(0)
  })

  it('getRoomReplyMap initializes empty map for new room', () => {
    const tracker = createReplyTracker()
    const roomMap = tracker.getRoomReplyMap('newRoom')
    expect(roomMap).toEqual({})
  })

  it('migrateReplyTargetReferences moves references from old to new ID', () => {
    const tracker = createReplyTracker()

    const messages: Record<string, MessageType> = {
      reply1: makeMessage('reply1', 'room1', 'oldId'),
      reply2: makeMessage('reply2', 'room1', 'oldId')
    }

    tracker.rebuildReplyMapping('room1', messages)

    tracker.migrateReplyTargetReferences('room1', 'oldId', 'newId', messages)

    const roomMap = tracker.getRoomReplyMap('room1')
    expect(roomMap['oldId']).toBeUndefined()
    expect(roomMap['newId']).toHaveLength(2)
  })

  it('migrateReplyTargetReferences does nothing when IDs are the same', () => {
    const tracker = createReplyTracker()
    const messages: Record<string, MessageType> = {
      reply1: makeMessage('reply1', 'room1', 'sameId')
    }
    tracker.rebuildReplyMapping('room1', messages)

    tracker.migrateReplyTargetReferences('room1', 'sameId', 'sameId', messages)
    const roomMap = tracker.getRoomReplyMap('room1')
    expect(roomMap['sameId']).toHaveLength(1)
  })
})
