/* eslint-disable @typescript-eslint/no-explicit-any */
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'

export interface PinnedEvent {
  event_id: string
  room_id: string
  sender: string
  content: any
  origin_server_ts: number
}

class MatrixPinnedEventsService extends BaseManager {
  private pinnedEventsManager: any = null
  private initialized = false

  initialize(): void {
    if (this.initialized) return

    const client = matrixClientService.getClient()
    if (!client) {
      return
    }

    try {
      this.pinnedEventsManager = (client as any).getPinnedEventsManager?.() ?? null
      this.initialized = true
    } catch (_err) {}
  }

  private get client() {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('Matrix client not initialized')
    return client
  }

  async getPinnedEvents(roomId: string, throwOnError = true): Promise<PinnedEvent[]> {
    try {
      if (this.pinnedEventsManager) {
        const eventIds = await this.pinnedEventsManager.getPinnedEvents(roomId)
        return this.resolvePinnedEvents(roomId, eventIds ?? [])
      }

      const room = this.client.getRoom(roomId)
      if (!room) return []

      const content = room.currentState.getStateEvents('m.room.pinned_events', '')?.getContent() as any
      const pinnedEventIds: string[] = content?.pinned ?? []

      return this.resolvePinnedEvents(roomId, pinnedEventIds)
    } catch (error) {
      return this.handleError(error, 'getPinnedEvents', [] as PinnedEvent[], throwOnError)
    }
  }

  private async resolvePinnedEvents(roomId: string, eventIds: string[]): Promise<PinnedEvent[]> {
    const pinnedEvents: PinnedEvent[] = []
    const room = this.client.getRoom(roomId)

    for (const eventId of eventIds) {
      try {
        let event: any = null

        if (room) {
          const timeline = room.getLiveTimeline().getEvents()
          event = timeline.find((e: any) => e.getId() === eventId)
        }

        if (!event) {
          event = await this.client.getRoomEvent(roomId, eventId)
        }

        if (event) {
          pinnedEvents.push({
            event_id: event.getId?.() ?? event.event_id ?? eventId,
            room_id: roomId,
            sender: event.getSender?.() ?? event.sender ?? '',
            content: event.getContent?.() ?? event.content ?? {},
            origin_server_ts: event.getTs?.() ?? event.origin_server_ts ?? 0
          })
        }
      } catch {
        // skip events that can't be resolved
      }
    }

    return pinnedEvents.sort((a, b) => b.origin_server_ts - a.origin_server_ts)
  }

  async pinEvent(roomId: string, eventId: string, throwOnError = false): Promise<boolean> {
    try {
      if (this.pinnedEventsManager) {
        await this.pinnedEventsManager.pinEvent(roomId, eventId)
        return true
      }

      const room = this.client.getRoom(roomId)
      if (!room) return false

      const content = room.currentState.getStateEvents('m.room.pinned_events', '')?.getContent() as any
      const currentPinned: string[] = content?.pinned ?? []

      if (currentPinned.includes(eventId)) return true

      currentPinned.push(eventId)
      await this.client.sendStateEvent(roomId, 'm.room.pinned_events', { pinned: currentPinned }, '')
      return true
    } catch (error) {
      return this.handleError(error, 'pinEvent', false, throwOnError)
    }
  }

  async unpinEvent(roomId: string, eventId: string, throwOnError = false): Promise<boolean> {
    try {
      if (this.pinnedEventsManager) {
        await this.pinnedEventsManager.unpinEvent(roomId, eventId)
        return true
      }

      const room = this.client.getRoom(roomId)
      if (!room) return false

      const content = room.currentState.getStateEvents('m.room.pinned_events', '')?.getContent() as any
      const currentPinned: string[] = content?.pinned ?? []

      const updatedPinned = currentPinned.filter((id) => id !== eventId)
      await this.client.sendStateEvent(roomId, 'm.room.pinned_events', { pinned: updatedPinned }, '')
      return true
    } catch (error) {
      return this.handleError(error, 'unpinEvent', false, throwOnError)
    }
  }

  async isEventPinned(roomId: string, eventId: string, throwOnError = true): Promise<boolean> {
    try {
      const pinnedEvents = await this.getPinnedEvents(roomId, false)
      return pinnedEvents.some((e) => e.event_id === eventId)
    } catch (error) {
      return this.handleError(error, 'isEventPinned', false, throwOnError)
    }
  }
}

const matrixPinnedEventsService = new MatrixPinnedEventsService()
export default matrixPinnedEventsService
