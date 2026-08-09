import { type ComputedRef, computed } from 'vue'
import { matrixRoomMemberFacade } from '@/services/matrix/room/MemberFacade'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import type { MatrixGroupInfo, MatrixRoomMember } from './types'

const logger = createLogger('GroupStore.Roles')

export type GroupRolesContext = {
  membersMap: Record<string, MatrixRoomMember[]>
  currentRoomMembers: ComputedRef<MatrixRoomMember[]>
  currentGroupInfo: ComputedRef<MatrixGroupInfo | null | undefined>
}

/**
 * 群角色权限模块：群主/管理员判定、我的群昵称、设撤管理员。
 */
export function createGroupRoles(ctx: GroupRolesContext) {
  const { membersMap, currentRoomMembers, currentGroupInfo } = ctx
  const globalStore = useGlobalStore()
  const matrixStore = useMatrixStore()

  const currentRoomCreator = computed(() => {
    return currentGroupInfo.value?.creator || null
  })

  const currentRoomModerators = computed(() => {
    return currentRoomMembers.value.filter((m) => m.isModerator || m.isCreator)
  })

  const isCurrentUserCreator = computed(() => {
    const creator = currentRoomCreator.value
    return creator === matrixStore.userId
  })

  const isCurrentUserModerator = computed(() => {
    const myUserId = matrixStore.userId
    if (!myUserId) return false
    return currentRoomMembers.value.some((m) => m.userId === myUserId && (m.isModerator || m.isCreator))
  })

  const currentLordId = computed(() => {
    const creator = currentRoomCreator.value
    return creator || null
  })

  const adminUidList = computed(() => {
    return currentRoomModerators.value.map((m) => m.userId)
  })

  const myNameInCurrentGroup = computed({
    get() {
      const myUserId = matrixStore.userId
      if (!myUserId) return ''
      const member = currentRoomMembers.value.find((m) => m.userId === myUserId)
      return member?.displayName || member?.name || ''
    },
    async set(value: string) {
      const roomId = globalStore.currentSessionRoomId
      if (!roomId) return
      try {
        await matrixRoomMemberFacade.setMemberDisplayName(roomId, value)
        logger.info(`[GroupStore] Successfully set display name to: ${value}`)
      } catch (e) {
        logger.error(`[GroupStore] Failed to set display name: ${e}`)
      }
    }
  })

  const isCurrentLord = computed(() => (uid: string) => {
    return currentLordId.value === uid
  })

  const isAdmin = computed(() => (uid: string) => {
    return adminUidList.value.includes(uid)
  })

  function isAdminOrLord(): boolean {
    return isCurrentUserCreator.value || isCurrentUserModerator.value
  }

  function getCurrentUser(): MatrixRoomMember | null {
    const myUserId = matrixStore.userId
    if (!myUserId) return null
    return currentRoomMembers.value.find((m) => m.userId === myUserId) || null
  }

  async function addAdmin(uidList: string[]): Promise<void> {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId) return
    try {
      for (const uid of uidList) {
        await matrixRoomMemberFacade.setMemberPowerLevel(roomId, uid, 100)
      }
      logger.info(`[GroupStore] 成功添加 ${uidList.length} 个管理员`)
    } catch (e) {
      logger.error(`[GroupStore] 添加管理员失败: ${e}`)
      throw e
    }
  }

  async function revokeAdmin(uidList: string[]): Promise<void> {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId) return
    try {
      for (const uid of uidList) {
        await matrixRoomMemberFacade.setMemberPowerLevel(roomId, uid, 0)
      }
      logger.info(`[GroupStore] 成功撤销 ${uidList.length} 个管理员`)
    } catch (e) {
      logger.error(`[GroupStore] 撤销管理员失败: ${e}`)
      throw e
    }
  }

  function updateAdminStatus(roomId: string, uids: string[], isAdmin: boolean): void {
    const members = membersMap[roomId]
    if (!members) return
    membersMap[roomId] = members.map((m) =>
      uids.includes(m.userId) ? { ...m, isModerator: isAdmin, roleId: isAdmin ? 1 : 2 } : m
    )
  }

  return {
    currentRoomCreator,
    currentRoomModerators,
    isCurrentUserCreator,
    isCurrentUserModerator,
    currentLordId,
    adminUidList,
    myNameInCurrentGroup,
    isCurrentLord,
    isAdmin,
    isAdminOrLord,
    getCurrentUser,
    addAdmin,
    revokeAdmin,
    updateAdminStatus
  }
}
