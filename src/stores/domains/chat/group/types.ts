/**
 * Group Store 类型定义
 */
import { OnlineEnum } from '@/enums'

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
  locPlace?: string
  userStateId?: string
  wearingItemId?: string
  itemIds?: string[]
  linkedGitee?: boolean
  linkedGithub?: boolean
  linkedGitcode?: boolean
  oauthProviders?: ('gitee' | 'github' | 'gitcode')[]
  hideMyPosts?: boolean
  hideTheirPosts?: boolean
}

/**
 * 群组信息
 */
export interface MatrixGroupInfo {
  roomId: string
  name: string
  avatarUrl: string | null
  topic: string | null
  memberCount: number
  memberNum?: number
  onlineNum?: number
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
}

/**
 * 群组列表项
 */
export interface GroupListItem {
  roomId: string
  name: string
  avatar: string
  avatarUrl?: string
  type: number
  memberCount: number
  unReadNum: number
  lastMsgTime: number
  lastMsg?: string
  isTop?: boolean
  isMute?: boolean
  isDisturb?: boolean
  groupInfo?: MatrixGroupInfo
}

/**
 * 成员筛选选项
 */
export interface MemberFilterOptions {
  /** 搜索关键词 */
  keyword?: string
  /** 成员类型筛选 */
  membership?: 'join' | 'leave' | 'invite' | 'ban'
  /** 角色筛选 */
  role?: 'creator' | 'moderator' | 'member'
  /** 是否只看管理员 */
  onlyAdmin?: boolean
  /** 是否只看禁言用户 */
  onlyMuted?: boolean
}
