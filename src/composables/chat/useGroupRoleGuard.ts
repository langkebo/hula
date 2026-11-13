import { computed } from 'vue'
import { PowerEnum, RoleEnum, RoomTypeEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { isDiffNow } from '@/utils/ComputedTime'

/** 群管理右键菜单项的公共形状（消息项或成员项） */
export type GroupRoleMenuItem = { uid?: string; fromUser: { uid: string }; roleId?: number } & Record<string, unknown>

/**
 * 群角色权限守卫
 *
 * 从 useChatMain 抽离：设/撤管理员、移出群、撤回消息四处共用同一套
 * 「群上下文 + 目标角色解析 + 当前用户角色」判断，此前各自重复实现。
 */
export const useGroupRoleGuard = () => {
  const groupStore = useGroupStore()
  const userStore = useUserStore()
  const globalStore = useGlobalStore()
  const settingStore = useSettingStore()
  const userUid = computed(() => userStore.userInfo?.uid ?? '')

  /** 群管理操作（设/撤管理员、移出群）的共同前置：当前是群聊且非频道房间(roomId === '1') */
  const isGroupManagementContext = (): boolean => {
    const isGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
    if (!isGroup) return false
    const roomId = globalStore.currentSessionRoomId
    return !!roomId && roomId !== '1'
  }

  /** 解析目标用户角色：优先取 item.roleId，缺失时从群成员列表按 uid 查找 */
  const resolveTargetRoleId = (item: GroupRoleMenuItem): number | undefined => {
    if (item.roleId !== void 0) return item.roleId
    const targetUid = item.uid || item.fromUser?.uid
    if (!targetUid) return undefined
    return groupStore.userList.find((user) => user.uid === targetUid)?.roleId
  }

  /** 当前用户在当前群的角色（未找到返回 undefined） */
  const currentUserRoleId = (): number | undefined => {
    return groupStore.userList.find((user) => user.uid === userUid.value)?.roleId
  }

  /** 当前用户是否群主 */
  const isCurrentUserLord = (): boolean => currentUserRoleId() === RoleEnum.LORD

  /** 撤回权限：系统管理员 / 群管理（群主或管理员）可撤回任意消息，且不受时限约束 */
  const hasRecallPrivilege = (): boolean => {
    if (userStore.userInfo?.power === PowerEnum.ADMIN) {
      return true
    }

    const isGroupSession = globalStore.currentSession?.type === RoomTypeEnum.GROUP
    if (!isGroupSession) {
      return false
    }
    const currentMember = groupStore.userList.find((member) => member.uid === userUid.value)
    return (
      currentMember?.roleId === RoleEnum.LORD ||
      currentMember?.roleId === RoleEnum.ADMIN ||
      groupStore.currentLordId === userUid.value ||
      groupStore.adminUidList.includes(userUid.value)
    )
  }

  /**
   * 撤回入口可见性：有特权者可撤回任意消息；普通成员只对自己的消息显示入口，
   * 超出 settingStore.recallTime 时限时入口置灰（见 isRecallExpired）
   */
  const canRecallMessage = (item: MessageType): boolean => {
    if (hasRecallPrivilege()) {
      return true
    }
    return item.fromUser.uid === userUid.value
  }

  /**
   * 本人消息是否已超出「消息撤回时间」设置的时间窗（秒）
   * 有撤回特权者不受时限约束，始终返回 false
   */
  const isRecallExpired = (item: MessageType): boolean => {
    if (hasRecallPrivilege()) return false
    return isDiffNow({ time: item.message.sendTime, unit: 'second', diff: settingStore.recallTime })
  }

  return {
    userUid,
    isGroupManagementContext,
    resolveTargetRoleId,
    currentUserRoleId,
    isCurrentUserLord,
    canRecallMessage,
    isRecallExpired
  }
}
