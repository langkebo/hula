// src/services/matrix/room/RoomFacade.ts
//
// 房间公共 API 边界：将房间领域的读写/成员/查询/操作能力聚合为单一门面模块，
// 对外保持稳定的导出名，屏蔽下层 sub-service 的重构与拆分。

import type { IContent, ICreateRoomOpts, Room, RoomMember } from 'matrix-js-sdk'
import type { RoomEphemeralEvent } from '../extensions/SynapseRoomSummaryService'
import { synapseRoomSummaryService } from '../extensions/SynapseRoomSummaryService'
import type {
  ContentScannerInfo,
  EncryptedEventsOutcome,
  RoomMessageQueueOutcome,
  RoomSignOutcome,
  RoomSummaryMemberEntry,
  RoomSummaryStateEntry,
  RoomVaultDataOutcome
} from './AccountDataService'
import { matrixRoomAccountDataService } from './AccountDataService'
import type { CreateGroupRoomOptions } from './CreationService'
import { matrixRoomCreationService } from './CreationService'
import type { MembershipEventsOutcome, RecentMemberChangesOutcome } from './MembershipService'
import { matrixRoomMembershipService } from './MembershipService'
import type {
  RoomCapabilitiesOutcome,
  RoomEventUrlOutcome,
  RoomExternalId,
  RoomMetadataOutcome,
  RoomPermissionsOutcome,
  RoomServiceTypesOutcome,
  RoomSpacesOutcome,
  RoomSyncOutcome,
  RoomTurnServerOutcome
} from './MetadataService'
import { matrixRoomMetadataService } from './MetadataService'
import { matrixRoomQueryService } from './QueryService'
import type { StickyEventsOutcome } from './RoomOperations'
import { roomOperations } from './RoomOperations'
import type { RoomPowerLevelsOutcome } from './RoomOperationsModerationMethods'
import type { MatrixRoomSummary } from './SummaryService'
import { matrixRoomSummaryAggregateService } from './SummaryService'
import { matrixRoomTimelineService } from './TimelineService'
import type {
  RoomCallInfo,
  RoomEventMediaUrlOutcome,
  RoomEventPerspectiveOutcome,
  RoomFragmentsOutcome,
  RoomNotificationsOutcome,
  RoomReceiptsOutcome,
  RoomReducedEventsOutcome,
  RoomRenderedOutcome
} from './timelineOutcomes'

export type { RoomCapabilitiesOutcome } from './MetadataService'

export interface MatrixRoomActionFacade {
  // --- Delegated to CreationService (deep) ---
  createRoom(options: ICreateRoomOpts): Promise<Room>
  createGroupRoom(options: CreateGroupRoomOptions): Promise<Room>

  // --- Delegated to RoomOperations (absorbed) ---
  createDirectRoom(userId: string): Promise<string>
  setDirectRoom(userId: string, roomId: string): Promise<void>
  setRoomName(roomId: string, name: string): Promise<void>
  setRoomTopic(roomId: string, topic: string): Promise<void>
  setRoomAvatar(roomId: string, avatarUrl: string): Promise<void>
  setRoomVisibility(roomId: string, visibility: 'public' | 'private'): Promise<void>
  getRoomVisibility(roomId: string): Promise<'public' | 'private'>
  setPushRule(roomId: string, enabled: boolean): Promise<void>
  setRoomAlias(roomId: string, alias: string): Promise<void>
  deleteRoomAlias(alias: string): Promise<void>
  setPinnedEvents(roomId: string, eventIds: string[]): Promise<void>
  pinEvent(roomId: string, eventId: string): Promise<void>
  unpinEvent(roomId: string, eventId: string): Promise<void>
  getRetentionPolicy(roomId: string): Promise<{ content: IContent } | null>
  setRetentionPolicy(roomId: string, content: IContent): Promise<void>
  setStickyEvents(roomId: string, events: IContent): Promise<void>
  clearStickyEvent(roomId: string, eventType: string): Promise<void>
  getStickyEvents(roomId: string): Promise<StickyEventsOutcome>
  setTag(roomId: string, tag: string, order?: number): Promise<void>
  removeTag(roomId: string, tag: string): Promise<void>
  setInviteBlocklist(roomId: string, blocked: string[]): Promise<void>
  setInviteAllowlist(roomId: string, allowed: string[]): Promise<void>
  upgradeRoom(roomId: string, newVersion: string): Promise<string>
  getHistoryVisibility(roomId: string): Promise<string>
  setHistoryVisibility(roomId: string, visibility: string): Promise<void>
  getPowerLevels(roomId: string): Promise<RoomPowerLevelsOutcome>
  setPowerLevels(roomId: string, content: IContent): Promise<void>
  getNotificationLevel(roomId: string): Promise<'all' | 'mentions' | 'mute'>
  setNotificationLevel(roomId: string, level: 'all' | 'mentions' | 'mute'): Promise<void>
  getAliases(roomId: string): Promise<string[]>

  // --- Delegated to MembershipService (deep) ---
  joinRoom(roomId: string): Promise<Room>
  leaveRoom(roomId: string): Promise<void>
  inviteUser(roomId: string, userId: string): Promise<void>
  kickUser(roomId: string, userId: string, reason?: string): Promise<void>
  banUser(roomId: string, userId: string, reason?: string): Promise<void>
  unbanUser(roomId: string, userId: string): Promise<void>
  forgetRoom(roomId: string): Promise<void>
  knockRoom(roomId: string, reason?: string, viaServers?: string[]): Promise<{ room_id: string }>
  joinRoomByAlias(roomIdOrAlias: string, serverName?: string[]): Promise<{ room_id: string }>

  // --- Delegated to AccountDataService (deep) ---
  setRoomAccountData(roomId: string, eventType: string, content: IContent): Promise<void>
  setReadLifetime(roomId: string, lifetimeMs: number): Promise<void>
  setAntiScreenshot(roomId: string, enabled: boolean): Promise<void>
  setVaultData(roomId: string, content: IContent): Promise<void>
}

export const matrixRoomActionFacade: MatrixRoomActionFacade = {
  // Creation (deep)
  createRoom: (options) => matrixRoomCreationService.createRoom(options),
  createGroupRoom: (options) => matrixRoomCreationService.createGroupRoom(options),

  // Absorbed
  createDirectRoom: (userId) => roomOperations.createDirectRoom(userId),
  setDirectRoom: (userId, roomId) => roomOperations.setDirectRoom(userId, roomId),
  setRoomName: (roomId, name) => roomOperations.setRoomName(roomId, name),
  setRoomTopic: (roomId, topic) => roomOperations.setRoomTopic(roomId, topic),
  setRoomAvatar: (roomId, avatarUrl) => roomOperations.setRoomAvatar(roomId, avatarUrl),
  setRoomVisibility: (roomId, visibility) => roomOperations.setRoomVisibility(roomId, visibility),
  getRoomVisibility: (roomId) => roomOperations.getRoomVisibility(roomId),
  setPushRule: (roomId, enabled) => roomOperations.setPushRule(roomId, enabled),
  setRoomAlias: (roomId, alias) => roomOperations.setAlias(roomId, alias),
  deleteRoomAlias: (alias) => roomOperations.deleteAlias(alias),
  setPinnedEvents: (roomId, eventIds) => roomOperations.setPinnedEvents(roomId, eventIds),
  pinEvent: (roomId, eventId) => roomOperations.pinEvent(roomId, eventId),
  unpinEvent: (roomId, eventId) => roomOperations.unpinEvent(roomId, eventId),
  getRetentionPolicy: (roomId) => roomOperations.getRetentionPolicy(roomId),
  setRetentionPolicy: (roomId, content) => roomOperations.setRetentionPolicy(roomId, content),
  setStickyEvents: (roomId, events) => roomOperations.setStickyEvents(roomId, events),
  clearStickyEvent: (roomId, eventType) => roomOperations.clearStickyEvent(roomId, eventType),
  getStickyEvents: (roomId) => roomOperations.getStickyEvents(roomId),
  setTag: (roomId, tag, order?) => roomOperations.setTag(roomId, tag, order),
  removeTag: (roomId, tag) => roomOperations.removeTag(roomId, tag),
  setInviteBlocklist: (roomId, blocked) => roomOperations.setInviteBlocklist(roomId, blocked),
  setInviteAllowlist: (roomId, allowed) => roomOperations.setInviteAllowlist(roomId, allowed),
  upgradeRoom: (roomId, newVersion) => roomOperations.upgradeRoom(roomId, newVersion),
  getHistoryVisibility: (roomId) => roomOperations.getHistoryVisibility(roomId),
  setHistoryVisibility: (roomId, visibility) => roomOperations.setHistoryVisibility(roomId, visibility),
  getPowerLevels: (roomId) => roomOperations.getPowerLevels(roomId),
  setPowerLevels: (roomId, content) => roomOperations.setPowerLevels(roomId, content),
  getNotificationLevel: (roomId) => roomOperations.getNotificationLevel(roomId),
  setNotificationLevel: (roomId, level) => roomOperations.setNotificationLevel(roomId, level),
  getAliases: (roomId) => roomOperations.getAliases(roomId),

  // Membership (deep)
  joinRoom: (roomId) => matrixRoomMembershipService.joinRoom(roomId),
  leaveRoom: (roomId) => matrixRoomMembershipService.leaveRoom(roomId),
  inviteUser: (roomId, userId) => matrixRoomMembershipService.inviteUser(roomId, userId),
  kickUser: (roomId, userId, reason?) => matrixRoomMembershipService.kickUser(roomId, userId, reason),
  banUser: (roomId, userId, reason?) => matrixRoomMembershipService.banUser(roomId, userId, reason),
  unbanUser: (roomId, userId) => matrixRoomMembershipService.unbanUser(roomId, userId),
  forgetRoom: (roomId) => matrixRoomMembershipService.forgetRoom(roomId),
  knockRoom: (roomId, reason?, viaServers?) => matrixRoomMembershipService.knockRoom(roomId, reason, viaServers),
  joinRoomByAlias: (roomIdOrAlias, serverName?) =>
    matrixRoomMembershipService.joinRoomByAlias(roomIdOrAlias, serverName),

  // AccountData (deep)
  setRoomAccountData: (roomId, eventType, content) =>
    matrixRoomAccountDataService.setRoomAccountData(roomId, eventType, content),
  setReadLifetime: (roomId, lifetimeMs) => matrixRoomAccountDataService.setReadLifetime(roomId, lifetimeMs),
  setAntiScreenshot: (roomId, enabled) => matrixRoomAccountDataService.setAntiScreenshot(roomId, enabled),
  setVaultData: (roomId, content) => matrixRoomAccountDataService.setVaultData(roomId, content)
}

interface MatrixRoomMemberFacade {
  setMemberDisplayName(roomId: string, displayName: string): Promise<void>
  getMemberDisplayName(roomId: string, userId: string): Promise<string | null>
  setMemberPowerLevel(roomId: string, userId: string, powerLevel: number): Promise<void>
  setMemberAsAdmin(roomId: string, userId: string): Promise<void>
  removeMemberAsAdmin(roomId: string, userId: string): Promise<void>
}

export const matrixRoomMemberFacade: MatrixRoomMemberFacade = {
  setMemberDisplayName: (roomId, displayName) => roomOperations.setMemberDisplayName(roomId, displayName),
  getMemberDisplayName: (roomId, userId) => roomOperations.getMemberDisplayName(roomId, userId),
  setMemberPowerLevel: (roomId, userId, powerLevel) => roomOperations.setMemberPowerLevel(roomId, userId, powerLevel),
  setMemberAsAdmin: (roomId, userId) => roomOperations.setMemberAsAdmin(roomId, userId),
  removeMemberAsAdmin: (roomId, userId) => roomOperations.removeMemberAsAdmin(roomId, userId)
}

interface MatrixRoomQueryFacade {
  getRooms(): Promise<Room[]>
  getRoom(roomId: string): Promise<Room>
  getRoom(roomId: string, throwOnError: true): Promise<Room>
  getRoom(roomId: string, throwOnError: false): Promise<Room | null>
  getMembers(roomId: string): Promise<RoomMember[]>
  getJoinedMemberCount(roomId: string): Promise<number>
}

async function getRooms(): Promise<Room[]> {
  return matrixRoomQueryService.getRooms()
}

async function getRoom(roomId: string): Promise<Room>
async function getRoom(roomId: string, throwOnError: true): Promise<Room>
async function getRoom(roomId: string, throwOnError: false): Promise<Room | null>
async function getRoom(roomId: string, throwOnError = true): Promise<Room | null> {
  if (throwOnError) {
    return matrixRoomQueryService.getRoom(roomId, true)
  }

  return matrixRoomQueryService.getRoom(roomId, false)
}

async function getMembers(roomId: string): Promise<RoomMember[]> {
  return matrixRoomQueryService.getMembers(roomId)
}

async function getJoinedMemberCount(roomId: string): Promise<number> {
  return matrixRoomQueryService.getJoinedMemberCount(roomId)
}

export const matrixRoomQueryFacade: MatrixRoomQueryFacade = {
  getRooms,
  getRoom,
  getMembers,
  getJoinedMemberCount
}

interface MatrixRoomReadFacade {
  // --- Delegated to RoomOperations (absorbed) ---
  getRoomState(roomId: string): Promise<unknown[]>
  getRoomAliases(roomId: string): Promise<string[]>
  getPinnedEvents(roomId: string): Promise<string[]>
  getStickyEvents(roomId: string): Promise<StickyEventsOutcome>
  getInviteBlocklist(roomId: string): Promise<string[]>
  getInviteAllowlist(roomId: string): Promise<string[]>
  getTags(roomId: string): Promise<Record<string, { order?: number }>>
  getServerDomain(): Promise<string>
  translateText(text: string, targetLang?: string, throwOnError?: boolean): Promise<string>
  getDirectRooms(throwOnError?: boolean): Promise<Map<string, string[]>>

  // --- Delegated to deeper services ---
  getRoomSummary(roomId: string, throwOnError?: boolean): Promise<MatrixRoomSummary | null>
  getEventContext(
    roomId: string,
    eventId: string,
    limit?: number
  ): Promise<{
    event: unknown
    events_before: unknown[]
    events_after: unknown[]
    state: unknown[]
  } | null>
  getRoomVersion(roomId: string): Promise<string | null>
  getRoomCapabilities(roomId: string): Promise<RoomCapabilitiesOutcome>
  getRoomTimeline(
    roomId: string,
    options?: { from?: string; limit?: number; dir?: 'f' | 'b' }
  ): Promise<{
    chunk: unknown[]
    start: string
    end: string
  }>
  getRoomUnreadCount(roomId: string): Promise<{
    unread_notifications: number
    unread_highlighted: number
  }>
  getRoomAccountData(roomId: string, eventType: string): Promise<IContent | null>
  getRoomMetadata(roomId: string): Promise<RoomMetadataOutcome>
  /** 房间级 TURN 配置（只读，已剥离凭据） */
  getRoomTurnServer(roomId: string): Promise<RoomTurnServerOutcome>
  getRoomEventUrl(roomId: string, eventId: string): Promise<RoomEventUrlOutcome>
  timestampToEvent(
    roomId: string,
    timestamp: number,
    dir?: 'f' | 'b'
  ): Promise<{ event_id: string; origin_server_ts: number } | null>
  getRoomCall(roomId: string, callId: string): Promise<RoomCallInfo | null>
  getRoomSync(roomId: string): Promise<RoomSyncOutcome>
  getReportScannerInfo(roomId: string, eventId: string): Promise<ContentScannerInfo | null>
  getRoomNotifications(roomId: string, params?: { from?: string; limit?: number }): Promise<RoomNotificationsOutcome>
  /** 当前用户的房间权限快照（只读） */
  getRoomPermissions(roomId: string): Promise<RoomPermissionsOutcome>
  /** 房间所属空间列表（只读） */
  getRoomSpaces(roomId: string): Promise<RoomSpacesOutcome>
  getRoomExternalIds(roomId: string): Promise<RoomExternalId[]>
  getRoomEventPerspective(roomId: string, eventId: string): Promise<RoomEventPerspectiveOutcome>
  getAntiScreenshot(roomId: string): Promise<{ enabled: boolean }>
  getMessageQueue(roomId: string): Promise<RoomMessageQueueOutcome>
  getEncryptedEvents(roomId: string): Promise<EncryptedEventsOutcome>
  signEvent(roomId: string, eventId: string): Promise<RoomSignOutcome>
  verifyEvent(roomId: string, eventId: string): Promise<{ valid: boolean }>
  getVaultData(roomId: string, throwOnError?: boolean): Promise<RoomVaultDataOutcome>
  getRoomSummaryMembers(roomId: string): Promise<RoomSummaryMemberEntry[]>
  getRoomSummaryState(roomId: string): Promise<RoomSummaryStateEntry[]>
  getRoomEphemeral(roomId: string, types?: string[]): Promise<RoomEphemeralEvent[]>
  getRoomEventMediaUrls(roomId: string, eventId: string): Promise<RoomEventMediaUrlOutcome>
  /** 房间降采样事件（只读） */
  getRoomReducedEvents(roomId: string): Promise<RoomReducedEventsOutcome>
  /** 房间渲染结果（只读，HTML 不外露） */
  getRoomRendered(roomId: string): Promise<RoomRenderedOutcome>
  /** 指定用户的时间线片段（只读） */
  getRoomFragments(roomId: string, userId: string): Promise<RoomFragmentsOutcome>
  /** 某事件的已读回执明细（只读） */
  getRoomReceipts(roomId: string, receiptType: string, eventId: string): Promise<RoomReceiptsOutcome>
  getRoomServiceTypes(roomId: string): Promise<RoomServiceTypesOutcome>
  getMembershipEvents(roomId: string, limit?: number): Promise<MembershipEventsOutcome>
  /** 房间最近成员变更（`GET …/members/recent`，只读） */
  getRecentMemberChanges(roomId: string, limit?: number): Promise<RecentMemberChangesOutcome>
}

export const matrixRoomReadFacade: MatrixRoomReadFacade = {
  // Absorbed
  getRoomState: (roomId) => roomOperations.getRoomState(roomId),
  getRoomAliases: (roomId) => roomOperations.getAliases(roomId),
  getPinnedEvents: (roomId) => roomOperations.getPinnedEvents(roomId),
  getStickyEvents: (roomId) => roomOperations.getStickyEvents(roomId),
  getInviteBlocklist: (roomId) => roomOperations.getInviteBlocklist(roomId),
  getInviteAllowlist: (roomId) => roomOperations.getInviteAllowlist(roomId),
  getTags: (roomId) => roomOperations.getTags(roomId),
  getServerDomain: () => roomOperations.getServerDomain(),
  translateText: (text, targetLang?, throwOnError?) => roomOperations.translateText(text, targetLang, throwOnError),
  getDirectRooms: (throwOnError?) => roomOperations.getDirectRooms(throwOnError),

  // Deep
  getRoomSummary: (roomId, throwOnError?) => matrixRoomSummaryAggregateService.getRoomSummary(roomId, throwOnError),
  getEventContext: (roomId, eventId, limit?) => matrixRoomTimelineService.getEventContext(roomId, eventId, limit),
  getRoomVersion: (roomId) => matrixRoomMetadataService.getRoomVersion(roomId),
  getRoomCapabilities: (roomId) => matrixRoomMetadataService.getRoomCapabilities(roomId),
  getRoomTimeline: (roomId, options?) => matrixRoomTimelineService.getRoomTimeline(roomId, options),
  getRoomUnreadCount: (roomId) => matrixRoomTimelineService.getRoomUnreadCount(roomId),
  getRoomAccountData: (roomId, eventType) => matrixRoomAccountDataService.getRoomAccountData(roomId, eventType),
  getRoomMetadata: (roomId) => matrixRoomMetadataService.getRoomMetadata(roomId),
  getRoomTurnServer: (roomId) => matrixRoomMetadataService.getRoomTurnServer(roomId),
  getRoomEventUrl: (roomId, eventId) => matrixRoomMetadataService.getRoomEventUrl(roomId, eventId),
  timestampToEvent: (roomId, timestamp, dir?) => matrixRoomTimelineService.timestampToEvent(roomId, timestamp, dir),
  getRoomCall: (roomId, callId) => matrixRoomTimelineService.getRoomCall(roomId, callId),
  getRoomSync: (roomId) => matrixRoomMetadataService.getRoomSync(roomId),
  getReportScannerInfo: (roomId, eventId) => matrixRoomAccountDataService.getReportScannerInfo(roomId, eventId),
  getRoomNotifications: (roomId, params?) => matrixRoomTimelineService.getRoomNotifications(roomId, params),
  getRoomPermissions: (roomId) => matrixRoomMetadataService.getRoomPermissions(roomId),
  getRoomSpaces: (roomId) => matrixRoomMetadataService.getRoomSpaces(roomId),
  getRoomExternalIds: (roomId) => matrixRoomMetadataService.getRoomExternalIds(roomId),
  getRoomEventPerspective: (roomId, eventId) => matrixRoomTimelineService.getRoomEventPerspective(roomId, eventId),
  getAntiScreenshot: (roomId) => matrixRoomAccountDataService.getAntiScreenshot(roomId),
  getMessageQueue: (roomId) => matrixRoomAccountDataService.getMessageQueue(roomId),
  getEncryptedEvents: (roomId) => matrixRoomAccountDataService.getEncryptedEvents(roomId),
  signEvent: (roomId, eventId) => matrixRoomAccountDataService.signEvent(roomId, eventId),
  verifyEvent: (roomId, eventId) => matrixRoomAccountDataService.verifyEvent(roomId, eventId),
  getVaultData: (roomId, throwOnError?) => matrixRoomAccountDataService.getVaultData(roomId, throwOnError),
  getRoomSummaryMembers: (roomId) => matrixRoomAccountDataService.getRoomSummaryMembers(roomId),
  getRoomSummaryState: (roomId) => matrixRoomAccountDataService.getRoomSummaryState(roomId),
  getRoomEphemeral: (roomId, types?) => synapseRoomSummaryService.getRoomEphemeral(roomId, types),
  getRoomEventMediaUrls: (roomId, eventId) => matrixRoomTimelineService.getRoomEventMediaUrls(roomId, eventId),
  getRoomReducedEvents: (roomId) => matrixRoomTimelineService.getRoomReducedEvents(roomId),
  getRoomRendered: (roomId) => matrixRoomTimelineService.getRoomRendered(roomId),
  getRoomFragments: (roomId, userId) => matrixRoomTimelineService.getRoomFragments(roomId, userId),
  getRoomReceipts: (roomId, receiptType, eventId) =>
    matrixRoomTimelineService.getRoomReceipts(roomId, receiptType, eventId),
  getRoomServiceTypes: (roomId) => matrixRoomMetadataService.getRoomServiceTypes(roomId),
  getMembershipEvents: (roomId, limit?) => matrixRoomMembershipService.getMembershipEvents(roomId, limit),
  getRecentMemberChanges: (roomId, limit?) => matrixRoomMembershipService.getRecentMemberChanges(roomId, limit)
}
