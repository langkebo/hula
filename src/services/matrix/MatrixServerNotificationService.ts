/**
 * 服务器通知服务
 * 管理系统通知
 */
import { matrixClientService } from './MatrixClientService'

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
  data?: Record<string, any>
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
  data?: Record<string, any>
}

class MatrixServerNotificationService {
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
        {},
        'POST',
        '/_matrix/client/v1/admin/server_notifications',
        undefined,
        {
          body: JSON.stringify(params)
        }
      )) as any

      return this.mapNotification(response)
    } catch (error) {
      console.error('[ServerNotification] 创建失败:', error)
      return null
    }
  }

  /**
   * 获取通知详情
   */
  async getNotification(notificationId: number): Promise<ServerNotification | null> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        `/_matrix/client/v1/admin/server_notifications/${notificationId}`,
        undefined
      )) as any

      return this.mapNotification(response)
    } catch (error) {
      console.error('[ServerNotification] 获取失败:', error)
      return null
    }
  }

  /**
   * 获取活跃通知列表
   */
  async listActive(): Promise<ServerNotification[]> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        '/_matrix/client/v1/admin/server_notifications/active',
        undefined
      )) as any

      return (response.notifications || []).map(this.mapNotification)
    } catch (error) {
      console.error('[ServerNotification] 获取活跃列表失败:', error)
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

      const response = (await this.client.http.authedRequest({}, 'GET', path, undefined)) as any

      return (response.notifications || []).map(this.mapNotification)
    } catch (error) {
      console.error('[ServerNotification] 获取用户通知失败:', error)
      return []
    }
  }

  /**
   * 标记通知为已读
   */
  async markAsRead(notificationId: number): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        {},
        'PUT',
        `/_matrix/client/v1/admin/server_notifications/${notificationId}/read`,
        undefined
      )
      return true
    } catch (error) {
      console.error('[ServerNotification] 标记已读失败:', error)
      return false
    }
  }

  /**
   * 标记通知为已忽略
   */
  async dismiss(notificationId: number): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        {},
        'PUT',
        `/_matrix/client/v1/admin/server_notifications/${notificationId}/dismiss`,
        undefined
      )
      return true
    } catch (error) {
      console.error('[ServerNotification] 忽略失败:', error)
      return false
    }
  }

  /**
   * 标记所有通知为已读
   */
  async markAllAsRead(): Promise<number> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'PUT',
        '/_matrix/client/v1/admin/server_notifications/read_all',
        undefined
      )) as any
      return response.count || 0
    } catch (error) {
      console.error('[ServerNotification] 全部已读失败:', error)
      return 0
    }
  }

  /**
   * 删除通知
   */
  async delete(notificationId: number): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        {},
        'DELETE',
        `/_matrix/client/v1/admin/server_notifications/${notificationId}`,
        undefined
      )
      return true
    } catch (error) {
      console.error('[ServerNotification] 删除失败:', error)
      return false
    }
  }

  /**
   * 创建通知模板
   */
  async createTemplate(template: NotificationTemplate): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        {},
        'POST',
        '/_matrix/client/v1/admin/server_notifications/templates',
        undefined,
        { body: JSON.stringify(template) }
      )
      return true
    } catch (error) {
      console.error('[ServerNotification] 创建模板失败:', error)
      return false
    }
  }

  /**
   * 获取模板列表
   */
  async listTemplates(): Promise<NotificationTemplate[]> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        '/_matrix/client/v1/admin/server_notifications/templates',
        undefined
      )) as any
      return response.templates || []
    } catch (error) {
      console.error('[ServerNotification] 获取模板失败:', error)
      return []
    }
  }

  private mapNotification(data: any): ServerNotification {
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
