import { type ComputedRef, ref } from 'vue'
import type { ActionFeedbackType, AriaLivePoliteness } from '@/composables/common/useActionFeedback'
import { MittEnum, RoleEnum, RoomTypeEnum } from '@/enums'
import { openMsgSession } from '@/hooks/session/openMsgSession'
import { useMitt } from '@/hooks/useMitt.ts'
import { adminService } from '@/services/matrix/admin'
import { roomNavigationService } from '@/services/matrix/room/RoomNavigationService'
import { useContactStore } from '@/stores/domains/chat/contacts'
import type { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import type { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import type { GroupNicknameModalPayload } from './useGroupNicknameModal'

const logger = createLogger('ChatMain.UserContextMenu')

type ContextMenuItem = { uid?: string; fromUser: { uid: string } } & Record<string, unknown>

type UseUserContextMenuDeps = {
  t: (key: string) => string
  showFeedback: (message: string, type: ActionFeedbackType, politeness?: AriaLivePoliteness) => void
  userUid: ComputedRef<string>
  groupStore: ReturnType<typeof useGroupStore>
  globalStore: ReturnType<typeof useGlobalStore>
}

export const useUserContextMenu = (deps: UseUserContextMenuDeps) => {
  const { t, showFeedback, userUid, groupStore, globalStore } = deps

  const checkFriendRelation = (uid: string, type: 'friend' | 'all' = 'all') => {
    const contactStore = useContactStore()
    const userStore = useUserStore()
    const myUid = userStore.userInfo?.uid ?? ''
    const isFriend = contactStore.contactsList.some((item) => item.uid === uid)
    return type === 'friend' ? isFriend && uid !== myUid : isFriend || uid === myUid
  }

  const optionsList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.send_message'),
      icon: 'message-action',
      click: (item: ContextMenuItem) => {
        openMsgSession(item.uid || item.fromUser.uid)
      },
      visible: (item: ContextMenuItem) => checkFriendRelation(item.uid || item.fromUser.uid, 'friend')
    },
    {
      label: 'TA',
      icon: 'aite',
      click: (item: ContextMenuItem) => {
        useMitt.emit(MittEnum.AT, item.uid || item.fromUser.uid)
      },
      visible: (item: ContextMenuItem) => (item.uid ? item.uid !== userUid.value : item.fromUser.uid !== userUid.value)
    },
    {
      label: () => t('menu.get_user_info'),
      icon: 'notes',
      click: (item: ContextMenuItem & { message?: { id: string }; type?: string }) => {
        const uid = (item.uid || item.message?.id) as string
        const type = item.type ?? 'Main'
        useMitt.emit(`${MittEnum.INFO_POPOVER}-${type}`, { uid: uid, type: type })
      }
    },
    {
      label: () => t('menu.modify_group_nickname'),
      icon: 'edit',
      click: (item: ContextMenuItem) => {
        const targetUid = item.uid || item.fromUser?.uid
        const currentUid = userUid.value
        const roomId = globalStore.currentSessionRoomId
        const isGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP

        if (!isGroup || targetUid !== currentUid) {
          return
        }

        const currentUserInfo = groupStore.getUserInfo(currentUid, roomId)
        const currentNickname = currentUserInfo?.myName || ''

        useMitt.emit(MittEnum.OPEN_GROUP_NICKNAME_MODAL, {
          roomId,
          currentUid,
          originalNickname: currentNickname
        } as GroupNicknameModalPayload)
      },
      visible: (item: ContextMenuItem) => (item.uid ? item.uid === userUid.value : item.fromUser.uid === userUid.value)
    },
    {
      label: () => t('menu.add_friend'),
      icon: 'people-plus',
      click: (item: ContextMenuItem) => {
        useMitt.emit(MittEnum.OPEN_ADD_FRIEND_DIALOG, { uid: item.uid || item.fromUser.uid })
      },
      visible: (item: ContextMenuItem) => !checkFriendRelation(item.uid || item.fromUser.uid, 'all')
    },
    {
      label: () => t('menu.set_admin'),
      icon: 'people-safe',
      click: async (item: ContextMenuItem) => {
        const targetUid = item.uid || item.fromUser.uid
        const roomId = globalStore.currentSessionRoomId
        if (!roomId) return

        try {
          await groupStore.addAdmin([targetUid])
          showFeedback(t('menu.set_admin_success'), 'success')
        } catch (error) {
          logger.warn('Failed to set group admin', { roomId, targetUid, error })
          showFeedback(t('menu.set_admin_fail'), 'error')
        }
      },
      visible: (item: ContextMenuItem) => {
        const isInGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        if (!isInGroup) return false

        const roomId = globalStore.currentSessionRoomId
        if (!roomId || roomId === '1') return false

        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        let targetRoleId = item.roleId as number | undefined

        if (targetRoleId === void 0) {
          const targetUser = groupStore.userList.find((user) => user.uid === targetUid)
          targetRoleId = targetUser?.roleId
        }

        if (targetRoleId === RoleEnum.ADMIN || targetRoleId === RoleEnum.LORD) return false

        const currentUser = groupStore.userList.find((user) => user.uid === userUid.value)
        return currentUser?.roleId === RoleEnum.LORD
      }
    },
    {
      label: () => t('menu.revoke_admin'),
      icon: 'reduce-user',
      click: async (item: ContextMenuItem) => {
        const targetUid = item.uid || item.fromUser.uid
        const roomId = globalStore.currentSessionRoomId
        if (!roomId) return

        try {
          await groupStore.revokeAdmin([targetUid])
          showFeedback(t('menu.revoke_admin_success'), 'success')
        } catch (error) {
          logger.warn('Failed to revoke group admin', { roomId, targetUid, error })
          showFeedback(t('menu.revoke_admin_fail'), 'error')
        }
      },
      visible: (item: ContextMenuItem) => {
        const isInGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        if (!isInGroup) return false

        const roomId = globalStore.currentSessionRoomId
        if (!roomId || roomId === '1') return false

        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        let targetRoleId = item.roleId as number | undefined

        if (targetRoleId === void 0) {
          const targetUser = groupStore.userList.find((user) => user.uid === targetUid)
          targetRoleId = targetUser?.roleId
        }

        if (targetRoleId !== RoleEnum.ADMIN) return false

        const currentUser = groupStore.userList.find((user) => user.uid === userUid.value)
        return currentUser?.roleId === RoleEnum.LORD
      }
    }
  ])

  const report = ref([
    {
      label: () => t('menu.remove_from_group'),
      icon: 'people-delete-one',
      click: async (item: ContextMenuItem) => {
        const targetUid = item.uid || item.fromUser.uid
        const roomId = globalStore.currentSessionRoomId
        if (!roomId) return

        try {
          await roomNavigationService.removeMember(roomId, targetUid)
          groupStore.removeUserItem(targetUid, roomId)
          showFeedback(t('menu.remove_from_group_success'), 'success')
        } catch (error) {
          logger.warn('Failed to remove member from group', { roomId, targetUid, error })
          showFeedback(t('menu.remove_from_group_fail'), 'error')
        }
      },
      visible: (item: ContextMenuItem) => {
        const isInGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        if (!isInGroup) return false

        const roomId = globalStore.currentSessionRoomId
        if (!roomId || roomId === '1') return false

        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        let targetRoleId = item.roleId as number | undefined

        if (targetRoleId === void 0) {
          const targetUser = groupStore.userList.find((user) => user.uid === targetUid)
          targetRoleId = targetUser?.roleId
        }

        if (targetRoleId === RoleEnum.LORD) return false

        const currentUser = groupStore.userList.find((user) => user.uid === userUid.value)
        const isLord = currentUser?.roleId === RoleEnum.LORD
        const isAdmin = currentUser?.roleId === RoleEnum.ADMIN

        if (isAdmin && targetRoleId === RoleEnum.ADMIN) return false

        return isLord || isAdmin
      }
    },
    {
      label: () => t('menu.report'),
      icon: 'caution',
      click: async (item: ContextMenuItem & { message?: { id: string } }) => {
        const roomId = globalStore.currentSessionRoomId
        const eventId = item.message?.id
        if (!roomId || !eventId) {
          showFeedback('无法获取消息信息', 'warning')
          return
        }
        try {
          await adminService.reportEvent({
            roomId,
            eventId,
            reason: 'violation',
            explanation: 'User reported via chat menu'
          })
          showFeedback(t('menu.report_success'), 'success')
        } catch (err) {
          logger.error('举报失败:', err)
          showFeedback('举报失败，请稍后重试', 'error')
        }
      }
    }
  ])

  return {
    optionsList,
    report,
    checkFriendRelation
  }
}
