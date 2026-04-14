/**
 * 服务器通知服务
 * 管理系统通知
 */
import type {
  ServerNotificationResponse,
  ServerNotificationListResponse,
  MarkAllReadResponse,
  NotificationTemplateListResponse
} from '@/types/matrix-api'
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
export interface ServerNotification {
  notificationId: number
  roomId?: string
  eventId?: string
  userId: string
  type: string
  severity: 'info' | 'warning' | 'error'
  title: string
  content: string
  timestamp: number
  active: boolean
  read: boolean
  dismissed: boolean
  data?: Record<string, unknown>
}

export interface NotificationTemplate {
  name: string
  type: string
  severity: string
  title: string
  content: string
  variables: string[]
}

export interface CreateNotificationParams {
  roomId?: string
  eventId?: string
  type: string
  severity?: 'info' | 'warning' | 'error'
  title: string
  content: string
  data?: Record<string, unknown>
}

class MatrixServerNotificationService extends BaseManager {
  private get client() {
    const c = matrixClientService.getClient()
    if (!c) throw new Error('Matrix client not initialized')
    return c
  }

  /**
   * 创建服务器通知
   */
  async createNotification(params: CreateNotificationParams): Promise<ServerNotification | null> {
    try {
      const response = (await this.client.http.authedRequest(
        'POST',
        '/_matrix/client/v1/admin/server_notifications',
        undefined,
        JSON.stringify(params),
        { prefix: '' }
      )) as ServerNotificationResponse

      return this.mapNotification(response)
    } catch (_error) {
      return null
    }
  }

  /**
   * 获取通知详情
   */
  async getNotification(notificationId: number): Promise<ServerNotification | null> {
    try {
      const response = (await this.client.http.authedRequest(
        'GET',
        `/_matrix/client/v1/admin/server_notifications/${notificationId}`,
        undefined,
        undefined,
        { prefix: '' }
      )) as ServerNotificationResponse

      return this.mapNotification(response)
    } catch (_error) {
      return null
    }
  }

  /**
   * 获取活跃通知列表
   */
  async listActive(): Promise<ServerNotification[]> {
    try {
      const response = (await this.client.http.authedRequest(
        'GET',
        '/_matrix/client/v1/admin/server_notifications/active',
        undefined,
        undefined,
        { prefix: '' }
      )) as ServerNotificationListResponse

      return (response.notifications || []).map(this.mapNotification)
    } catch (_error) {
      return []
    }
  }

  /**
   * 获取用户所有通知
   */
  async listForUser(userId?: string): Promise<ServerNotification[]> {
    try {
      const path = userId
        ? `/_matrix/client/v1/admin/server_notifications/user/${userId}`
        : '/_matrix/client/v1/admin/server_notifications'

      const response = (await this.client.http.authedRequest('GET', path, undefined, undefined, {
        prefix: ''
      })) as ServerNotificationListResponse

      return (response.notifications || []).map(this.mapNotification)
    } catch (_error) {
      return []
    }
  }

  /**
   * 标记通知为已读
   */
  async markAsRead(notificationId: number): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        'PUT',
        `/_matrix/client/v1/admin/server_notifications/${notificationId}/read`,
        undefined,
        undefined,
        { prefix: '' }
      )
      return true
    } catch (_error) {
      return false
    }
  }

  /**
   * 标记通知为已忽略
   */
  async dismiss(notificationId: number): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        'PUT',
        `/_matrix/client/v1/admin/server_notifications/${notificationId}/dismiss`,
        undefined,
        undefined,
        { prefix: '' }
      )
      return true
    } catch (_error) {
      return false
    }
  }

  /**
   * 标记所有通知为已读
   */
  async markAllAsRead(): Promise<number> {
    try {
      const response = (await this.client.http.authedRequest(
        'PUT',
        '/_matrix/client/v1/admin/server_notifications/read_all',
        undefined,
        undefined,
        { prefix: '' }
      )) as MarkAllReadResponse
      return response.count || 0
    } catch (_error) {
      return 0
    }
  }

  /**
   * 删除通知
   */
  async delete(notificationId: number): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        'DELETE',
        `/_matrix/client/v1/admin/server_notifications/${notificationId}`,
        undefined,
        undefined,
        { prefix: '' }
      )
      return true
    } catch (_error) {
      return false
    }
  }

  /**
   * 创建通知模板
   */
  async createTemplate(template: NotificationTemplate): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        'POST',
        '/_matrix/client/v1/admin/server_notifications/templates',
        undefined,
        JSON.stringify(template),
        { prefix: '' }
      )
      return true
    } catch (_error) {
      return false
    }
  }

  /**
   * 获取模板列表
   */
  async listTemplates(): Promise<NotificationTemplate[]> {
    try {
      const response = (await this.client.http.authedRequest(
        'GET',
        '/_matrix/client/v1/admin/server_notifications/templates',
        undefined,
        undefined,
        { prefix: '' }
      )) as NotificationTemplateListResponse
      return response.templates || []
    } catch (_error) {
      return []
    }
  }

  private mapNotification(data: ServerNotificationResponse): ServerNotification {
    return {
      notificationId: data.notification_id,
      roomId: data.room_id,
      eventId: data.event_id,
      userId: data.user_id,
      type: data.type,
      severity: data.severity || 'info',
      title: data.title,
      content: data.content,
      timestamp: data.timestamp,
      active: data.active,
      read: data.read,
      dismissed: data.dismissed,
      data: data.data
    }
  }
}

export const matrixServerNotificationService = new MatrixServerNotificationService()
