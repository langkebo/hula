import type { Visibility } from '@/services/matrix/sdk'

export interface SpaceOptions {
  name: string
  topic?: string
  visibility?: Visibility
  avatarUrl?: string
  /** 加入规则："public" | "invite"（仅空间创建者可通过设置页修改） */
  joinRule?: string
  /** 是否公开，与 visibility 联动（public → true，private → false） */
  isPublic?: boolean
  /**
   * 同名防重逃生阀：服务端对已存在同名空间返回 409 M_ROOM_IN_USE。
   * 用户经确认弹窗选择"仍然创建"后置 true 重发，跳过查重。
   */
  ignoreDuplicateName?: boolean
}

export interface SpaceInfo {
  spaceId: string
  name: string
  topic?: string | undefined
  avatarUrl?: string | undefined
  memberCount: number
  childCount: number
  /** 空间加入规则（决定「加入」还是「申请加入」），未知时为空 */
  joinRule?: 'public' | 'invite' | 'knock' | 'restricted' | undefined
}

/** 空间层级中的房间条目（synapse-rust hierarchy 端点返回，字段按消费方约定）。 */
export interface SpaceHierarchyRoomEntry {
  room_id: string
  room_type?: string
  name?: string
  topic?: string
  avatar_url?: string
  num_joined_members?: number
  children_state?: unknown[]
}

/** 空间层级分页结果。 */
export interface SpaceHierarchyPage {
  rooms: SpaceHierarchyRoomEntry[]
  next_batch?: string
}

/** 空间成员角色（映射到 Matrix power level） */
export type SpaceMemberRole = 'admin' | 'moderator' | 'member'

/** 空间成员角色对应的 power level */
export const SPACE_ROLE_POWER_LEVELS: Record<SpaceMemberRole, number> = {
  admin: 100,
  moderator: 50,
  member: 0
}

/** 空间成员展示数据（在成员 ID 基础上补充昵称 / 头像 / 角色） */
export interface SpaceMemberDetail {
  userId: string
  displayName: string
  avatarUrl?: string
  powerLevel: number
  isCreator: boolean
  isSelf: boolean
}
