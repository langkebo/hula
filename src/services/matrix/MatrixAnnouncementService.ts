import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'
import { invoke } from '@tauri-apps/api/core'

const ANNOUNCEMENT_EVENT_TYPE = 'im.announcement' as const

interface AnnouncementContent {
  id: string
  content: string
  author_id: string
  created_ts: number
  updated_ts: number
  is_pinned: boolean
}

interface Announcement {
  id: string
  content: string
  authorId: string
  createdAt: number
  updatedAt: number
  isPinned: boolean
  eventId?: string
}

interface ServerNotification {
  id: number
  title: string
  content: string
  notification_type: string
  priority: number
  target_audience: string
  target_user_ids: string[]
  starts_at: number | null
  expires_at: number | null
  is_enabled: boolean
  is_dismissable: boolean
  action_url: string | null
  action_text: string | null
  created_by: string | null
  created_ts: number
  updated_ts: number
}

interface ServerNotificationCreate {
  title: string
  content: string
  notification_type?: string
  priority?: number
  target_audience?: string
  target_user_ids?: string[]
  starts_at?: number
  expires_at?: number
  is_dismissable?: boolean
  action_url?: string
  action_text?: string
  created_by?: string
}

interface AnnouncementCreateOptions {
  content: string
  isPinned?: boolean
}

interface AnnouncementUpdateOptions {
  id: string
  content: string
  isPinned?: boolean
}

class MatrixAnnouncementService {
  async pushAnnouncement(roomId: string, options: AnnouncementCreateOptions): Promise<Announcement> {
    const client = this.getClient()
    const userId = client.getUserId()
    if (!userId) {
      throw new Error('用户未登录')
    }

    try {
      const now = Date.now()
      const announcementId = `announcement_${now}_${Math.random().toString(36).substring(2, 9)}`

      const content: AnnouncementContent = {
        id: announcementId,
        content: options.content,
        author_id: userId,
        created_ts: now,
        updated_ts: now,
        is_pinned: options.isPinned ?? true
      }

      const response = await client.sendStateEvent(roomId, ANNOUNCEMENT_EVENT_TYPE, content, announcementId)

      info(`[MatrixAnnouncement] 发布公告成功: ${roomId}, id: ${announcementId}`)

      return {
        id: announcementId,
        content: content.content,
        authorId: content.author_id,
        createdAt: content.created_ts,
        updatedAt: content.updated_ts,
        isPinned: content.is_pinned,
        eventId: response.event_id
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '发布公告失败'
      error(`[MatrixAnnouncement] ${errorMessage}`)
      throw err
    }
  }

  async editAnnouncement(roomId: string, options: AnnouncementUpdateOptions): Promise<Announcement> {
    const client = this.getClient()
    const userId = client.getUserId()
    if (!userId) {
      throw new Error('用户未登录')
    }

    try {
      const existingEvent = await this.getAnnouncementById(roomId, options.id)
      if (!existingEvent) {
        throw new Error(`公告不存在: ${options.id}`)
      }

      const now = Date.now()
      const content: AnnouncementContent = {
        id: options.id,
        content: options.content,
        author_id: existingEvent.authorId,
        created_ts: existingEvent.createdAt,
        updated_ts: now,
        is_pinned: options.isPinned ?? existingEvent.isPinned
      }

      await client.sendStateEvent(roomId, ANNOUNCEMENT_EVENT_TYPE, content, options.id)

      info(`[MatrixAnnouncement] 编辑公告成功: ${roomId}, id: ${options.id}`)

      return {
        ...existingEvent,
        content: content.content,
        updatedAt: content.updated_ts,
        isPinned: content.is_pinned
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '编辑公告失败'
      error(`[MatrixAnnouncement] ${errorMessage}`)
      throw err
    }
  }

  async deleteAnnouncement(roomId: string, announcementId: string): Promise<void> {
    const client = this.getClient()

    try {
      await client.sendStateEvent(roomId, ANNOUNCEMENT_EVENT_TYPE, null as any, announcementId)

      info(`[MatrixAnnouncement] 删除公告成功: ${roomId}, id: ${announcementId}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除公告失败'
      error(`[MatrixAnnouncement] ${errorMessage}`)
      throw err
    }
  }

  async getAnnouncement(roomId: string): Promise<Announcement | null> {
    const client = this.getClient()

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      const stateEvents = room.currentState.getStateEvents(ANNOUNCEMENT_EVENT_TYPE)
      if (stateEvents.length === 0) {
        return null
      }

      const pinnedAnnouncements = stateEvents
        .filter((event: MatrixEvent) => {
          const content = (event.getContent?.() || (event as any).event?.content) as unknown as AnnouncementContent
          return content && content.is_pinned === true
        })
        .sort((a: MatrixEvent, b: MatrixEvent) => {
          const contentA = (a.getContent?.() || (a as any).event?.content) as unknown as AnnouncementContent
          const contentB = (b.getContent?.() || (b as any).event?.content) as unknown as AnnouncementContent
          return (contentB.updated_ts || 0) - (contentA.updated_ts || 0)
        })

      if (pinnedAnnouncements.length === 0) {
        return null
      }

      const latestEvent = pinnedAnnouncements[0]
      return this.parseAnnouncementEvent(latestEvent)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取公告失败'
      error(`[MatrixAnnouncement] ${errorMessage}`)
      throw err
    }
  }

  async getAllAnnouncements(roomId: string): Promise<Announcement[]> {
    const client = this.getClient()

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      const stateEvents = room.currentState.getStateEvents(ANNOUNCEMENT_EVENT_TYPE)

      const announcements: Announcement[] = stateEvents
        .map((event: MatrixEvent) => this.parseAnnouncementEvent(event))
        .filter((ann): ann is Announcement => ann !== null)
        .sort((a, b) => b.updatedAt - a.updatedAt)

      return announcements
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取公告列表失败'
      error(`[MatrixAnnouncement] ${errorMessage}`)
      throw err
    }
  }

  async getAnnouncementById(roomId: string, announcementId: string): Promise<Announcement | null> {
    const client = this.getClient()

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      const event = room.currentState.getStateEvents(ANNOUNCEMENT_EVENT_TYPE, announcementId)
      if (!event) {
        return null
      }

      return this.parseAnnouncementEvent(event)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取公告失败'
      error(`[MatrixAnnouncement] ${errorMessage}`)
      throw err
    }
  }

  async pinAnnouncement(roomId: string, announcementId: string, isPinned: boolean): Promise<Announcement> {
    const client = this.getClient()

    try {
      const existing = await this.getAnnouncementById(roomId, announcementId)
      if (!existing) {
        throw new Error(`公告不存在: ${announcementId}`)
      }

      const content: AnnouncementContent = {
        id: announcementId,
        content: existing.content,
        author_id: existing.authorId,
        created_ts: existing.createdAt,
        updated_ts: Date.now(),
        is_pinned: isPinned
      }

      await client.sendStateEvent(roomId, ANNOUNCEMENT_EVENT_TYPE, content, announcementId)

      info(`[MatrixAnnouncement] ${isPinned ? '置顶' : '取消置顶'}公告: ${roomId}, id: ${announcementId}`)

      return {
        ...existing,
        isPinned: content.is_pinned,
        updatedAt: content.updated_ts
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '置顶公告失败'
      error(`[MatrixAnnouncement] ${errorMessage}`)
      throw err
    }
  }

  async createServerNotification(notification: ServerNotificationCreate): Promise<ServerNotification> {
    try {
      const result = await invoke<ServerNotification>('admin_request', {
        method: 'POST',
        path: '/_synapse/admin/v1/notifications',
        body: notification
      })

      info(`[MatrixAnnouncement] 创建服务器通知成功: ${result.id}`)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建服务器通知失败'
      error(`[MatrixAnnouncement] ${errorMessage}`)
      throw err
    }
  }

  async listServerNotifications(options?: {
    limit?: number
    offset?: number
    audience?: string
  }): Promise<{ notifications: ServerNotification[]; limit: number; offset: number; total: number }> {
    try {
      const params = new URLSearchParams()
      if (options?.limit) params.set('limit', options.limit.toString())
      if (options?.offset) params.set('offset', options.offset.toString())
      if (options?.audience) params.set('audience', options.audience)

      const query = params.toString() ? `?${params.toString()}` : ''

      const result = await invoke<{
        notifications: ServerNotification[]
        limit: number
        offset: number
        total: number
      }>('admin_request', {
        method: 'GET',
        path: `/_synapse/admin/v1/notifications${query}`,
        body: null
      })

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取服务器通知列表失败'
      error(`[MatrixAnnouncement] ${errorMessage}`)
      throw err
    }
  }

  async getServerNotification(id: number): Promise<ServerNotification> {
    try {
      const result = await invoke<ServerNotification>('admin_request', {
        method: 'GET',
        path: `/_synapse/admin/v1/notifications/${id}`,
        body: null
      })

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取服务器通知失败'
      error(`[MatrixAnnouncement] ${errorMessage}`)
      throw err
    }
  }

  async updateServerNotification(id: number, updates: Partial<ServerNotificationCreate>): Promise<ServerNotification> {
    try {
      const result = await invoke<ServerNotification>('admin_request', {
        method: 'PUT',
        path: `/_synapse/admin/v1/notifications/${id}`,
        body: updates
      })

      info(`[MatrixAnnouncement] 更新服务器通知成功: ${id}`)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新服务器通知失败'
      error(`[MatrixAnnouncement] ${errorMessage}`)
      throw err
    }
  }

  async deleteServerNotification(id: number): Promise<void> {
    try {
      await invoke('admin_request', {
        method: 'DELETE',
        path: `/_synapse/admin/v1/notifications/${id}`,
        body: null
      })

      info(`[MatrixAnnouncement] 删除服务器通知成功: ${id}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除服务器通知失败'
      error(`[MatrixAnnouncement] ${errorMessage}`)
      throw err
    }
  }

  async deactivateServerNotification(id: number): Promise<{ is_enabled: boolean }> {
    try {
      const result = await invoke<{ is_enabled: boolean }>('admin_request', {
        method: 'PUT',
        path: `/_synapse/admin/v1/notifications/${id}/deactivate`,
        body: null
      })

      info(`[MatrixAnnouncement] 停用服务器通知成功: ${id}`)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '停用服务器通知失败'
      error(`[MatrixAnnouncement] ${errorMessage}`)
      throw err
    }
  }

  async listActiveServerNotifications(): Promise<ServerNotification[]> {
    try {
      const result = await invoke<{ notifications: ServerNotification[] }>('admin_request', {
        method: 'GET',
        path: '/_synapse/admin/v1/notifications/active',
        body: null
      })

      return result.notifications
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取活跃服务器通知失败'
      error(`[MatrixAnnouncement] ${errorMessage}`)
      throw err
    }
  }

  private parseAnnouncementEvent(event: MatrixEvent): Announcement | null {
    try {
      const content = (event.getContent?.() || (event as any).event?.content) as unknown as AnnouncementContent
      if (!content || !content.id) {
        return null
      }

      return {
        id: content.id,
        content: content.content || '',
        authorId: content.author_id || '',
        createdAt: content.created_ts || 0,
        updatedAt: content.updated_ts || 0,
        isPinned: content.is_pinned || false,
        eventId: event.getId() || undefined
      }
    } catch {
      return null
    }
  }

  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client
  }
}

export const matrixAnnouncementService = new MatrixAnnouncementService()
export default matrixAnnouncementService

export type {
  Announcement,
  AnnouncementContent,
  AnnouncementCreateOptions,
  AnnouncementUpdateOptions,
  ServerNotification,
  ServerNotificationCreate
}
