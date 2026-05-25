import type { Room, RoomMember } from 'matrix-js-sdk'
import type { RoomInfo } from '@/services/types'
import { BaseMatrixService } from '../BaseMatrixService'
import { type MatrixRoomActionFacade, matrixRoomActionFacade } from './ActionFacade'
import { matrixRoomCreationService } from './CreationService'
import { matrixRoomLifecycleService } from './LifecycleService'
import { type MatrixRoomMemberFacade, matrixRoomMemberFacade } from './MemberFacade'
import { type MatrixRoomQueryFacade, matrixRoomQueryFacade } from './QueryFacade'
import { type MatrixRoomReadFacade, matrixRoomReadFacade } from './ReadFacade'
import type { MatrixRoomRealtimeFacade } from './RealtimeFacade'
import { matrixRoomRealtimeService, type VisibleRoomSession } from './RealtimeService'
import { matrixRoomTranslateService } from './TranslateService'

/**
 * Matrix 房间服务
 *
 * 提供房间管理功能，包括创建、加入、离开房间，以及成员管理等操作。
 *
 * @example
 * ```typescript
 * import { matrixRoomService } from '@/services/matrix/room/MatrixRoomService'
 *
 * // 获取所有房间
 * const rooms = await matrixRoomService.getRooms()
 *
 * // 创建房间
 * const room = await matrixRoomService.createRoom({
 *   name: 'My Room',
 *   preset: 'private_chat'
 * })
 *
 * // 邀请用户
 * await matrixRoomService.inviteUser(room.roomId, '@user:example.org')
 * ```
 */
class MatrixRoomService
  extends BaseMatrixService
  implements
    MatrixRoomQueryFacade,
    MatrixRoomReadFacade,
    MatrixRoomRealtimeFacade,
    MatrixRoomActionFacade,
    MatrixRoomMemberFacade
{
  // QueryFacade 方法 - 直接委托，避免 Object.assign 在 Vite 预打包环境下的初始化顺序问题
  getRooms(): Promise<Room[]> {
    return matrixRoomQueryFacade.getRooms()
  }

  getRoom(roomId: string): Promise<Room>
  getRoom(roomId: string, throwOnError: true): Promise<Room>
  getRoom(roomId: string, throwOnError: false): Promise<Room | null>
  getRoom(roomId: string, throwOnError = true): Promise<Room | null> {
    return matrixRoomQueryFacade.getRoom(roomId, throwOnError as never)
  }

  getMembers(roomId: string): Promise<RoomMember[]> {
    return matrixRoomQueryFacade.getMembers(roomId)
  }

  // ReadFacade 方法 - 直接委托
  getRoomState(
    ...args: Parameters<MatrixRoomReadFacade['getRoomState']>
  ): ReturnType<MatrixRoomReadFacade['getRoomState']> {
    return matrixRoomReadFacade.getRoomState(...args)
  }

  getRoomSummary(
    ...args: Parameters<MatrixRoomReadFacade['getRoomSummary']>
  ): ReturnType<MatrixRoomReadFacade['getRoomSummary']> {
    return matrixRoomReadFacade.getRoomSummary(...args)
  }

  getRoomSummaries(
    ...args: Parameters<MatrixRoomReadFacade['getRoomSummaries']>
  ): ReturnType<MatrixRoomReadFacade['getRoomSummaries']> {
    return matrixRoomReadFacade.getRoomSummaries(...args)
  }

  getRoomAliases(
    ...args: Parameters<MatrixRoomReadFacade['getRoomAliases']>
  ): ReturnType<MatrixRoomReadFacade['getRoomAliases']> {
    return matrixRoomReadFacade.getRoomAliases(...args)
  }

  getEventContext(
    ...args: Parameters<MatrixRoomReadFacade['getEventContext']>
  ): ReturnType<MatrixRoomReadFacade['getEventContext']> {
    return matrixRoomReadFacade.getEventContext(...args)
  }

  getRoomVersion(
    ...args: Parameters<MatrixRoomReadFacade['getRoomVersion']>
  ): ReturnType<MatrixRoomReadFacade['getRoomVersion']> {
    return matrixRoomReadFacade.getRoomVersion(...args)
  }

  getRoomCapabilities(
    ...args: Parameters<MatrixRoomReadFacade['getRoomCapabilities']>
  ): ReturnType<MatrixRoomReadFacade['getRoomCapabilities']> {
    return matrixRoomReadFacade.getRoomCapabilities(...args)
  }

  getRoomTimeline(
    ...args: Parameters<MatrixRoomReadFacade['getRoomTimeline']>
  ): ReturnType<MatrixRoomReadFacade['getRoomTimeline']> {
    return matrixRoomReadFacade.getRoomTimeline(...args)
  }

  getRoomUnreadCount(
    ...args: Parameters<MatrixRoomReadFacade['getRoomUnreadCount']>
  ): ReturnType<MatrixRoomReadFacade['getRoomUnreadCount']> {
    return matrixRoomReadFacade.getRoomUnreadCount(...args)
  }

  getRoomAccountData(
    ...args: Parameters<MatrixRoomReadFacade['getRoomAccountData']>
  ): ReturnType<MatrixRoomReadFacade['getRoomAccountData']> {
    return matrixRoomReadFacade.getRoomAccountData(...args)
  }

  getRoomMetadata(
    ...args: Parameters<MatrixRoomReadFacade['getRoomMetadata']>
  ): ReturnType<MatrixRoomReadFacade['getRoomMetadata']> {
    return matrixRoomReadFacade.getRoomMetadata(...args)
  }

  getRoomTurnServer(
    ...args: Parameters<MatrixRoomReadFacade['getRoomTurnServer']>
  ): ReturnType<MatrixRoomReadFacade['getRoomTurnServer']> {
    return matrixRoomReadFacade.getRoomTurnServer(...args)
  }

  getPinnedEvents(
    ...args: Parameters<MatrixRoomReadFacade['getPinnedEvents']>
  ): ReturnType<MatrixRoomReadFacade['getPinnedEvents']> {
    return matrixRoomReadFacade.getPinnedEvents(...args)
  }

  getInviteBlocklist(
    ...args: Parameters<MatrixRoomReadFacade['getInviteBlocklist']>
  ): ReturnType<MatrixRoomReadFacade['getInviteBlocklist']> {
    return matrixRoomReadFacade.getInviteBlocklist(...args)
  }

  getInviteAllowlist(
    ...args: Parameters<MatrixRoomReadFacade['getInviteAllowlist']>
  ): ReturnType<MatrixRoomReadFacade['getInviteAllowlist']> {
    return matrixRoomReadFacade.getInviteAllowlist(...args)
  }

  getStickyEvents(
    ...args: Parameters<MatrixRoomReadFacade['getStickyEvents']>
  ): ReturnType<MatrixRoomReadFacade['getStickyEvents']> {
    return matrixRoomReadFacade.getStickyEvents(...args)
  }

  timestampToEvent(
    ...args: Parameters<MatrixRoomReadFacade['timestampToEvent']>
  ): ReturnType<MatrixRoomReadFacade['timestampToEvent']> {
    return matrixRoomReadFacade.timestampToEvent(...args)
  }

  getRoomCall(
    ...args: Parameters<MatrixRoomReadFacade['getRoomCall']>
  ): ReturnType<MatrixRoomReadFacade['getRoomCall']> {
    return matrixRoomReadFacade.getRoomCall(...args)
  }

  getRoomSync(
    ...args: Parameters<MatrixRoomReadFacade['getRoomSync']>
  ): ReturnType<MatrixRoomReadFacade['getRoomSync']> {
    return matrixRoomReadFacade.getRoomSync(...args)
  }

  getTags(...args: Parameters<MatrixRoomReadFacade['getTags']>): ReturnType<MatrixRoomReadFacade['getTags']> {
    return matrixRoomReadFacade.getTags(...args)
  }

  getReportScannerInfo(
    ...args: Parameters<MatrixRoomReadFacade['getReportScannerInfo']>
  ): ReturnType<MatrixRoomReadFacade['getReportScannerInfo']> {
    return matrixRoomReadFacade.getReportScannerInfo(...args)
  }

  getExternalServices(
    ...args: Parameters<MatrixRoomReadFacade['getExternalServices']>
  ): ReturnType<MatrixRoomReadFacade['getExternalServices']> {
    return matrixRoomReadFacade.getExternalServices(...args)
  }

  getRoomNotifications(
    ...args: Parameters<MatrixRoomReadFacade['getRoomNotifications']>
  ): ReturnType<MatrixRoomReadFacade['getRoomNotifications']> {
    return matrixRoomReadFacade.getRoomNotifications(...args)
  }

  getRoomPermissions(
    ...args: Parameters<MatrixRoomReadFacade['getRoomPermissions']>
  ): ReturnType<MatrixRoomReadFacade['getRoomPermissions']> {
    return matrixRoomReadFacade.getRoomPermissions(...args)
  }

  convertRoomToSession(
    ...args: Parameters<MatrixRoomRealtimeFacade['convertRoomToSession']>
  ): ReturnType<MatrixRoomRealtimeFacade['convertRoomToSession']> {
    return matrixRoomRealtimeService.convertRoomToSession(...args)
  }

  // ActionFacade 方法
  createRoom(
    options: Parameters<MatrixRoomActionFacade['createRoom']>[0]
  ): ReturnType<MatrixRoomActionFacade['createRoom']> {
    return matrixRoomActionFacade.createRoom(options)
  }

  createGroupRoom(
    options: Parameters<MatrixRoomActionFacade['createGroupRoom']>[0]
  ): ReturnType<MatrixRoomActionFacade['createGroupRoom']> {
    return matrixRoomActionFacade.createGroupRoom(options)
  }

  createDirectRoom(
    userId: Parameters<MatrixRoomActionFacade['createDirectRoom']>[0]
  ): ReturnType<MatrixRoomActionFacade['createDirectRoom']> {
    return matrixRoomActionFacade.createDirectRoom(userId)
  }

  joinRoom(roomId: string): Promise<Room> {
    return matrixRoomActionFacade.joinRoom(roomId)
  }

  leaveRoom(roomId: string): Promise<void> {
    return matrixRoomActionFacade.leaveRoom(roomId)
  }

  inviteUser(roomId: string, userId: string): Promise<void> {
    return matrixRoomActionFacade.inviteUser(roomId, userId)
  }

  kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    return matrixRoomActionFacade.kickUser(roomId, userId, reason)
  }

  banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    return matrixRoomActionFacade.banUser(roomId, userId, reason)
  }

  unbanUser(roomId: string, userId: string): Promise<void> {
    return matrixRoomActionFacade.unbanUser(roomId, userId)
  }

  setRoomName(roomId: string, name: string): Promise<void> {
    return matrixRoomActionFacade.setRoomName(roomId, name)
  }

  setRoomTopic(roomId: string, topic: string): Promise<void> {
    return matrixRoomActionFacade.setRoomTopic(roomId, topic)
  }

  setRoomAvatar(roomId: string, avatarUrl: string): Promise<void> {
    return matrixRoomActionFacade.setRoomAvatar(roomId, avatarUrl)
  }

  setPushRule(roomId: string, enabled: boolean): Promise<void> {
    return matrixRoomActionFacade.setPushRule(roomId, enabled)
  }

  setDirectRoom(userId: string, roomId: string): Promise<void> {
    return matrixRoomActionFacade.setDirectRoom(userId, roomId)
  }

  incrementUnread(roomId: string, highlight?: boolean): Promise<void> {
    return matrixRoomActionFacade.incrementUnread(roomId, highlight)
  }

  clearUnread(roomId: string): Promise<void> {
    return matrixRoomActionFacade.clearUnread(roomId)
  }

  forgetRoom(roomId: string): Promise<void> {
    return matrixRoomActionFacade.forgetRoom(roomId)
  }

  upgradeRoom(roomId: string, newVersion: string): Promise<string> {
    return matrixRoomActionFacade.upgradeRoom(roomId, newVersion)
  }

  knockRoom(roomId: string, reason?: string): Promise<Room> {
    return matrixRoomActionFacade.knockRoom(roomId, reason)
  }

  setRoomAlias(roomId: string, alias: string): Promise<void> {
    return matrixRoomActionFacade.setRoomAlias(roomId, alias)
  }

  deleteRoomAlias(alias: string): Promise<void> {
    return matrixRoomActionFacade.deleteRoomAlias(alias)
  }

  setRoomAccountData(roomId: string, eventType: string, content: Record<string, unknown>): Promise<void> {
    return matrixRoomActionFacade.setRoomAccountData(roomId, eventType, content)
  }

  setPinnedEvents(roomId: string, eventIds: string[]): Promise<void> {
    return matrixRoomActionFacade.setPinnedEvents(roomId, eventIds)
  }

  setInviteBlocklist(roomId: string, blocked: string[]): Promise<void> {
    return matrixRoomActionFacade.setInviteBlocklist(roomId, blocked)
  }

  setInviteAllowlist(roomId: string, allowed: string[]): Promise<void> {
    return matrixRoomActionFacade.setInviteAllowlist(roomId, allowed)
  }

  setStickyEvents(roomId: string, events: Record<string, unknown>): Promise<void> {
    return matrixRoomActionFacade.setStickyEvents(roomId, events)
  }

  setTag(roomId: string, tag: string, order?: number): Promise<void> {
    return matrixRoomActionFacade.setTag(roomId, tag, order)
  }

  removeTag(roomId: string, tag: string): Promise<void> {
    return matrixRoomActionFacade.removeTag(roomId, tag)
  }

  setReadLifetime(roomId: string, lifetimeMs: number): Promise<void> {
    return matrixRoomActionFacade.setReadLifetime(roomId, lifetimeMs)
  }

  pinEvent(roomId: string, eventId: string): Promise<void> {
    return matrixRoomActionFacade.pinEvent(roomId, eventId)
  }

  unpinEvent(roomId: string, eventId: string): Promise<void> {
    return matrixRoomActionFacade.unpinEvent(roomId, eventId)
  }

  joinRoomByAlias(roomIdOrAlias: string, serverName?: string[]): Promise<{ room_id: string }> {
    return matrixRoomActionFacade.joinRoomByAlias(roomIdOrAlias, serverName)
  }

  // MemberFacade 方法
  setMemberDisplayName(roomId: string, displayName: string): Promise<void> {
    return matrixRoomMemberFacade.setMemberDisplayName(roomId, displayName)
  }

  getMemberDisplayName(roomId: string, userId: string): Promise<string | null> {
    return matrixRoomMemberFacade.getMemberDisplayName(roomId, userId)
  }

  setMemberPowerLevel(roomId: string, userId: string, powerLevel: number): Promise<void> {
    return matrixRoomMemberFacade.setMemberPowerLevel(roomId, userId, powerLevel)
  }

  setMemberAsAdmin(roomId: string, userId: string): Promise<void> {
    return matrixRoomMemberFacade.setMemberAsAdmin(roomId, userId)
  }

  removeMemberAsAdmin(roomId: string, userId: string): Promise<void> {
    return matrixRoomMemberFacade.removeMemberAsAdmin(roomId, userId)
  }

  // 直接委托给 RealtimeService，避免 Object.assign 在 Vite 预打包环境下的初始化顺序问题
  onTimelineEvent(
    callback: (data: {
      roomId: string
      eventType: string
      roomInfo: RoomInfo
      message: import('@/stores/domains/chat/chat/types').MessageType | null
    }) => void
  ): void {
    matrixRoomRealtimeService.onTimelineEvent(callback)
  }

  onRoomNameChange(callback: (roomId: string, name: string) => void): void {
    matrixRoomRealtimeService.onRoomNameChange(callback)
  }

  onRoomAvatarChange(callback: (roomId: string, avatarUrl: string | null) => void): void {
    matrixRoomRealtimeService.onRoomAvatarChange(callback)
  }

  onRoomMemberChange(callback: (roomId: string, roomInfo: RoomInfo) => void): void {
    matrixRoomRealtimeService.onRoomMemberChange(callback)
  }

  getRoomName(roomId: string): string | null {
    return matrixRoomRealtimeService.getRoomName(roomId)
  }

  getRoomAvatarUrl(roomId: string): string | null {
    return matrixRoomRealtimeService.getRoomAvatarUrl(roomId)
  }

  getVisibleRoomSessions(specialFriends: string[]): VisibleRoomSession[] {
    return matrixRoomRealtimeService.getVisibleRoomSessions(specialFriends)
  }

  getAllRoomInfos(): RoomInfo[] {
    return matrixRoomRealtimeService.getAllRoomInfos()
  }

  async getServerDomain(): Promise<string> {
    return matrixRoomLifecycleService.getServerDomain()
  }

  async translateText(text: string, targetLanguage: string): Promise<string> {
    return matrixRoomTranslateService.translateText(text, targetLanguage)
  }

  convertRoomToRoomInfo(room: Room): RoomInfo {
    return matrixRoomCreationService.convertRoomToRoomInfo(room)
  }

  async joinRoomAndGetInfo(roomId: string): Promise<RoomInfo> {
    return matrixRoomCreationService.joinRoomAndGetInfo(roomId)
  }
}

export const matrixRoomService = new MatrixRoomService()
export default matrixRoomService
