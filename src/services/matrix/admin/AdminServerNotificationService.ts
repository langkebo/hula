import { DEFAULT_PAGE_LIMIT } from '@/common/constants'
import type { DynamicConfig, IContent } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import type { ServerNoticeInfo, ServerNoticeResult, SystemNotificationInfo } from './AdminTypes'

const logger = createLogger('AdminServerNotificationService')

/**
 * 系统通知详情的原始响应（`GET /_synapse/admin/v1/notifications/{notificationId}`）。
 *
 * 后端字段存在历史别名（`notification_id`/`id`、`created_ts`/`created_at`/`received_ts`），
 * 与列表响应共用同一映射函数，故保留索引签名。
 */
export interface SystemNotificationResponse {
  notification_id?: string
  id?: string
  content?: string
  type?: string
  target_users?: string[]
  created_ts?: number
  created_at?: number
  received_ts?: number
  [key: string]: unknown
}

/**
 * 系统通知管理所需的 SDK AdminManager 子集。
 *
 * 注：SDK 侧这些方法均为可选导出，这里保持可选，避免因版本差异导致类型不可用。
 * 导出仅为让测试夹具从该声明推导 wire 响应类型，不作为对外 API。
 */
export type ServerNotificationAdminSdk = {
  sendServerNotice(
    arg1: string,
    arg2?: string | { msgtype: string; body: string; [k: string]: unknown },
    arg3?: string[]
  ): Promise<{ event_id?: string }>
  getServerNotices?(
    fromOrLimit?: string | number,
    limit?: number
  ): Promise<{ notices?: unknown[]; next_token?: string } | null>
  createNotification?(payload: DynamicConfig): Promise<{ notification_id?: string; [key: string]: unknown }>
  listNotifications?(
    from?: string,
    limit?: number
  ): Promise<{
    notifications: SystemNotificationResponse[]
    next_token?: string
  }>
  getNotification?(notificationId: string): Promise<SystemNotificationResponse>
  updateNotification?(notificationId: string, payload: DynamicConfig): Promise<SystemNotificationResponse>
  deleteNotification?(notificationId: string): Promise<void>
}

type ServerNotificationSdkGetter = () => Promise<unknown>

function mapSystemNotification(raw: SystemNotificationResponse): SystemNotificationInfo {
  const targets = raw.target_users
  const created = raw.created_ts ?? raw.created_at ?? raw.received_ts
  return {
    id: String(raw.notification_id ?? raw.id ?? ''),
    content: String(raw.content ?? ''),
    type: String(raw.type ?? 'info'),
    targetUsers: Array.isArray(targets) ? targets.map((item) => String(item)) : [],
    createdAt: typeof created === 'number' ? created : null
  }
}

/**
 * 服务端通知与系统通知管理服务。
 *
 * 与用户级通知设置（`AdminNotificationService`）分离：本服务只承载 7 条系统通知端点，
 * 供后台「系统通知」tab 使用，避免与「用户通知设置」页混用。
 */
export class AdminServerNotificationService {
  constructor(private readonly sdkAdmin: ServerNotificationSdkGetter) {}

  private async sdk(): Promise<ServerNotificationAdminSdk> {
    return (await this.sdkAdmin()) as ServerNotificationAdminSdk
  }

  /** 向指定用户发送服务器通知。 */
  async sendServerNotice(userId: string, content: IContent): Promise<ServerNoticeResult> {
    try {
      const admin = await this.sdk()
      const result = await admin.sendServerNotice(
        userId,
        content as { msgtype: string; body: string; [k: string]: unknown }
      )
      logger.info(`[AdminServerNotification] 服务器通知已发送: ${userId}`)
      return { eventId: result?.event_id }
    } catch (err) {
      logger.error(`[AdminServerNotification] 发送服务器通知失败: ${err}`)
      throw err
    }
  }

  /** 拉取服务器通知记录，失败时按 throwOnError 决定抛错或降级为 null。 */
  async getServerNotices(
    limit = DEFAULT_PAGE_LIMIT,
    throwOnError = false
  ): Promise<{ notices: ServerNoticeInfo[] } | null> {
    try {
      const admin = await this.sdk()
      const result = await admin.getServerNotices?.(undefined, limit)
      if (!result) return null
      return {
        notices: (result.notices ?? []).map((raw) => {
          const n = raw as SystemNotificationResponse
          return {
            userId: (n.user_id as string) || '',
            sentTs: n.sent_ts as number | undefined,
            content: n.content as IContent | undefined
          }
        })
      }
    } catch (err) {
      logger.error(`[AdminServerNotification] 获取服务器通知失败: ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  /** 创建系统通知，可选指定目标用户列表。 */
  async createSystemNotification(
    content: string,
    type: string = 'info',
    targetUsers?: string[]
  ): Promise<{ notificationId: string }> {
    try {
      const admin = await this.sdk()
      const body: { content: string; type?: string; target_users?: string[] } = { content, type }
      if (targetUsers) body.target_users = targetUsers
      const result = await admin.createNotification?.(body)
      logger.info('[AdminServerNotification] 创建系统通知成功')
      return { notificationId: result?.notification_id ?? '' }
    } catch (err) {
      logger.error(`[AdminServerNotification] 创建系统通知失败: ${err}`)
      throw err
    }
  }

  /** 分页拉取系统通知列表，失败时按 throwOnError 决定抛错或返回空列表。 */
  async getSystemNotifications(
    limit = DEFAULT_PAGE_LIMIT,
    from?: string,
    throwOnError = false
  ): Promise<{ notifications: SystemNotificationInfo[]; nextToken?: string | undefined }> {
    try {
      const admin = await this.sdk()
      const result = await admin.listNotifications?.(from, limit)
      return {
        notifications: (result?.notifications ?? []).map(mapSystemNotification),
        nextToken: result?.next_token
      }
    } catch (err) {
      logger.error(`[AdminServerNotification] 获取系统通知列表失败: ${err}`)
      if (throwOnError) throw err
      return { notifications: [] }
    }
  }

  /** 获取单条系统通知详情，不存在时返回 null。 */
  async getSystemNotification(notificationId: string, throwOnError = false): Promise<SystemNotificationInfo | null> {
    try {
      const admin = await this.sdk()
      const raw = await admin.getNotification?.(notificationId)
      return raw ? mapSystemNotification(raw) : null
    } catch (err) {
      logger.error(`[AdminServerNotification] 获取系统通知详情失败: ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  /** 更新指定系统通知的内容或类型等字段。 */
  async updateSystemNotification(notificationId: string, updates: DynamicConfig): Promise<void> {
    try {
      const admin = await this.sdk()
      await admin.updateNotification?.(notificationId, updates)
      logger.info(`[AdminServerNotification] 更新系统通知: ${notificationId}`)
    } catch (err) {
      logger.error(`[AdminServerNotification] 更新系统通知失败: ${err}`)
      throw err
    }
  }

  /** 删除指定系统通知。 */
  async deleteSystemNotification(notificationId: string): Promise<void> {
    try {
      const admin = await this.sdk()
      await admin.deleteNotification?.(notificationId)
      logger.info(`[AdminServerNotification] 删除系统通知: ${notificationId}`)
    } catch (err) {
      logger.error(`[AdminServerNotification] 删除系统通知失败: ${err}`)
      throw err
    }
  }
}
