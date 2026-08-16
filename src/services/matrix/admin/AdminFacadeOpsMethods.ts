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

  async restartServer(): Promise<void> {
    return this.server.restartServer()
  }

  async getExperimentalFeatures(): Promise<Record<string, unknown>> {
    return this.security.getExperimentalFeatures()
  }

  async listFeatureFlagsDetailed(): Promise<AdminFeatureFlag[]> {
    return this.security.listFeatureFlagsDetailed()
  }

  async getFeatureFlagDetail(flagKey: string): Promise<AdminFeatureFlag | null> {
    return this.security.getFeatureFlagDetail(flagKey)
  }

  async saveFeatureFlag(input: AdminFeatureFlagInput): Promise<AdminFeatureFlag> {
    return this.security.saveFeatureFlag(input)
  }

  async setExperimentalFeature(feature: string, enabled: boolean): Promise<void> {
    return this.security.setExperimentalFeature(feature, enabled)
  }

  async deleteFeatureFlag(flagKey: string): Promise<void> {
    return this.security.deleteFeatureFlag(flagKey)
  }

  async getBackups(): Promise<Array<Record<string, unknown>>> {
    return this.security.getBackups()
  }

  async getFederationServerStatus(serverName: string): Promise<Record<string, unknown> | null> {
    return this.security.getFederationServerStatus(serverName)
  }

  async reconnectFederation(serverName: string): Promise<void> {
    return this.security.reconnectFederation(serverName)
  }

  async getRetentionPolicies(
    limit = 50,
    from?: string
  ): Promise<{ policies: Array<Record<string, unknown>>; nextToken?: string }> {
    return this.retention.getRetentionPolicies(limit, from)
  }

  async getRetentionPolicy(roomId: string): Promise<Record<string, unknown> | null> {
    return this.retention.getRetentionPolicy(roomId)
  }

  async setRetentionPolicy(roomId: string, maxLifetime?: number, minLifetime?: number): Promise<void> {
    return this.retention.setRetentionPolicy(roomId, maxLifetime, minLifetime)
  }

  async deleteRetentionPolicy(roomId: string): Promise<void> {
    return this.retention.deleteRetentionPolicy(roomId)
  }

  async runRetentionTask(): Promise<void> {
    return this.retention.runRetentionTask()
  }

  async getRetentionStatus(): Promise<Record<string, unknown>> {
    return this.retention.getRetentionStatus()
  }

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

  async getAuditEvent(eventId: string): Promise<Record<string, unknown> | null> {
    return this.security.getAuditEvent(eventId)
  }

  async purgeMediaCache(beforeTs?: number): Promise<{ deleted: number }> {
    return this.media.purgeMediaCache(beforeTs)
  }

  async getSamlMappings(
    limit = 50,
    from?: string
  ): Promise<{ mappings: Array<Record<string, unknown>>; nextToken?: string }> {
    return this.security.getSamlMappings(limit, from)
  }

  async getSamlMapping(nameId: string): Promise<Record<string, unknown> | null> {
    return this.security.getSamlMapping(nameId)
  }

  async updateSamlMapping(nameId: string, updates: Record<string, unknown>): Promise<void> {
    return this.security.updateSamlMapping(nameId, updates)
  }

  async deleteSamlMapping(nameId: string): Promise<void> {
    return this.security.deleteSamlMapping(nameId)
  }

  async samlLogout(userId: string): Promise<void> {
    return this.security.samlLogout(userId)
  }

  async getUserNotificationSettings(userId: string): Promise<Record<string, unknown> | null> {
    return this.notifications.getUserNotificationSettings(userId)
  }

  async setUserNotificationSettings(userId: string, settings: Record<string, unknown>): Promise<void> {
    return this.notifications.setUserNotificationSettings(userId, settings)
  }

  async getUserPushers(userId: string): Promise<Array<Record<string, unknown>>> {
    return this.notifications.getUserPushers(userId)
  }

  async deleteUserPusher(userId: string, pushkey: string, appId: string): Promise<void> {
    return this.notifications.deleteUserPusher(userId, pushkey, appId)
  }

  async getApplicationServices(
    limit = 50,
    from?: string
  ): Promise<{ services: Array<Record<string, unknown>>; nextToken?: string }> {
    return this.applications.getApplicationServices(limit, from)
  }

  async registerApplicationService(asToken: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.applications.registerApplicationService(asToken, config)
  }

  async getApplicationService(serviceId: string): Promise<Record<string, unknown> | null> {
    return this.applications.getApplicationService(serviceId)
  }

  async updateApplicationService(serviceId: string, config: Record<string, unknown>): Promise<void> {
    return this.applications.updateApplicationService(serviceId, config)
  }

  async deleteApplicationService(serviceId: string): Promise<void> {
    return this.applications.deleteApplicationService(serviceId)
  }

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

  async getSystemNotification(notificationId: string): Promise<Record<string, unknown> | null> {
    return this.notifications.getSystemNotification(notificationId)
  }

  async updateSystemNotification(notificationId: string, updates: Record<string, unknown>): Promise<void> {
    return this.notifications.updateSystemNotification(notificationId, updates)
  }

  async deleteSystemNotification(notificationId: string): Promise<void> {
    return this.notifications.deleteSystemNotification(notificationId)
  }

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

  async getIpBlocks(): Promise<Array<Record<string, unknown>> | null> {
    return this.security.getIpBlocks()
  }

  async blockIp(
    ip: string,
    options?: { cidr?: number; expireAt?: number; reason?: string }
  ): Promise<Record<string, unknown> | null> {
    return this.security.blockIp(ip, options)
  }

  async unblockIp(ip: string): Promise<void> {
    return this.security.unblockIp(ip)
  }

  async getIpReputation(ip: string): Promise<Record<string, unknown> | null> {
    return this.security.getIpReputation(ip)
  }

  async getServerLogs(
    level?: 'debug' | 'info' | 'warn' | 'error',
    limit = 100
  ): Promise<Array<Record<string, unknown>> | null> {
    return this.server.getServerLogs(level, limit)
  }

  async getMediaStats(): Promise<Record<string, unknown> | null> {
    return this.media.getMediaStats()
  }
}
