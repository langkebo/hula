import { describe, expect, it } from 'vitest'
import { MatrixContentField, MatrixRelType } from '@/common/matrixConstants'
import type { MatrixEvent, Room } from '../../sdk'
import { collectChildEvents } from '../relationEventSource'

function createEvent(overrides: { id: string; content?: Record<string, unknown>; threadRootId?: string }): MatrixEvent {
  return {
    getId: () => overrides.id,
    getContent: () => overrides.content ?? {},
    threadRootId: overrides.threadRootId
  } as unknown as MatrixEvent
}

function createRoom(events: MatrixEvent[], container?: MatrixEvent[]): Room {
  return {
    getChildEventsForEvent: () => (container ? { getRelations: () => container } : undefined),
    getUnfilteredTimelineSet: () => ({
      getLiveTimeline: () => ({
        getEvents: () => events
      })
    })
  } as unknown as Room
}

describe('collectChildEvents', () => {
  it('按 event_id 合并关系容器与 timeline（容器优先，去重）', () => {
    const inContainer = createEvent({
      id: '$r1',
      content: { [MatrixContentField.RELATES_TO]: { rel_type: 'm.replace', event_id: '$origin' } }
    })
    const duplicate = createEvent({
      id: '$r1',
      content: { [MatrixContentField.RELATES_TO]: { rel_type: 'm.replace', event_id: '$origin' } }
    })
    const timelineOnly = createEvent({
      id: '$r2',
      content: { [MatrixContentField.RELATES_TO]: { rel_type: 'm.replace', event_id: '$origin' } }
    })
    const room = createRoom([duplicate, timelineOnly], [inContainer])

    const result = collectChildEvents(room, '$origin', MatrixRelType.REPLACES)

    expect(result.map((event) => event.getId())).toEqual(['$r1', '$r2'])
  })

  it('编辑过的线程回复 relation 已丢失时仍按 threadRootId 归入线程', () => {
    const editedReply = createEvent({ id: '$reply', content: { body: 'edited' }, threadRootId: '$root' })
    const otherThread = createEvent({ id: '$other', content: { body: 'x' }, threadRootId: '$other-root' })
    const room = createRoom([editedReply, otherThread])

    const result = collectChildEvents(room, '$root', MatrixRelType.THREAD)

    expect(result.map((event) => event.getId())).toEqual(['$reply'])
  })
})
