import { computed } from 'vue'
import { PowerEnum, RoleEnum, RoomTypeEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
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

  /**
   * 撤回消息可见性：系统管理员 / 群管理（群主或管理员）可撤回任意消息；
   * 普通成员只能撤回自己 2 分钟内的消息
   */
  const canRecallMessage = (item: MessageType): boolean => {
    const isSystemAdmin = userStore.userInfo?.power === PowerEnum.ADMIN
    if (isSystemAdmin) {
      return true
    }

    const isGroupSession = globalStore.currentSession?.type === RoomTypeEnum.GROUP
    const currentMember = isGroupSession
      ? groupStore.userList.find((member) => member.uid === userUid.value)
      : undefined
    const isGroupManager =
      isGroupSession &&
      (currentMember?.roleId === RoleEnum.LORD ||
        currentMember?.roleId === RoleEnum.ADMIN ||
        groupStore.currentLordId === userUid.value ||
        groupStore.adminUidList.includes(userUid.value))

    if (isGroupManager) {
      return true
    }

    const isCurrentUser = item.fromUser.uid === userUid.value
    if (!isCurrentUser) {
      return false
    }

    return !isDiffNow({ time: item.message.sendTime, unit: 'minute', diff: 2 })
  }

  return {
    userUid,
    isGroupManagementContext,
    resolveTargetRoleId,
    currentUserRoleId,
    isCurrentUserLord,
    canRecallMessage
  }
}
