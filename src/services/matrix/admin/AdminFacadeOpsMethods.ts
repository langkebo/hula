import { BaseMatrixService } from '../BaseMatrixService'
import type { AdminApplicationService } from './ApplicationService'
import type { AdminMediaService } from './MediaService'
import type { AdminNotificationService } from './NotificationService'
import type { AdminRetentionService } from './RetentionService'
import type { AdminFeatureFlag, AdminFeatureFlagInput, AdminSecurityService } from './SecurityService'
import type { AdminServerService } from './ServerService'
import type { AdminUserService } from './UserService'

/**
 * AdminFacadeService 的 Ops 方法片段（原 AdminFacadeOpsMethods）。
 *
 * 从 AdminFacadeService 抽离：这些方法是对 admin 子服务的薄委托，
 * 拆分为抽象基类以把门面文件控制在合理体量。子类（AdminFacadeService）
 * 提供各子服务字段。
 */
export abstract class AdminFacadeOpsMethods extends BaseMatrixService {
  abstract readonly server: AdminServerService
  abstract readonly security: AdminSecurityService
  abstract readonly retention: AdminRetentionService
  abstract readonly users: AdminUserService
  abstract readonly media: AdminMediaService
  abstract readonly notifications: AdminNotificationService
  abstract readonly applications: AdminApplicationService

  /**
   * 重启 Matrix 服务器。
   */
  async restartServer(): Promise<void> {
    return this.server.restartServer()
  }

  /**
   * 获取实验性功能开关列表。
   * @returns 实验性功能键值映射。
   */
  async getExperimentalFeatures(): Promise<Record<string, unknown>> {
    return this.security.getExperimentalFeatures()
  }

  /**
   * 列出全部功能开关详情。
   * @returns 功能开关列表。
   */
  async listFeatureFlagsDetailed(): Promise<AdminFeatureFlag[]> {
    return this.security.listFeatureFlagsDetailed()
  }

  /**
   * 获取单个功能开关详情。
   * @param flagKey 功能开关键名。
   * @returns 功能开关详情，不存在时返回 null。
   */
  async getFeatureFlagDetail(flagKey: string): Promise<AdminFeatureFlag | null> {
    return this.security.getFeatureFlagDetail(flagKey)
  }

  /**
   * 保存（创建或更新）一个功能开关。
   * @param input 功能开关配置。
   * @returns 保存后的功能开关。
   */
  async saveFeatureFlag(input: AdminFeatureFlagInput): Promise<AdminFeatureFlag> {
    return this.security.saveFeatureFlag(input)
  }

  /**
   * 设置实验性功能开关状态。
   * @param feature 功能名。
   * @param enabled 是否启用。
   */
  async setExperimentalFeature(feature: string, enabled: boolean): Promise<void> {
    return this.security.setExperimentalFeature(feature, enabled)
  }

  /**
   * 删除功能开关。
   * @param flagKey 功能开关键名。
   */
  async deleteFeatureFlag(flagKey: string): Promise<void> {
    return this.security.deleteFeatureFlag(flagKey)
  }

  /**
   * 获取服务器备份列表。
   * @returns 备份信息列表。
   */
  async getBackups(): Promise<Array<Record<string, unknown>>> {
    return this.security.getBackups()
  }

  /**
   * 获取联邦服务器状态。
   * @param serverName 联邦服务器名。
   * @returns 服务器状态信息，不存在时返回 null。
   */
  async getFederationServerStatus(serverName: string): Promise<Record<string, unknown> | null> {
    return this.security.getFederationServerStatus(serverName)
  }

  /**
   * 重连联邦服务器。
   * @param serverName 联邦服务器名。
   */
  async reconnectFederation(serverName: string): Promise<void> {
    return this.security.reconnectFederation(serverName)
  }

  async getRetentionPolicies(
    limit = 50,
    from?: string
  ): Promise<{ policies: Array<Record<string, unknown>>; nextToken?: string }> {
    return this.retention.getRetentionPolicies(limit, from)
  }

  /**
   * 获取单个房间的保留策略。
   * @param roomId 房间 ID。
   * @returns 保留策略信息，不存在时返回 null。
   */
  async getRetentionPolicy(roomId: string): Promise<Record<string, unknown> | null> {
    return this.retention.getRetentionPolicy(roomId)
  }

  /**
   * 设置房间的保留策略。
   * @param roomId 房间 ID。
   * @param maxLifetime 最大保留时长（毫秒）。
   * @param minLifetime 最小保留时长（毫秒）。
   */
  async setRetentionPolicy(roomId: string, maxLifetime?: number, minLifetime?: number): Promise<void> {
    return this.retention.setRetentionPolicy(roomId, maxLifetime, minLifetime)
  }

  /**
   * 删除房间的保留策略。
   * 注意：后端不支持删除保留策略，此方法为空操作（no-op）。
   * @param roomId 房间 ID。
   */
  async deleteRetentionPolicy(roomId: string): Promise<void> {
    return this.retention.deleteRetentionPolicy(roomId)
  }

  /**
   * 立即触发保留任务执行。
   */
  async runRetentionTask(): Promise<void> {
    return this.retention.runRetentionTask()
  }

  /**
   * 获取保留任务运行状态。
   * @returns 保留任务状态信息。
   */
  async getRetentionStatus(): Promise<Record<string, unknown>> {
    return this.retention.getRetentionStatus()
  }

  /**
   * 获取注册所需的 nonce。
   * @returns 注册 nonce。
   */
  async getRegistrationNonce(): Promise<string> {
    return this.users.getRegistrationNonce()
  }

  async adminRegister(
    username: string,
    password: string,
    nonce: string,
    admin = false,
    mac?: string
  ): Promise<{ accessToken: string; userId: string; deviceId: string } | null> {
    return this.users.adminRegister(username, password, nonce, admin, mac)
  }

  /**
   * 获取单条审计事件详情。
   * @param eventId 事件 ID。
   * @returns 审计事件信息，不存在时返回 null。
   */
  async getAuditEvent(eventId: string): Promise<Record<string, unknown> | null> {
    return this.security.getAuditEvent(eventId)
  }

  /**
   * 清理媒体缓存。
   * @param beforeTs 清理该时间戳之前的缓存，缺省清理全部。
   * @returns 已删除的缓存数量。
   */
  async purgeMediaCache(beforeTs?: number): Promise<{ deleted: number }> {
    return this.media.purgeMediaCache(beforeTs)
  }

  async getSamlMappings(
    limit = 50,
    from?: string
  ): Promise<{ mappings: Array<Record<string, unknown>>; nextToken?: string }> {
    return this.security.getSamlMappings(limit, from)
  }

  /**
   * 获取单个 SAML 映射。
   * @param nameId SAML nameId。
   * @returns SAML 映射信息，不存在时返回 null。
   */
  async getSamlMapping(nameId: string): Promise<Record<string, unknown> | null> {
    return this.security.getSamlMapping(nameId)
  }

  /**
   * 更新 SAML 映射。
   * @param nameId SAML nameId。
   * @param updates 更新字段。
   */
  async updateSamlMapping(nameId: string, updates: Record<string, unknown>): Promise<void> {
    return this.security.updateSamlMapping(nameId, updates)
  }

  /**
   * 删除 SAML 映射。
   * @param nameId SAML nameId。
   */
  async deleteSamlMapping(nameId: string): Promise<void> {
    return this.security.deleteSamlMapping(nameId)
  }

  /**
   * 对指定用户执行 SAML 登出。
   * @param userId 用户 ID。
   */
  async samlLogout(userId: string): Promise<void> {
    return this.security.samlLogout(userId)
  }

  /**
   * 获取用户的通知设置。
   * @param userId 用户 ID。
   * @returns 通知设置，不存在时返回 null。
   */
  async getUserNotificationSettings(userId: string): Promise<Record<string, unknown> | null> {
    return this.notifications.getUserNotificationSettings(userId)
  }

  /**
   * 设置用户的通知设置。
   * @param userId 用户 ID。
   * @param settings 通知设置。
   */
  async setUserNotificationSettings(userId: string, settings: Record<string, unknown>): Promise<void> {
    return this.notifications.setUserNotificationSettings(userId, settings)
  }

  /**
   * 获取用户的 pusher 列表。
   * @param userId 用户 ID。
   * @returns pusher 列表。
   */
  async getUserPushers(userId: string): Promise<Array<Record<string, unknown>>> {
    return this.notifications.getUserPushers(userId)
  }

  /**
   * 删除用户的 pusher。
   * @param userId 用户 ID。
   * @param pushkey pusher 的 pushkey。
   * @param appId pusher 的 appId。
   */
  async deleteUserPusher(userId: string, pushkey: string, appId: string): Promise<void> {
    return this.notifications.deleteUserPusher(userId, pushkey, appId)
  }

  async getApplicationServices(
    limit = 50,
    from?: string
  ): Promise<{ services: Array<Record<string, unknown>>; nextToken?: string }> {
    return this.applications.getApplicationServices(limit, from)
  }

  /**
   * 注册应用服务。
   * @param asToken 应用服务令牌。
   * @param config 应用服务配置。
   * @returns 注册结果。
   */
  async registerApplicationService(asToken: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.applications.registerApplicationService(asToken, config)
  }

  /**
   * 获取应用服务详情。
   * @param serviceId 应用服务 ID。
   * @returns 应用服务信息，不存在时返回 null。
   */
  async getApplicationService(serviceId: string): Promise<Record<string, unknown> | null> {
    return this.applications.getApplicationService(serviceId)
  }

  /**
   * 更新应用服务配置。
   * @param serviceId 应用服务 ID。
   * @param config 新配置。
   */
  async updateApplicationService(serviceId: string, config: Record<string, unknown>): Promise<void> {
    return this.applications.updateApplicationService(serviceId, config)
  }

  /**
   * 删除应用服务。
   * @param serviceId 应用服务 ID。
   */
  async deleteApplicationService(serviceId: string): Promise<void> {
    return this.applications.deleteApplicationService(serviceId)
  }

  /**
   * 探测应用服务连通性。
   * @param serviceId 应用服务 ID。
   * @returns 探测结果（是否可达及耗时）。
   */
  async pingApplicationService(serviceId: string): Promise<{ ok: boolean; durationMs?: number }> {
    return this.applications.pingApplicationService(serviceId)
  }

  async createSystemNotification(
    content: string,
    type = 'info',
    targetUsers?: string[]
  ): Promise<{ notificationId: string }> {
    return this.notifications.createSystemNotification(content, type, targetUsers)
  }

  async getSystemNotifications(
    limit = 50,
    from?: string
  ): Promise<{ notifications: Array<Record<string, unknown>>; nextToken?: string }> {
    return this.notifications.getSystemNotifications(limit, from)
  }

  /**
   * 获取单条系统通知。
   * @param notificationId 通知 ID。
   * @returns 系统通知信息，不存在时返回 null。
   */
  async getSystemNotification(notificationId: string): Promise<Record<string, unknown> | null> {
    return this.notifications.getSystemNotification(notificationId)
  }

  /**
   * 更新系统通知。
   * @param notificationId 通知 ID。
   * @param updates 更新字段。
   */
  async updateSystemNotification(notificationId: string, updates: Record<string, unknown>): Promise<void> {
    return this.notifications.updateSystemNotification(notificationId, updates)
  }

  /**
   * 删除系统通知。
   * @param notificationId 通知 ID。
   */
  async deleteSystemNotification(notificationId: string): Promise<void> {
    return this.notifications.deleteSystemNotification(notificationId)
  }

  /**
   * 获取服务器管理员信息（委托给 getServerInfo()）。
   * @returns 管理员信息，不存在时返回 null。
   */
  async getAdminInfo(): Promise<Record<string, unknown> | null> {
    return this.server.getAdminInfo()
  }

  async getSecurityEvents(
    limit = 100,
    from?: string,
    filters?: Record<string, unknown>
  ): Promise<{ events: Array<Record<string, unknown>>; nextToken?: string } | null> {
    return this.security.getSecurityEvents(limit, from, filters)
  }

  /**
   * 获取 IP 封禁列表。
   * @returns 封禁条目列表，不存在时返回 null。
   */
  async getIpBlocks(): Promise<Array<Record<string, unknown>> | null> {
    return this.security.getIpBlocks()
  }

  async blockIp(
    ip: string,
    options?: { cidr?: number; expireAt?: number; reason?: string }
  ): Promise<Record<string, unknown> | null> {
    return this.security.blockIp(ip, options)
  }

  /**
   * 解除对指定 IP 的封禁。
   * @param ip 要解封的 IP。
   */
  async unblockIp(ip: string): Promise<void> {
    return this.security.unblockIp(ip)
  }

  /**
   * 查询指定 IP 的声誉信息。
   * @param ip 目标 IP。
   * @returns IP 声誉信息，不存在时返回 null。
   */
  async getIpReputation(ip: string): Promise<Record<string, unknown> | null> {
    return this.security.getIpReputation(ip)
  }

  async getServerLogs(
    level?: 'debug' | 'info' | 'warn' | 'error',
    limit = 100
  ): Promise<Array<Record<string, unknown>> | null> {
    return this.server.getServerLogs(level, limit)
  }

  /**
   * 获取媒体存储统计信息。
   * @returns 媒体统计信息，不存在时返回 null。
   */
  async getMediaStats(): Promise<Record<string, unknown> | null> {
    return this.media.getMediaStats()
  }
}
