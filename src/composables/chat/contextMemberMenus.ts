import { ref } from 'vue'
import type { useI18n } from 'vue-i18n'
import { openMsgSession } from '@/composables/chat/openMsgSession'
import type { GroupNicknameModalPayload } from '@/composables/chat/useGroupNicknameModal'
import type { GroupRoleMenuItem, useGroupRoleGuard } from '@/composables/chat/useGroupRoleGuard'
import type { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum, RoleEnum, RoomTypeEnum } from '@/enums'
import { matrixRoomActionFacade } from '@/services/matrix/room/RoomFacade'
import type { useGroupStore } from '@/stores/domains/chat/group'
import type { useGlobalStore } from '@/stores/domains/widget/global'
import type { ContextMenuHelpers } from './contextMenuHelpers'

/** 群成员项（与消息项共用右键菜单形状） */
type ContextMenuItem = GroupRoleMenuItem

/** 群成员管理菜单依赖 */
type MemberMenuDeps = {
  t: ReturnType<typeof useI18n>['t']
  showFeedback: ReturnType<typeof useActionFeedback>['showFeedback']
  helpers: ContextMenuHelpers
  globalStore: ReturnType<typeof useGlobalStore>
  groupStore: ReturnType<typeof useGroupStore>
  groupRoleGuard: ReturnType<typeof useGroupRoleGuard>
}

/** 右键用户信息菜单（群聊时显示）与举报/移出群聊选项 */
export const createMemberMenus = (deps: MemberMenuDeps) => {
  const { t, showFeedback, helpers, globalStore, groupStore, groupRoleGuard } = deps
  const { checkFriendRelation } = helpers
  const { userUid, isGroupManagementContext, resolveTargetRoleId, currentUserRoleId, isCurrentUserLord } =
    groupRoleGuard

  /** 右键用户信息菜单(群聊的时候显示) */
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
        // 如果是聊天框内的资料就使用的是消息的key，如果是群聊成员的资料就使用的是uid
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
      click: async (item: ContextMenuItem) => {
        const uid = item.uid || item.fromUser.uid
        const { default: router } = await import('@/router')
        void router.push({ name: 'friend-add', query: { uid } })
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
        } catch {
          showFeedback(t('menu.set_admin_fail'), 'error')
        }
      },
      visible: (item: ContextMenuItem) => {
        if (!isGroupManagementContext()) return false

        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 已经是管理员或群主的用户不能再设为管理员
        const targetRoleId = resolveTargetRoleId(item)
        if (targetRoleId === RoleEnum.ADMIN || targetRoleId === RoleEnum.LORD) return false

        // 只有群主可以设管理员
        return isCurrentUserLord()
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
        } catch {
          showFeedback(t('menu.revoke_admin_fail'), 'error')
        }
      },
      visible: (item: ContextMenuItem) => {
        if (!isGroupManagementContext()) return false

        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 只能撤销管理员，不能撤销群主
        const targetRoleId = resolveTargetRoleId(item)
        if (targetRoleId !== RoleEnum.ADMIN) return false

        // 只有群主可以撤管理员
        return isCurrentUserLord()
      }
    }
  ])
  /** 举报选项 */
  const report = ref([
    {
      label: () => t('menu.remove_from_group'),
      icon: 'people-delete-one',
      click: async (item: ContextMenuItem) => {
        const targetUid = item.uid || item.fromUser.uid
        const roomId = globalStore.currentSessionRoomId
        if (!roomId) return

        try {
          await matrixRoomActionFacade.kickUser(roomId, targetUid)
          // 从群成员列表中移除该用户
          groupStore.removeUserItem(targetUid, roomId)
          showFeedback(t('menu.remove_from_group_success'), 'success')
        } catch {
          showFeedback(t('menu.remove_from_group_fail'), 'error')
        }
      },
      visible: (item: ContextMenuItem) => {
        if (!isGroupManagementContext()) return false

        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 群主不能被移出
        const targetRoleId = resolveTargetRoleId(item)
        if (targetRoleId === RoleEnum.LORD) return false

        // 当前用户是否群主或管理员
        const roleId = currentUserRoleId()
        const isLord = roleId === RoleEnum.LORD
        const isAdmin = roleId === RoleEnum.ADMIN

        // 管理员不能移出其他管理员
        if (isAdmin && targetRoleId === RoleEnum.ADMIN) return false

        return isLord || isAdmin
      }
    },
    {
      label: () => t('menu.report'),
      icon: 'caution',
      click: async (item: ContextMenuItem & { message?: { id: string; body?: { content?: string } } }) => {
        const roomId = globalStore.currentSessionRoomId
        const eventId = item.message?.id
        if (!roomId || !eventId) {
          showFeedback('无法获取消息信息', 'warning')
          return
        }
        useMitt.emit(MittEnum.OPEN_EVENT_REPORT, {
          roomId,
          eventId,
          eventContent: item.message?.body?.content || ''
        })
      }
    }
  ])

  return { optionsList, report }
}
