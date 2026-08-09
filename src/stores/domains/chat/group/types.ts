/**
 * Group Store 类型定义
 */
import type { OnlineEnum } from '@/enums'

/**
 * 房间成员
 */
export interface MatrixRoomMember {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  membership: 'join' | 'leave' | 'invite' | 'ban'
  powerLevel: number
  isModerator: boolean
  isCreator: boolean
  name: string
  uid: string
  account: string
  avatar: string
  activeStatus: OnlineEnum
  roleId: number
  lastOptTime: number
  myName?: string
  userStateId?: string
  linkedGitee?: boolean
  linkedGithub?: boolean
  oauthProviders?: ('gitee' | 'github')[]
  hideMyPosts?: boolean
  hideTheirPosts?: boolean
}

/**
 * 群组（房间）信息
 */
export interface MatrixGroupInfo {
  roomId: string
  name: string
  avatarUrl: string | null
  topic: string | null
  memberCount: number
  memberNum?: number
  isEncrypted: boolean
  isPublic: boolean
  creator: string | null
  remark?: string
  allowScanEnter?: boolean
  avatar: string
  groupName: string
  roleId: number
  account: string
  myName: string
  joinRule?: string
  onlineCount?: number
}
