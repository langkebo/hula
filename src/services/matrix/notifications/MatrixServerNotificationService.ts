import type { MatrixClient } from 'matrix-js-sdk'
import { matrixClientService } from '../MatrixClientService'
import { error } from '@tauri-apps/plugin-log'

export interface ServerNotificationPayload {
  title: string
  content: string
  level?: string
  user_id?: string
  expires_at?: number
}

export interface ServerNotification extends ServerNotificationPayload {
  id: number
  read?: boolean
  dismissed?: boolean
}

export interface NotificationTemplate {
  id: string
  title: string
  content: string
}

class MatrixServerNotificationService {
  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client
  }

  private async request<T>(method: string, path: string, body?: object): Promise<T | null> {
    try {
      return (await this.getClient().http.authedRequest(method, path, undefined, body)) as T
    } catch (err) {
      error(`[MatrixServerNotificationService] 请求失败: ${err}`)
      return null
    }
  }

  async createNotification(payload: ServerNotificationPayload): Promise<ServerNotification | null> {
    return this.request<ServerNotification>('POST', '/_synapse/admin/v1/server_notifications', payload)
  }

  async getNotification(id: number): Promise<ServerNotification | null> {
    return this.request<ServerNotification>('GET', `/_synapse/admin/v1/server_notifications/${id}`)
  }

  async listActive(): Promise<ServerNotification[]> {
    const response = await this.request<{ notifications?: unknown }>(
      'GET',
      '/_synapse/admin/v1/server_notifications/active'
    )
    return response && Array.isArray(response.notifications) ? (response.notifications as ServerNotification[]) : []
  }

  async markAsRead(id: number): Promise<boolean> {
    const response = await this.request<Record<string, unknown>>(
      'POST',
      `/_synapse/admin/v1/server_notifications/${id}/read`
    )
    return response !== null
  }

  async dismiss(id: number): Promise<boolean> {
    const response = await this.request<Record<string, unknown>>(
      'POST',
      `/_synapse/admin/v1/server_notifications/${id}/dismiss`
    )
    return response !== null
  }

  async delete(id: number): Promise<boolean> {
    const response = await this.request<Record<string, unknown>>(
      'DELETE',
      `/_synapse/admin/v1/server_notifications/${id}`
    )
    return response !== null
  }

  async listTemplates(): Promise<NotificationTemplate[]> {
    const response = await this.request<{ templates?: unknown }>(
      'GET',
      '/_synapse/admin/v1/server_notifications/templates'
    )
    return response && Array.isArray(response.templates) ? (response.templates as NotificationTemplate[]) : []
  }
}

export const matrixServerNotificationService = new MatrixServerNotificationService()
export default matrixServerNotificationService
