import type { AdminMediaService } from './MediaService'
import type { AdminRoomService } from './RoomService'
import type { AdminSecurityService } from './SecurityService'
import type { AdminUserService } from './UserService'
import type { UserInfo } from './AdminTypes'

type AdminFacadeDomainDeps = {
  media: AdminMediaService
  rooms: AdminRoomService
  security: AdminSecurityService
  users: AdminUserService
}

export type AdminFacadeDomainMethods = {
  getMediaList(
    limit?: number,
    from?: string,
    orderBy?: string,
    search?: string
  ): Promise<{
    media: Array<{
      mediaId: string
      mediaType: string
      contentUri: string
      createdAt: number
      uploadName?: string
      mediaLength?: number
    }>
    nextToken?: string
  }>
  deleteMedia(mediaId: string): Promise<void>
  purgeRemoteMedia(beforeTs: number, includeProfiles?: boolean): Promise<{ deleted: number }>
  adminGetSpaces(
    limit?: number,
    from?: string
  ): Promise<{ spaces: Array<Record<string, unknown>>; next_batch?: string }>
  adminDeleteSpace(spaceId: string): Promise<void>
  shadowBan(userId: string, ban?: boolean): Promise<void>
  getRateLimits(userId?: string): Promise<Record<string, unknown>>
  setRateLimits(userId: string, limits: Record<string, unknown>): Promise<void>
  getAuditLog(
    limit?: number,
    from?: string,
    userId?: string,
    eventType?: string
  ): Promise<{ logs: Array<Record<string, unknown>>; next_batch?: string }>
  getSamlMetadata(): Promise<Record<string, unknown>>
  getSpMetadata(): Promise<Blob | string | null>
  refreshIdpMetadata(): Promise<Record<string, unknown>>
  getSamlConfig(): Promise<Record<string, unknown>>
  updateSamlConfig(config: Record<string, unknown>): Promise<void>
  getUsersV2(
    limit?: number,
    from?: string,
    name?: string,
    guests?: boolean
  ): Promise<{ users: UserInfo[]; nextToken?: string }>
  getUserV2(userId: string): Promise<UserInfo | null>
  createUserV2(
    username: string,
    password: string,
    options?: { admin?: boolean; displayname?: string; deactivated?: boolean }
  ): Promise<UserInfo | null>
  getUserRooms(userId: string): Promise<Array<{ roomId: string; membership: string; isRoomAdmin: boolean }>>
  getUserStats(userId: string): Promise<Record<string, unknown> | null>
  getUserStatsList(
    limit?: number,
    from?: string
  ): Promise<{ stats: Array<Record<string, unknown>>; nextToken?: string }>
  batchCreateUsers(
    users: Array<{
      username: string
      password: string
      displayname?: string
      admin?: boolean
    }>
  ): Promise<Array<{ userId: string; success: boolean }>>
  batchDeactivateUsers(userIds: string[], erase?: boolean): Promise<Array<{ userId: string; success: boolean }>>
  evictUser(userId: string): Promise<void>
  loginUserAs(userId: string): Promise<{ accessToken: string; deviceId: string } | null>
  logoutUserAll(userId: string): Promise<void>
  getUserSessions(userId: string): Promise<Array<Record<string, unknown>>>
  invalidateUserSession(userId: string): Promise<void>
  getAccountInfo(userId: string): Promise<Record<string, unknown> | null>
  updateAccountInfo(userId: string, updates: Record<string, unknown>): Promise<void>
  checkUserAdmin(userId: string): Promise<boolean>
  setUserAdmin(userId: string, isAdmin: boolean): Promise<void>
  deactivateUserV2(userId: string): Promise<void>
  resetPasswordV2(userId: string, newPassword: string): Promise<void>
  getAccountStatus(userId: string): Promise<Record<string, unknown> | null>
  getLoginFailures(
    limit?: number,
    from?: string
  ): Promise<{ failures: Array<Record<string, unknown>>; nextToken?: string }>
  getRoomMessages(
    roomId: string,
    limit?: number,
    from?: string,
    dir?: 'b' | 'f'
  ): Promise<{
    chunk: Array<Record<string, unknown>>
    start?: string
    end?: string
  }>
  getRoomAliases(roomId: string): Promise<string[]>
  getRoomVersion(roomId: string): Promise<string | null>
  getRoomBlockStatus(roomId: string): Promise<boolean>
  unblockRoom(roomId: string): Promise<void>
  makeRoomAdmin(roomId: string, userId?: string): Promise<void>
  purgeHistory(
    roomId: string,
    options?: { purgeUpToEventId?: string; purgeUpToTs?: number; deleteLocalEvents?: boolean }
  ): Promise<{ purgeId: string }>
  purgeRoom(roomId: string): Promise<void>
  getRoomStats(limit?: number, from?: string): Promise<{ stats: Array<Record<string, unknown>>; nextToken?: string }>
  getSingleRoomStats(roomId: string): Promise<Record<string, unknown> | null>
  getRoomListings(roomId: string): Promise<Record<string, unknown> | null>
  setRoomPublicListing(roomId: string, isPublic: boolean): Promise<void>
  getRoomEventContext(roomId: string, eventId: string): Promise<Record<string, unknown> | null>
  searchInRoom(
    roomId: string,
    searchTerm: string,
    limit?: number
  ): Promise<{ results: Array<Record<string, unknown>>; nextBatch?: string }>
  searchRooms(
    searchTerm: string,
    limit?: number
  ): Promise<{ rooms: Array<Record<string, unknown>>; nextBatch?: string }>
  getRoomForwardExtremities(roomId: string): Promise<Array<Record<string, unknown>>>
  deleteRoomV2(
    roomId: string,
    options?: {
      purge?: boolean
      force?: boolean
      newRoomUserId?: string
      roomName?: string
      message?: string
      block?: boolean
    }
  ): Promise<{ kickedUsers: string[]; failedToKickUsers: string[]; localAliases: string[]; newRoomId?: string }>
  getSpaceDetails(spaceId: string): Promise<Record<string, unknown> | null>
  getSpaceUsers(spaceId: string): Promise<Array<Record<string, unknown>>>
  getSpaceRooms(spaceId: string): Promise<Array<Record<string, unknown>>>
  getSpaceStats(spaceId: string): Promise<Record<string, unknown> | null>
}

export function createAdminFacadeDomainMethods(deps: AdminFacadeDomainDeps): AdminFacadeDomainMethods {
  return {
    getMediaList: (limit = 100, from, orderBy, search) => deps.media.getMediaList(limit, from, orderBy, search),
    deleteMedia: (mediaId) => deps.media.deleteMedia(mediaId),
    purgeRemoteMedia: (beforeTs, includeProfiles = false) => deps.media.purgeRemoteMedia(beforeTs, includeProfiles),
    adminGetSpaces: (limit = 50, from) => deps.rooms.adminGetSpaces(limit, from),
    adminDeleteSpace: (spaceId) => deps.rooms.adminDeleteSpace(spaceId),
    shadowBan: (userId, ban = true) => deps.users.shadowBan(userId, ban),
    getRateLimits: (userId) => deps.users.getRateLimits(userId),
    setRateLimits: (userId, limits) => deps.users.setRateLimits(userId, limits),
    getAuditLog: (limit = 50, from, userId, eventType) => deps.security.getAuditLog(limit, from, userId, eventType),
    getSamlMetadata: () => deps.security.getSamlMetadata(),
    getSpMetadata: () => deps.security.getSpMetadata(),
    refreshIdpMetadata: () => deps.security.refreshIdpMetadata(),
    getSamlConfig: () => deps.security.getSamlConfig(),
    updateSamlConfig: (config) => deps.security.updateSamlConfig(config),
    getUsersV2: (limit = 100, from, name, guests = true) => deps.users.getUsersV2(limit, from, name, guests),
    getUserV2: (userId) => deps.users.getUserV2(userId),
    createUserV2: (username, password, options) => deps.users.createUserV2(username, password, options),
    getUserRooms: (userId) => deps.users.getUserRooms(userId),
    getUserStats: (userId) => deps.users.getUserStats(userId),
    getUserStatsList: (limit = 100, from) => deps.users.getUserStatsList(limit, from),
    batchCreateUsers: (users) => deps.users.batchCreateUsers(users),
    batchDeactivateUsers: (userIds, erase = false) => deps.users.batchDeactivateUsers(userIds, erase),
    evictUser: (userId) => deps.users.evictUser(userId),
    loginUserAs: (userId) => deps.users.loginUserAs(userId),
    logoutUserAll: (userId) => deps.users.logoutUserAll(userId),
    getUserSessions: (userId) => deps.users.getUserSessions(userId),
    invalidateUserSession: (userId) => deps.users.invalidateUserSession(userId),
    getAccountInfo: (userId) => deps.users.getAccountInfo(userId),
    updateAccountInfo: (userId, updates) => deps.users.updateAccountInfo(userId, updates),
    checkUserAdmin: (userId) => deps.users.checkUserAdmin(userId),
    setUserAdmin: (userId, isAdmin) => deps.users.setUserAdmin(userId, isAdmin),
    deactivateUserV2: (userId) => deps.users.deactivateUserV2(userId),
    resetPasswordV2: (userId, newPassword) => deps.users.resetPasswordV2(userId, newPassword),
    getAccountStatus: (userId) => deps.users.getAccountStatus(userId),
    getLoginFailures: (limit = 50, from) => deps.users.getLoginFailures(limit, from),
    getRoomMessages: (roomId, limit = 100, from, dir = 'b') => deps.rooms.getRoomMessages(roomId, limit, from, dir),
    getRoomAliases: (roomId) => deps.rooms.getRoomAliases(roomId),
    getRoomVersion: (roomId) => deps.rooms.getRoomVersion(roomId),
    getRoomBlockStatus: (roomId) => deps.rooms.getRoomBlockStatus(roomId),
    unblockRoom: (roomId) => deps.rooms.unblockRoom(roomId),
    makeRoomAdmin: (roomId, userId) => deps.rooms.makeRoomAdmin(roomId, userId),
    purgeHistory: (roomId, options) => deps.rooms.purgeHistory(roomId, options),
    purgeRoom: (roomId) => deps.rooms.purgeRoom(roomId),
    getRoomStats: (limit = 100, from) => deps.rooms.getRoomStats(limit, from),
    getSingleRoomStats: (roomId) => deps.rooms.getSingleRoomStats(roomId),
    getRoomListings: (roomId) => deps.rooms.getRoomListings(roomId),
    setRoomPublicListing: (roomId, isPublic) => deps.rooms.setRoomPublicListing(roomId, isPublic),
    getRoomEventContext: (roomId, eventId) => deps.rooms.getRoomEventContext(roomId, eventId),
    searchInRoom: (roomId, searchTerm, limit = 50) => deps.rooms.searchInRoom(roomId, searchTerm, limit),
    searchRooms: (searchTerm, limit = 50) => deps.rooms.searchRooms(searchTerm, limit),
    getRoomForwardExtremities: (roomId) => deps.rooms.getRoomForwardExtremities(roomId),
    deleteRoomV2: (roomId, options) => deps.rooms.deleteRoomV2(roomId, options),
    getSpaceDetails: (spaceId) => deps.rooms.getSpaceDetails(spaceId),
    getSpaceUsers: (spaceId) => deps.rooms.getSpaceUsers(spaceId),
    getSpaceRooms: (spaceId) => deps.rooms.getSpaceRooms(spaceId),
    getSpaceStats: (spaceId) => deps.rooms.getSpaceStats(spaceId)
  }
}
