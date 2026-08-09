/**
 * Contacts Store 类型定义
 */
import type { OnlineEnum } from '@/enums'
import type { FriendStatus } from '@/services/matrix/friends/MatrixFriendService'

export interface MatrixContact {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  presence?: string
  statusMessage?: string
  directRoomId?: string
  uid: string
  name: string
  account: string
  avatar: string
  activeStatus: OnlineEnum
  remark: string
  lastOptTime: number
  hideMyPosts: boolean
  hideTheirPosts: boolean
  friendStatus?: FriendStatus
  since?: number
  note?: string
}

export interface ContactInvite {
  roomId: string
  fromUserId: string
  fromDisplayName: string | null
  timestamp: number
  isGroup: boolean
}

export interface FriendRequestItem {
  userId?: string
  displayName?: string
  avatarUrl?: string
  message?: string
  timestamp?: number
  direction?: 'incoming' | 'outgoing'
  type?: string | number
  roomId?: string
  applyId: string
  state?: number
  applyType?: string | 'group' | 'friend'
  markAsRead?: boolean
  senderId?: string
  operateId?: string
  content?: string
  status?: number
  receiverId?: string
  eventType?: number
  isRead?: boolean
  createTime?: number
}

export type FriendListErrorState = {
  message: string
  source: 'initialize' | 'contacts'
}
