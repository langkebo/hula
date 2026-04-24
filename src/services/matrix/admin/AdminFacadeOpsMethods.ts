import type { AdminApplicationService } from './ApplicationService'
import type { AdminMediaService } from './MediaService'
import type { AdminNotificationService } from './NotificationService'
import type { AdminRetentionService } from './RetentionService'
import type { AdminRoomService } from './RoomService'
import type { AdminSecurityService } from './SecurityService'
import type { AdminServerService } from './ServerService'
import type { AdminUserService } from './UserService'

type AdminFacadeOpsDeps = {
  applications: AdminApplicationService
  media: AdminMediaService
  notifications: AdminNotificationService
  retention: AdminRetentionService
  rooms: AdminRoomService
  security: AdminSecurityService
  server: AdminServerService
  users: AdminUserService
}

export type AdminFacadeOpsMethods = {
  restartServer(): Promise<void>
  getExperimentalFeatures(): Promise<Record<string, unknown>>
  setExperimentalFeature(feature: string, enabled: boolean): Promise<void>
  getBackups(): Promise<Array<Record<string, unknown>>>
  getFederationServerStatus(serverName: string): Promise<Record<string, unknown> | null>
  reconnectFederation(serverName: string): Promise<void>
  getRetentionPolicies(
    limit?: number,
    from?: string
  ): Promise<{ policies: Array<Record<string, unknown>>; nextToken?: string }>
  getRetentionPolicy(roomId: string): Promise<Record<string, unknown> | null>
  setRetentionPolicy(roomId: string, maxLifetime?: number, minLifetime?: number): Promise<void>
  deleteRetentionPolicy(roomId: string): Promise<void>
  runRetentionTask(): Promise<void>
  getRetentionStatus(): Promise<Record<string, unknown>>
  getRegistrationNonce(): Promise<string>
  adminRegister(
    username: string,
    password: string,
    nonce: string,
    admin?: boolean,
    mac?: string
  ): Promise<{ accessToken: string; userId: string; deviceId: string } | null>
  getAuditEvent(eventId: string): Promise<Record<string, unknown> | null>
  purgeMediaCache(beforeTs?: number): Promise<{ deleted: number }>
  getSamlMappings(
    limit?: number,
    from?: string
  ): Promise<{ mappings: Array<Record<string, unknown>>; nextToken?: string }>
  getSamlMapping(nameId: string): Promise<Record<string, unknown> | null>
  updateSamlMapping(nameId: string, updates: Record<string, unknown>): Promise<void>
  deleteSamlMapping(nameId: string): Promise<void>
  samlLogout(userId: string): Promise<void>
  getUserNotificationSettings(userId: string): Promise<Record<string, unknown> | null>
  setUserNotificationSettings(userId: string, settings: Record<string, unknown>): Promise<void>
  getUserPushers(userId: string): Promise<Array<Record<string, unknown>>>
  deleteUserPusher(userId: string, pushkey: string, appId: string): Promise<void>
  getApplicationServices(
    limit?: number,
    from?: string
  ): Promise<{ services: Array<Record<string, unknown>>; nextToken?: string }>
  registerApplicationService(asToken: string, config: Record<string, unknown>): Promise<Record<string, unknown>>
  getApplicationService(serviceId: string): Promise<Record<string, unknown> | null>
  updateApplicationService(serviceId: string, config: Record<string, unknown>): Promise<void>
  deleteApplicationService(serviceId: string): Promise<void>
  pingApplicationService(serviceId: string): Promise<{ ok: boolean; durationMs?: number }>
  createSystemNotification(content: string, type?: string, targetUsers?: string[]): Promise<{ notificationId: string }>
  getSystemNotifications(
    limit?: number,
    from?: string
  ): Promise<{ notifications: Array<Record<string, unknown>>; nextToken?: string }>
  getSystemNotification(notificationId: string): Promise<Record<string, unknown> | null>
  updateSystemNotification(notificationId: string, updates: Record<string, unknown>): Promise<void>
  deleteSystemNotification(notificationId: string): Promise<void>
  deleteRoomCompat(
    roomId: string,
    options?: {
      purge?: boolean
      force?: boolean
      newRoomUserId?: string
      roomName?: string
      message?: string
    }
  ): Promise<{ kickedUsers: string[]; newRoomId?: string }>
  getUserRateLimit(userId: string): Promise<Record<string, unknown> | null>
  setUserRateLimit(userId: string, limit: Record<string, unknown>): Promise<void>
  deleteUserRateLimit(userId: string): Promise<void>
  getAdminInfo(): Promise<Record<string, unknown> | null>
  deleteUser(userId: string): Promise<void>
  getSecurityEvents(
    limit?: number,
    from?: string,
    filters?: Record<string, unknown>
  ): Promise<{ events: Array<Record<string, unknown>>; nextToken?: string } | null>
  getIpBlocks(): Promise<Array<Record<string, unknown>> | null>
  blockIp(
    ip: string,
    options?: { cidr?: number; expireAt?: number; reason?: string }
  ): Promise<Record<string, unknown> | null>
  unblockIp(ip: string): Promise<void>
  getIpReputation(ip: string): Promise<Record<string, unknown> | null>
  getServerLogs(
    level?: 'debug' | 'info' | 'warn' | 'error',
    limit?: number
  ): Promise<Array<Record<string, unknown>> | null>
  getMediaStats(): Promise<Record<string, unknown> | null>
}

export function createAdminFacadeOpsMethods(deps: AdminFacadeOpsDeps): AdminFacadeOpsMethods {
  return {
    restartServer: () => deps.server.restartServer(),
    getExperimentalFeatures: () => deps.security.getExperimentalFeatures(),
    setExperimentalFeature: (feature, enabled) => deps.security.setExperimentalFeature(feature, enabled),
    getBackups: () => deps.security.getBackups(),
    getFederationServerStatus: (serverName) => deps.security.getFederationServerStatus(serverName),
    reconnectFederation: (serverName) => deps.security.reconnectFederation(serverName),
    getRetentionPolicies: (limit = 50, from) => deps.retention.getRetentionPolicies(limit, from),
    getRetentionPolicy: (roomId) => deps.retention.getRetentionPolicy(roomId),
    setRetentionPolicy: (roomId, maxLifetime, minLifetime) =>
      deps.retention.setRetentionPolicy(roomId, maxLifetime, minLifetime),
    deleteRetentionPolicy: (roomId) => deps.retention.deleteRetentionPolicy(roomId),
    runRetentionTask: () => deps.retention.runRetentionTask(),
    getRetentionStatus: () => deps.retention.getRetentionStatus(),
    getRegistrationNonce: () => deps.users.getRegistrationNonce(),
    adminRegister: (username, password, nonce, admin = false, mac) =>
      deps.users.adminRegister(username, password, nonce, admin, mac),
    getAuditEvent: (eventId) => deps.security.getAuditEvent(eventId),
    purgeMediaCache: (beforeTs) => deps.media.purgeMediaCache(beforeTs),
    getSamlMappings: (limit = 50, from) => deps.security.getSamlMappings(limit, from),
    getSamlMapping: (nameId) => deps.security.getSamlMapping(nameId),
    updateSamlMapping: (nameId, updates) => deps.security.updateSamlMapping(nameId, updates),
    deleteSamlMapping: (nameId) => deps.security.deleteSamlMapping(nameId),
    samlLogout: (userId) => deps.security.samlLogout(userId),
    getUserNotificationSettings: (userId) => deps.notifications.getUserNotificationSettings(userId),
    setUserNotificationSettings: (userId, settings) => deps.notifications.setUserNotificationSettings(userId, settings),
    getUserPushers: (userId) => deps.notifications.getUserPushers(userId),
    deleteUserPusher: (userId, pushkey, appId) => deps.notifications.deleteUserPusher(userId, pushkey, appId),
    getApplicationServices: (limit = 50, from) => deps.applications.getApplicationServices(limit, from),
    registerApplicationService: (asToken, config) => deps.applications.registerApplicationService(asToken, config),
    getApplicationService: (serviceId) => deps.applications.getApplicationService(serviceId),
    updateApplicationService: (serviceId, config) => deps.applications.updateApplicationService(serviceId, config),
    deleteApplicationService: (serviceId) => deps.applications.deleteApplicationService(serviceId),
    pingApplicationService: (serviceId) => deps.applications.pingApplicationService(serviceId),
    createSystemNotification: (content, type = 'info', targetUsers) =>
      deps.notifications.createSystemNotification(content, type, targetUsers),
    getSystemNotifications: (limit = 50, from) => deps.notifications.getSystemNotifications(limit, from),
    getSystemNotification: (notificationId) => deps.notifications.getSystemNotification(notificationId),
    updateSystemNotification: (notificationId, updates) =>
      deps.notifications.updateSystemNotification(notificationId, updates),
    deleteSystemNotification: (notificationId) => deps.notifications.deleteSystemNotification(notificationId),
    deleteRoomCompat: (roomId, options) => deps.rooms.deleteRoomCompat(roomId, options),
    getUserRateLimit: (userId) => deps.users.getUserRateLimit(userId),
    setUserRateLimit: (userId, limit) => deps.users.setUserRateLimit(userId, limit),
    deleteUserRateLimit: (userId) => deps.users.deleteUserRateLimit(userId),
    getAdminInfo: () => deps.server.getAdminInfo(),
    deleteUser: (userId) => deps.users.deleteUser(userId),
    getSecurityEvents: (limit = 100, from, filters) => deps.security.getSecurityEvents(limit, from, filters),
    getIpBlocks: () => deps.security.getIpBlocks(),
    blockIp: (ip, options) => deps.security.blockIp(ip, options),
    unblockIp: (ip) => deps.security.unblockIp(ip),
    getIpReputation: (ip) => deps.security.getIpReputation(ip),
    getServerLogs: (level, limit = 100) => deps.server.getServerLogs(level, limit),
    getMediaStats: () => deps.media.getMediaStats()
  }
}
