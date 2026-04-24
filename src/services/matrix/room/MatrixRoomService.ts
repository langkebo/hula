import type { Room, RoomMember, ICreateRoomOpts } from 'matrix-js-sdk'
import matrixClientService from '../MatrixClientService'
import { error } from '@tauri-apps/plugin-log'
import type { RoomInfo } from '@/services/types'
import { RoomTypeEnum } from '@/enums'
import { matrixRoomTagsService } from './TagsService'
import { matrixRoomAliasesService } from './AliasesService'
import { matrixRoomMembershipService } from './MembershipService'
import { matrixRoomStateService } from './StateService'
import { matrixRoomPinsService } from './PinsService'
import { matrixRoomModerationService } from './ModerationService'
import { matrixRoomMemberProfileService } from './MemberProfileService'
import { matrixRoomDirectMessageService } from './DirectMessageService'
import { matrixRoomMetadataService } from './MetadataService'
import { matrixRoomAccountDataService } from './AccountDataService'
import { matrixRoomLifecycleService } from './LifecycleService'
import { matrixRoomTimelineService } from './TimelineService'
import { matrixRoomSummaryAggregateService, type MatrixRoomSummary } from './SummaryService'
import { matrixRoomCreationService } from './CreationService'
import { matrixRoomTranslateService } from './TranslateService'
import { matrixRoomRealtimeService, type VisibleRoomSession } from './RealtimeService'

/**
 * Matrix 房间服务
 *
 * 提供房间管理功能，包括创建、加入、离开房间，以及成员管理等操作。
 *
 * @example
 * ```typescript
 * import { matrixRoomService } from '@/services/matrix'
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
class MatrixRoomService {
  /**
   * 获取所有房间
   *
   * @returns 房间列表
   * @throws {Error} 如果客户端未初始化
   */
  async getRooms(): Promise<Room[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('客户端未初始化')
      }
      return client.getRooms()
    } catch (err) {
      error(`[MatrixRoom] 获取房间列表失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取指定房间
   *
   * @param roomId - 房间 ID
   * @param throwOnError - 找不到房间时是否抛错，默认抛错
   * @returns 房间实例，如果显式禁用抛错则在不存在时返回 null
   * @throws {Error} 如果客户端未初始化或房间不存在
   */
  async getRoom(roomId: string): Promise<Room>
  async getRoom(roomId: string, throwOnError: true): Promise<Room>
  async getRoom(roomId: string, throwOnError: false): Promise<Room | null>
  async getRoom(roomId: string, throwOnError = true): Promise<Room | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('客户端未初始化')
      }
      const room = client.getRoom(roomId) ?? null
      if (room || !throwOnError) {
        return room
      }
      throw new Error(`房间不存在: ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 获取房间失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取当前 homeserver 域名
   *
   * @returns homeserver 域名，缺失时回退到 matrix.org
   * @throws {Error} 如果客户端未初始化
   */
  async getServerDomain(): Promise<string> {
    return matrixRoomLifecycleService.getServerDomain()
  }

  /**
   * 创建房间
   *
   * @param options - 房间创建选项
   * @returns 创建的房间
   * @throws {Error} 如果客户端未初始化或创建失败
   */
  async createRoom(options: ICreateRoomOpts): Promise<Room> {
    return matrixRoomCreationService.createRoom(options)
  }

  async createGroupRoom(options: {
    name: string
    topic?: string
    avatarUrl?: string
    isPublic?: boolean
    alias?: string
    isEncrypted?: boolean
    historyVisibility?: 'shared' | 'invited' | 'joined' | 'world_readable'
  }): Promise<Room> {
    return matrixRoomCreationService.createGroupRoom(options)
  }

  /**
   * 创建直接消息房间
   *
   * @param userId - 目标用户 ID
   * @returns 创建的房间 ID
   * @throws {Error} 如果客户端未初始化或创建失败
   */
  async createDirectRoom(userId: string): Promise<string> {
    return matrixRoomDirectMessageService.createDirectRoom(userId)
  }

  /**
   * 加入房间
   *
   * @param roomId - 房间 ID 或别名
   * @returns 加入的房间
   * @throws {Error} 如果客户端未初始化或加入失败
   */
  async joinRoom(roomId: string): Promise<Room> {
    return matrixRoomMembershipService.joinRoom(roomId)
  }

  /**
   * 离开房间
   *
   * @param roomId - 房间 ID
   * @throws {Error} 如果客户端未初始化或离开失败
   */
  async leaveRoom(roomId: string): Promise<void> {
    return matrixRoomMembershipService.leaveRoom(roomId)
  }

  /**
   * 获取房间成员列表
   *
   * @param roomId - 房间 ID
   * @returns 成员列表
   * @throws {Error} 如果客户端未初始化或房间不存在
   */
  async getMembers(roomId: string): Promise<RoomMember[]> {
    try {
      const room = await this.getRoom(roomId)
      return room.getJoinedMembers()
    } catch (err) {
      error(`[MatrixRoom] 获取房间成员失败: ${err}`)
      throw err
    }
  }

  /**
   * 邀请用户加入房间
   *
   * @param roomId - 房间 ID
   * @param userId - 用户 ID
   * @throws {Error} 如果客户端未初始化或邀请失败
   */
  async inviteUser(roomId: string, userId: string): Promise<void> {
    return matrixRoomMembershipService.inviteUser(roomId, userId)
  }

  /**
   * 将用户踢出房间
   *
   * @param roomId - 房间 ID
   * @param userId - 用户 ID
   * @param reason - 踢出原因 (可选)
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    return matrixRoomMembershipService.kickUser(roomId, userId, reason)
  }

  /**
   * 封禁用户
   *
   * @param roomId - 房间 ID
   * @param userId - 用户 ID
   * @param reason - 封禁原因 (可选)
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    return matrixRoomMembershipService.banUser(roomId, userId, reason)
  }

  /**
   * 解封用户
   *
   * @param roomId - 房间 ID
   * @param userId - 用户 ID
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async unbanUser(roomId: string, userId: string): Promise<void> {
    return matrixRoomMembershipService.unbanUser(roomId, userId)
  }

  /**
   * 设置房间名称
   *
   * @param roomId - 房间 ID
   * @param name - 新名称
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async setRoomName(roomId: string, name: string): Promise<void> {
    return matrixRoomStateService.setRoomName(roomId, name)
  }

  /**
   * 设置房间主题
   *
   * @param roomId - 房间 ID
   * @param topic - 主题内容
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async setRoomTopic(roomId: string, topic: string): Promise<void> {
    return matrixRoomStateService.setRoomTopic(roomId, topic)
  }

  /**
   * 设置房间头像
   *
   * @param roomId - 房间 ID
   * @param avatarUrl - 头像 URL (mxc://)
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async setRoomAvatar(roomId: string, avatarUrl: string): Promise<void> {
    return matrixRoomStateService.setRoomAvatar(roomId, avatarUrl)
  }

  /**
   * 获取房间状态事件
   *
   * @param roomId - 房间 ID
   * @returns 状态事件列表
   * @throws {Error} 如果客户端未初始化或房间不存在
   */
  async getRoomState(roomId: string): Promise<unknown[]> {
    return matrixRoomStateService.getRoomState(roomId)
  }

  /**
   * 设置房间推送规则
   *
   * @param roomId - 房间 ID
   * @param enabled - 是否启用推送
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async setPushRule(roomId: string, enabled: boolean): Promise<void> {
    return matrixRoomStateService.setPushRule(roomId, enabled)
  }

  /**
   * 获取直接消息房间映射
   *
   * @param throwOnError - 获取失败时是否抛错，默认抛错
   * @returns 用户 ID 到房间 ID 列表的映射
   * @throws {Error} 如果客户端未初始化
   */
  async getDirectRooms(): Promise<Map<string, string[]>>
  async getDirectRooms(throwOnError: true): Promise<Map<string, string[]>>
  async getDirectRooms(throwOnError: false): Promise<Map<string, string[]>>
  async getDirectRooms(throwOnError = true): Promise<Map<string, string[]>> {
    return matrixRoomDirectMessageService.getDirectRooms(throwOnError as true)
  }

  /**
   * 设置直接消息房间
   *
   * @param userId - 用户 ID
   * @param roomId - 房间 ID
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async setDirectRoom(userId: string, roomId: string): Promise<void> {
    return matrixRoomDirectMessageService.setDirectRoom(userId, roomId)
  }

  /**
   * 设置当前用户在房间中的昵称
   *
   * @param roomId - 房间 ID
   * @param displayName - 显示名称
   * @throws {Error} 如果客户端未初始化、用户未登录或房间不存在
   */
  async setMemberDisplayName(roomId: string, displayName: string): Promise<void> {
    return matrixRoomMemberProfileService.setMemberDisplayName(roomId, displayName)
  }

  /**
   * 获取成员在房间中的显示名称
   *
   * @param roomId - 房间 ID
   * @param userId - 用户 ID
   * @returns 显示名称，如果不存在则返回 null
   */
  async getMemberDisplayName(roomId: string, userId: string): Promise<string | null> {
    return matrixRoomMemberProfileService.getMemberDisplayName(roomId, userId)
  }

  /**
   * 设置成员权力等级（角色）
   * @param roomId - 房间 ID
   * @param userId - 用户 ID
   * @param powerLevel - 权力等级 (0=普通成员, 50=管理员, 100=创建者)
   */
  async setMemberPowerLevel(roomId: string, userId: string, powerLevel: number): Promise<void> {
    return matrixRoomMemberProfileService.setMemberPowerLevel(roomId, userId, powerLevel)
  }

  /**
   * 将成员设为管理员
   */
  async setMemberAsAdmin(roomId: string, userId: string): Promise<void> {
    return matrixRoomMemberProfileService.setMemberAsAdmin(roomId, userId)
  }

  async removeMemberAsAdmin(roomId: string, userId: string): Promise<void> {
    return matrixRoomMemberProfileService.removeMemberAsAdmin(roomId, userId)
  }

  /**
   * 翻译文本
   *
   * @param text - 要翻译的文本
   * @param _provider - 翻译服务提供者 (当前使用 Google Translate)
   * @param throwOnError - 翻译失败时是否抛错，默认抛错
   * @returns 翻译后的文本
   */
  async translateText(text: string, _provider?: string): Promise<string>
  async translateText(text: string, _provider: string | undefined, throwOnError: true): Promise<string>
  async translateText(text: string, _provider: string | undefined, throwOnError: false): Promise<string>
  async translateText(text: string, provider?: string, throwOnError = true): Promise<string> {
    return matrixRoomTranslateService.translateText(text, provider, throwOnError as true)
  }

  // ============================================
  // RoomSummaryService 对应方法
  // ============================================

  /**
   * 获取房间摘要
   * 对应后端 RoomSummaryService.get_summary()
   *
   * @param roomId - 房间 ID
   * @returns 房间摘要信息
   */
  async getRoomSummary(roomId: string, throwOnError = true): Promise<MatrixRoomSummary | null> {
    return matrixRoomSummaryAggregateService.getRoomSummary(roomId, throwOnError)
  }

  /**
   * 批量获取房间摘要
   * 使用本地 Room 对象获取，避免调用可能不存在的后端 API
   */
  async getRoomSummaries(roomIds: string[]): Promise<
    Map<
      string,
      {
        name: string | null
        topic: string | null
        avatarUrl: string | null
        memberCount: number
      }
    >
  > {
    return matrixRoomSummaryAggregateService.getRoomSummaries(roomIds)
  }

  /**
   * 增加未读计数
   * 对应后端 RoomSummaryService.increment_unread()
   *
   * @param roomId - 房间 ID
   * @param highlight - 是否高亮
   */
  async incrementUnread(roomId: string, highlight: boolean = false): Promise<void> {
    return matrixRoomLifecycleService.incrementUnread(roomId, highlight)
  }

  async clearUnread(roomId: string): Promise<void> {
    return matrixRoomLifecycleService.clearUnread(roomId)
  }

  async forgetRoom(roomId: string): Promise<void> {
    return matrixRoomMembershipService.forgetRoom(roomId)
  }

  async upgradeRoom(roomId: string, newVersion: string): Promise<string> {
    return matrixRoomLifecycleService.upgradeRoom(roomId, newVersion)
  }

  async knockRoom(roomId: string, reason?: string): Promise<Room> {
    return matrixRoomMembershipService.knockRoom(roomId, reason)
  }

  // Delegated to ./room/AliasesService.ts
  async getRoomAliases(roomId: string): Promise<string[]> {
    return matrixRoomAliasesService.getAliases(roomId)
  }

  async setRoomAlias(roomId: string, alias: string): Promise<void> {
    return matrixRoomAliasesService.setAlias(roomId, alias)
  }

  async deleteRoomAlias(alias: string): Promise<void> {
    return matrixRoomAliasesService.deleteAlias(alias)
  }

  async getEventContext(
    roomId: string,
    eventId: string,
    limit: number = 10
  ): Promise<{
    event: unknown
    events_before: unknown[]
    events_after: unknown[]
    state: unknown[]
  } | null> {
    return matrixRoomTimelineService.getEventContext(roomId, eventId, limit)
  }

  async getRoomVersion(roomId: string): Promise<string | null> {
    return matrixRoomMetadataService.getRoomVersion(roomId)
  }

  async getRoomCapabilities(roomId: string): Promise<Record<string, unknown>> {
    return matrixRoomMetadataService.getRoomCapabilities(roomId)
  }

  async getRoomTimeline(
    roomId: string,
    options?: { from?: string; limit?: number; dir?: 'f' | 'b' }
  ): Promise<{
    chunk: unknown[]
    start: string
    end: string
  }> {
    return matrixRoomTimelineService.getRoomTimeline(roomId, options)
  }

  async getRoomUnreadCount(roomId: string): Promise<{
    unread_notifications: number
    unread_highlighted: number
  }> {
    return matrixRoomTimelineService.getRoomUnreadCount(roomId)
  }

  async getRoomAccountData(roomId: string, eventType: string): Promise<Record<string, unknown> | null> {
    return matrixRoomAccountDataService.getRoomAccountData(roomId, eventType)
  }

  async setRoomAccountData(roomId: string, eventType: string, content: Record<string, unknown>): Promise<void> {
    return matrixRoomAccountDataService.setRoomAccountData(roomId, eventType, content)
  }

  async getRoomMetadata(roomId: string): Promise<Record<string, unknown>> {
    return matrixRoomMetadataService.getRoomMetadata(roomId)
  }

  async getRoomTurnServer(roomId: string): Promise<Record<string, unknown>> {
    return matrixRoomMetadataService.getRoomTurnServer(roomId)
  }

  async getPinnedEvents(roomId: string): Promise<string[]> {
    return matrixRoomPinsService.getPinnedEvents(roomId)
  }

  async setPinnedEvents(roomId: string, eventIds: string[]): Promise<void> {
    return matrixRoomPinsService.setPinnedEvents(roomId, eventIds)
  }

  async getInviteBlocklist(roomId: string): Promise<string[]> {
    return matrixRoomModerationService.getInviteBlocklist(roomId)
  }

  async setInviteBlocklist(roomId: string, blocked: string[]): Promise<void> {
    return matrixRoomModerationService.setInviteBlocklist(roomId, blocked)
  }

  async getInviteAllowlist(roomId: string): Promise<string[]> {
    return matrixRoomModerationService.getInviteAllowlist(roomId)
  }

  async setInviteAllowlist(roomId: string, allowed: string[]): Promise<void> {
    return matrixRoomModerationService.setInviteAllowlist(roomId, allowed)
  }

  async getStickyEvents(roomId: string): Promise<Record<string, unknown>> {
    return matrixRoomPinsService.getStickyEvents(roomId)
  }

  async setStickyEvents(roomId: string, events: Record<string, unknown>): Promise<void> {
    return matrixRoomPinsService.setStickyEvents(roomId, events)
  }

  async timestampToEvent(
    roomId: string,
    timestamp: number,
    dir: 'f' | 'b' = 'b'
  ): Promise<{ event_id: string; origin_server_ts: number } | null> {
    return matrixRoomTimelineService.timestampToEvent(roomId, timestamp, dir)
  }

  async getRoomCall(roomId: string, callId: string): Promise<Record<string, unknown> | null> {
    return matrixRoomTimelineService.getRoomCall(roomId, callId)
  }

  async getRoomSync(roomId: string): Promise<Record<string, unknown>> {
    return matrixRoomMetadataService.getRoomSync(roomId)
  }

  // Delegated to ./room/TagsService.ts
  async getTags(roomId: string): Promise<Record<string, { order?: number }>> {
    return matrixRoomTagsService.getTags(roomId)
  }

  async setTag(roomId: string, tag: string, order?: number): Promise<void> {
    return matrixRoomTagsService.setTag(roomId, tag, order)
  }

  async removeTag(roomId: string, tag: string): Promise<void> {
    return matrixRoomTagsService.removeTag(roomId, tag)
  }

  async getReportScannerInfo(roomId: string, eventId: string): Promise<Record<string, unknown> | null> {
    return matrixRoomAccountDataService.getReportScannerInfo(roomId, eventId)
  }

  async setReadLifetime(roomId: string, lifetimeMs: number): Promise<void> {
    return matrixRoomAccountDataService.setReadLifetime(roomId, lifetimeMs)
  }

  async getExternalServices(): Promise<Array<Record<string, unknown>>> {
    return matrixRoomAccountDataService.getExternalServices()
  }

  convertRoomToRoomInfo(room: Room): RoomInfo {
    return matrixRoomCreationService.convertRoomToRoomInfo(room)
  }

  convertRoomToSession(room: Room): {
    roomId: string
    name: string
    avatar: string
    type: RoomTypeEnum
    unreadCount: number
    activeTime: number
  } {
    return matrixRoomRealtimeService.convertRoomToSession(room)
  }

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

  async joinRoomAndGetInfo(roomId: string): Promise<RoomInfo> {
    return matrixRoomCreationService.joinRoomAndGetInfo(roomId)
  }
}

export const matrixRoomService = new MatrixRoomService()
export default matrixRoomService
