import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'
import { matrixMessageService } from '../messaging/MatrixMessageService'
import { matrixRoomQueryService } from './QueryService'

const logger = createLogger('MatrixAnnouncementService')

export interface Announcement {
  id: string
  roomId: string
  content: string
  isPinned: boolean
  authorId: string
  createdAt: number
}

export interface AnnouncementContent {
  content: string
  isPinned: boolean
}

export interface AnnouncementCreateOptions extends AnnouncementContent {}

export interface AnnouncementUpdateOptions extends AnnouncementContent {
  id: string
}

interface TopicContent {
  topic?: string
}

interface PinnedEventsContent {
  pinned?: string[]
}

class MatrixAnnouncementService {
  private getClient() {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.info('[Announcement] Matrix client not initialized, service unavailable.')
      return null
    }
    return client
  }

  private async getRoom(roomId: string) {
    return await matrixRoomQueryService.getRoom(roomId)
  }

  private async getPinnedEventIds(roomId: string): Promise<string[]> {
    const room = await this.getRoom(roomId)
    const pinnedEvents = room.currentState.getStateEvents('m.room.pinned_events' as never, '')
    const content = (pinnedEvents?.getContent() ?? {}) as PinnedEventsContent
    return Array.isArray(content.pinned)
      ? content.pinned.filter((item): item is string => typeof item === 'string')
      : []
  }

  private async setPinnedEventIds(roomId: string, eventIds: string[]): Promise<void> {
    await this.getRoom(roomId)
    const client = this.getClient()
    if (!client) throw new Error('Matrix client not initialized')
    await client.sendStateEvent(roomId, 'm.room.pinned_events', { pinned: eventIds }, '')
  }

  async getAnnouncementById(roomId: string, announcementId: string): Promise<Announcement | null> {
    try {
      const room = await this.getRoom(roomId)
      const topicEvent = room.currentState.getStateEvents('m.room.topic' as never, '')

      if (topicEvent && (announcementId === 'topic' || announcementId === topicEvent.getId())) {
        const content = (topicEvent.getContent() ?? {}) as TopicContent
        return {
          id: topicEvent.getId() || 'topic',
          roomId,
          content: content.topic ?? '',
          isPinned: true,
          authorId: topicEvent.getSender() || '',
          createdAt: topicEvent.getTs()
        }
      }

      const event = room.findEventById(announcementId)
      if (!event) {
        return null
      }

      const content = event.getContent()
      return {
        id: event.getId() || announcementId,
        roomId,
        content: typeof content.body === 'string' ? content.body : '',
        isPinned: false,
        authorId: event.getSender() || '',
        createdAt: event.getTs()
      }
    } catch (err) {
      logger.error(`[Announcement] 获取公告失败: ${err}`)
      return null
    }
  }

  async pushAnnouncement(roomId: string, options: AnnouncementCreateOptions): Promise<string> {
    try {
      if (options.isPinned) {
        await this.getRoom(roomId)
        const client = this.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        await client.sendStateEvent(roomId, 'm.room.topic', { topic: options.content }, '')
        const refreshedRoom = await this.getRoom(roomId)
        const topicEvent = refreshedRoom.currentState.getStateEvents('m.room.topic' as never, '')
        logger.info(`[Announcement] 更新置顶公告: ${roomId}`)
        return topicEvent?.getId() || 'topic'
      }

      const response = await matrixMessageService.sendTextMessage(roomId, options.content)
      const eventId = response.event_id
      const pinnedEventIds = await this.getPinnedEventIds(roomId)
      await this.setPinnedEventIds(roomId, [...pinnedEventIds, eventId])
      logger.info(`[Announcement] 新增公告: ${roomId}, ${eventId}`)
      return eventId
    } catch (err) {
      logger.error(`[Announcement] 推送公告失败: ${err}`)
      throw err
    }
  }

  async editAnnouncement(roomId: string, options: AnnouncementUpdateOptions): Promise<string> {
    try {
      if (options.isPinned) {
        await this.getRoom(roomId)
        const client = this.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        await client.sendStateEvent(roomId, 'm.room.topic', { topic: options.content }, '')
        const refreshedRoom = await this.getRoom(roomId)
        const topicEvent = refreshedRoom.currentState.getStateEvents('m.room.topic' as never, '')
        logger.info(`[Announcement] 编辑置顶公告: ${roomId}`)
        return topicEvent?.getId() || options.id
      }

      const pinnedEventIds = await this.getPinnedEventIds(roomId)
      const response = await matrixMessageService.sendTextMessage(roomId, options.content)
      const eventId = response.event_id
      const nextPinnedEventIds = pinnedEventIds.map((item) => (item === options.id ? eventId : item))
      await this.setPinnedEventIds(roomId, nextPinnedEventIds)
      logger.info(`[Announcement] 编辑普通公告: ${roomId}, ${options.id} -> ${eventId}`)
      return eventId
    } catch (err) {
      logger.error(`[Announcement] 编辑公告失败: ${err}`)
      throw err
    }
  }

  async deleteAnnouncement(roomId: string, announcementId: string): Promise<void> {
    try {
      const room = await this.getRoom(roomId)
      const topicEvent = room.currentState.getStateEvents('m.room.topic' as never, '')
      if (announcementId === 'topic' || announcementId === topicEvent?.getId()) {
        const client = this.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        await client.sendStateEvent(roomId, 'm.room.topic', { topic: '' }, '')
        logger.info(`[Announcement] 删除置顶公告: ${roomId}`)
        return
      }

      const pinnedEventIds = await this.getPinnedEventIds(roomId)
      const nextPinnedEventIds = pinnedEventIds.filter((item) => item !== announcementId)
      await this.setPinnedEventIds(roomId, nextPinnedEventIds)
      logger.info(`[Announcement] 删除普通公告: ${roomId}, ${announcementId}`)
    } catch (err) {
      logger.error(`[Announcement] 删除公告失败: ${err}`)
      throw err
    }
  }
}

export const matrixAnnouncementService = new MatrixAnnouncementService()

export default matrixAnnouncementService
