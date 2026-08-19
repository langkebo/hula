import type { ICreateRoomOpts, Room, RoomMember } from 'matrix-js-sdk'
import { NotificationCountType, Preset, Visibility } from 'matrix-js-sdk'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import type { RoomInfo, RoomMemberInfo } from '@/services/types'
import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'
import { matrixRoomMembershipService } from './MembershipService'

const logger = createLogger('CreationService')

export interface CreateGroupRoomOptions {
  name: string
  topic?: string
  avatarUrl?: string
  isPublic?: boolean
  alias?: string
  isEncrypted?: boolean
  historyVisibility?: 'shared' | 'invited' | 'joined' | 'world_readable'
  joinRule?: 'invite' | 'knock' | 'public' | 'restricted'
  invite?: string[]
  /**
   * 同名防重逃生阀：服务端对已存在同名群/空间返回 409 M_ROOM_IN_USE。
   * 用户经确认弹窗选择"仍然创建"后置为 true 重发，跳过查重。
   */
  ignoreDuplicateName?: boolean
}

/**
 * Room creation, conversion, and join-with-info domain service.
 *
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 * - `createRoom` / `createGroupRoom`: SDK room creation
 * - `convertRoomToRoomInfo`: `Room` → `RoomInfo` normalization (shared by realtime event handlers)
 * - `joinRoomAndGetInfo`: convenience wrapper combining membership join + conversion
 */
export class MatrixRoomCreationService {
  async createRoom(options: ICreateRoomOpts): Promise<Room> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('creation', 'pending', { options })
      logger.info('[MatrixRoom] 离线状态，已将创建房间请求入队')
      // 返回一个伪造的 Room 对象，包含必要的字段以避免前端崩溃
      return {
        roomId: `!pending-${Date.now()}`,
        getLiveTimeline: () => ({ getEvents: () => [] }),
        getMember: () => null,
        getJoinedMembers: () => []
      } as unknown as Room
    }
    try {
      return await matrixClientService.createRoom(options)
    } catch (err) {
      logger.error(`[MatrixRoom] 创建房间失败: ${err}`)
      throw err
    }
  }

  async createGroupRoom(options: CreateGroupRoomOptions): Promise<Room> {
    const createOpts: ICreateRoomOpts = {
      name: options.name,
      topic: options.topic,
      visibility: options.isPublic ? Visibility.Public : Visibility.Private,
      preset: options.isPublic ? Preset.PublicChat : Preset.PrivateChat,
      room_alias_name: options.alias || undefined,
      initial_state: []
    }

    if (options.avatarUrl) {
      createOpts.initial_state!.push({
        type: 'm.room.avatar',
        state_key: '',
        content: { url: options.avatarUrl }
      })
    }

    if (options.isEncrypted && !options.isPublic) {
      createOpts.initial_state!.push({
        type: 'm.room.encryption',
        state_key: '',
        content: {
          algorithm: 'm.megolm.v1.aes-sha2'
        }
      })
    }

    if (options.historyVisibility && options.historyVisibility !== 'shared') {
      createOpts.initial_state!.push({
        type: 'm.room.history_visibility',
        state_key: '',
        content: { history_visibility: options.historyVisibility }
      })
    }

    if (options.joinRule && options.joinRule !== 'invite') {
      createOpts.initial_state!.push({
        type: 'm.room.join_rules',
        state_key: '',
        content: { join_rule: options.joinRule }
      })
    }

    if (options.invite && options.invite.length > 0) {
      createOpts.invite = options.invite
    }

    // 同名防重逃生阀：确认弹窗后置 true 重发，让服务端跳过 M_ROOM_IN_USE 查重。
    if (options.ignoreDuplicateName) {
      createOpts.ignore_duplicate_name = true
    }

    return this.createRoom(createOpts)
  }

  convertRoomToRoomInfo(room: Room): RoomInfo {
    const timeline = room.getLiveTimeline().getEvents()
    const lastEvent = timeline[timeline.length - 1]

    let lastMessage: string | null = null
    let lastMessageTime: number | null = null

    if (lastEvent) {
      lastMessageTime = lastEvent.getTs()
      const content = lastEvent.getContent()
      if (content.msgtype === 'm.text' || content.msgtype === 'm.notice') {
        lastMessage = content.body as string
      } else if (content.msgtype === 'm.image') {
        lastMessage = '[图片]'
      } else if (content.msgtype === 'm.video') {
        lastMessage = '[视频]'
      } else if (content.msgtype === 'm.audio') {
        lastMessage = '[音频]'
      } else if (content.msgtype === 'm.file') {
        lastMessage = '[文件]'
      } else if (lastEvent.getType() === 'm.room.member') {
        lastMessage = content.membership === 'join' ? '加入了房间' : '离开了房间'
      }
    }

    const client = matrixClientService.getClient()
    const isEncrypted = client?.isRoomEncrypted?.(room.roomId) ?? false

    const roomAsRecord = room as unknown as Record<string, unknown>
    const isSpaceRoom = typeof roomAsRecord.isSpaceRoom === 'function' ? (roomAsRecord.isSpaceRoom() as boolean) : false
    const dmInviter =
      typeof roomAsRecord.getDMInviter === 'function' ? (roomAsRecord.getDMInviter() as string | undefined) : undefined

    let unreadNotificationCount = 0
    let highlightNotificationCount = 0
    let notificationNotificationCount = 0

    interface SyncData {
      unread_notifications?: {
        notification_count?: number
        highlight_count?: number
      }
    }

    const syncData = (room as unknown as { syncData?: SyncData }).syncData
    if (syncData?.unread_notifications) {
      unreadNotificationCount = syncData.unread_notifications.notification_count ?? 0
      highlightNotificationCount = syncData.unread_notifications.highlight_count ?? 0
      notificationNotificationCount = unreadNotificationCount
    } else {
      unreadNotificationCount = room.getUnreadNotificationCount?.() ?? 0
      highlightNotificationCount = room.getUnreadNotificationCount?.(NotificationCountType.Highlight) ?? 0
      notificationNotificationCount = room.getUnreadNotificationCount?.(NotificationCountType.Total) ?? 0
    }

    return {
      roomId: room.roomId,
      name: room.name || room.roomId,
      avatarUrl: room.getMxcAvatarUrl?.() ?? null,
      isDirect: isSpaceRoom ? false : dmInviter !== undefined || room.getJoinedMembers().length <= 2,
      isEncrypted,
      unreadCount: unreadNotificationCount,
      highlightCount: highlightNotificationCount,
      notificationCount: notificationNotificationCount,
      lastMessage,
      lastMessageTime,
      members: room.getJoinedMembers().map(
        (member: RoomMember): RoomMemberInfo => ({
          userId: member.userId,
          name: member.name || member.userId,
          avatarUrl: member.getMxcAvatarUrl?.() ?? undefined,
          powerLevel: member.powerLevel
        })
      )
    }
  }

  async joinRoomAndGetInfo(roomId: string): Promise<RoomInfo> {
    const room = await matrixRoomMembershipService.joinRoom(roomId)
    return this.convertRoomToRoomInfo(room)
  }
}

export const matrixRoomCreationService = new MatrixRoomCreationService()
