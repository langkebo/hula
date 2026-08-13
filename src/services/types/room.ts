/**
 * 房间域类型定义
 * 注意：请使用TSDoc规范进行注释，以便在使用时能够获得良好提示。
 * @see TSDoc规范 https://tsdoc.org/
 */
import type { RoomTypeEnum } from '@/enums'

export type DetailsContent =
  | {
      type: 'apply'
      applyType: 'friend' | 'group'
    }
  | {
      type: RoomTypeEnum
      uid: string
    }

export interface RoomMemberInfo {
  userId: string
  name: string
  avatarUrl?: string
  powerLevel?: number
}

export interface RoomDetail {
  roomId: string
  topic: string | null
  memberCount: number
  joinedCount: number
  ownerId: string | null
  joinRule: 'public' | 'invite' | 'knock' | 'private' | null
  canonicalAlias: string | null
  avatarUrl: string | null
  createdTs: number | null
  isPublic: boolean | null
}

export interface RoomInfo {
  roomId: string
  name: string
  avatarUrl: string | null
  isDirect: boolean
  isEncrypted: boolean
  unreadCount: number
  highlightCount: number
  notificationCount: number
  lastMessage: string | null
  lastMessageTime: number | null
  members: RoomMemberInfo[]
  detail?: RoomDetail
}
