import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import { createGroupInfo } from './info'
import { createGroupLifecycle } from './lifecycle'
import { createGroupMembers } from './members'
import { createGroupRoles } from './roles'

// 类型唯一真源在 ./types（useWsEventHandler 已直接引用），此处 re-export 保持既有消费方兼容
export type { MatrixGroupInfo, MatrixRoomMember } from './types'

/**
 * 群组域 Store（装配层）
 *
 * 模块拆分（原 group.ts 700+ 行）：
 * - members.ts   群成员加载/缓存/增删改、在线状态
 * - info.ts      群资料与 name/topic/avatar/可见性元数据
 * - roles.ts     群主/管理员角色权限与设撤管理员
 * - lifecycle.ts 邀请/踢出/封禁、退群、会话切换预加载
 * - types.ts     MatrixRoomMember / MatrixGroupInfo 类型唯一真源
 *
 * 对外签名与拆分前完全一致，消费方 import 路径不变（chat/group → group/index.ts）。
 */
export const useGroupStore = defineStore(StoresEnum.GROUP, () => {
  const info = createGroupInfo()
  const members = createGroupMembers({ groupInfoMap: info.groupInfoMap })
  const roles = createGroupRoles({
    membersMap: members.membersMap,
    currentRoomMembers: members.currentRoomMembers,
    currentGroupInfo: info.currentGroupInfo
  })
  const lifecycle = createGroupLifecycle({
    membersMap: members.membersMap,
    groupInfoMap: info.groupInfoMap,
    loadRoomMembers: members.loadRoomMembers,
    loadGroupInfo: info.loadGroupInfo
  })

  return {
    ...members,
    ...info,
    ...roles,
    ...lifecycle
  }
})
