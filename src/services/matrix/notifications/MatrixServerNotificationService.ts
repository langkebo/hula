import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { MATRIX_PATHS } from '../paths'

const logger = createLogger('MatrixServerNotificationService')

interface ServerNotificationPayload {
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

interface NotificationTemplate {
  id: string
  title: string
  content: string
}

class MatrixServerNotificationService extends BaseMatrixService {
  private async request<T>(method: string, path: string, body?: object): Promise<T | null> {
    try {
      return (await this.getClient().http.authedRequest(method, path, undefined, body)) as T
    } catch (err) {
      logger.error(`[MatrixServerNotificationService] 请求失败: ${err}`)
      return null
    }
  }

  async createNotification(payload: ServerNotificationPayload): Promise<ServerNotification | null> {
    try {
      const result = await this.getClient()
        .getAdminManager()
        .server.createServerNotification(payload as unknown as Record<string, unknown>)
      return result as unknown as ServerNotification
    } catch (err) {
      logger.error(`[MatrixServerNotificationService] 请求失败: ${err}`)
      return null
    }
  }

  async getNotification(id: number): Promise<ServerNotification | null> {
    try {
      const result = await this.getClient().getAdminManager().server.getServerNotification(String(id))
      return result as unknown as ServerNotification
    } catch (err) {
      logger.error(`[MatrixServerNotificationService] 请求失败: ${err}`)
      return null
    }
  }

  async listActive(): Promise<ServerNotification[]> {
    try {
      const response = await this.getClient().getAdminManager().server.listActiveServerNotifications()
      return Array.isArray(response.notifications) ? (response.notifications as ServerNotification[]) : []
    } catch (err) {
      logger.error(`[MatrixServerNotificationService] 请求失败: ${err}`)
      return []
    }
  }

  async markAsRead(id: number): Promise<boolean> {
    try {
      await this.getClient().getAdminManager().server.markServerNotificationAsRead(String(id))
      return true
    } catch (err) {
      logger.error(`[MatrixServerNotificationService] 请求失败: ${err}`)
      return false
    }
  }

  async dismiss(id: number): Promise<boolean> {
    const response = await this.request<Record<string, unknown>>(
      'POST',
      MATRIX_PATHS.ADMIN.SERVER_NOTIFICATION_DISMISS(String(id))
    )
    return response !== null
  }

  async delete(id: number): Promise<boolean> {
    const response = await this.request<Record<string, unknown>>(
      'DELETE',
      MATRIX_PATHS.ADMIN.SERVER_NOTIFICATION_BY_ID(String(id))
    )
    return response !== null
  }

  async listTemplates(): Promise<NotificationTemplate[]> {
    const response = await this.request<{ templates?: unknown }>(
      'GET',
      MATRIX_PATHS.ADMIN.SERVER_NOTIFICATION_TEMPLATES
    )
    return response && Array.isArray(response.templates) ? (response.templates as NotificationTemplate[]) : []
  }
}

export const matrixServerNotificationService = new MatrixServerNotificationService()
