import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useEnterChat } from '@/composables/chat/useEnterChat'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAriaLive } from '@/composables/common/useAriaLive'
import type { SpaceInfo } from '@/composables/space'
import { buildSpaceRoute } from '@/router/spaceNavigation'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { createLogger } from '@/utils/Logger'
import type { SpaceChildrenState } from './useSpaceChildrenState'

const logger = createLogger('SpaceChildrenPane')

/**
 * SpaceChildrenPane 的操作层：进入/跳转、管理面板提交、离开 / 删除空间、移除子房间等。
 *
 * 状态来自 useSpaceChildrenState（同一份实例），本函数只负责动作与反馈，不持有额外数据源。
 */
export const useSpaceChildrenActions = (state: SpaceChildrenState) => {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const { announce } = useAriaLive()
  const router = useRouter()
  const { enterChat: enterChatFn, enterSpace } = useEnterChat()

  const {
    spaceId,
    spaces,
    spaceName,
    selectedSpaceDetail,
    activeSpaceItem,
    canManageSelectedSpace,
    updateSelectedSpace,
    reloadSpaces,
    loadSelectedSpace,
    loadSpaceMembers,
    loadSpaceRooms,
    inviteSpaceMember,
    addRoomToSpace,
    removeRoomFromSpace,
    toggleSuggestedInSpace,
    manageMode,
    inviteForm,
    addRoomForm,
    subView,
    closeManagePane,
    enteringChat,
    joiningSpace,
    savingSpaceName,
    savingSpaceTopic
  } = state

  // 离开 / 删除后返回空间列表（有历史则回退，否则回列表页）
  const exitToList = () => {
    if (window.history.length > 1) {
      void router.back()
    } else {
      void router.push('/space')
    }
  }

  // 进入聊天（进入空间默认聊天室）
  const handleEnterChat = async () => {
    if (!spaceId.value) return
    enteringChat.value = true
    try {
      await enterSpace(spaceId.value)
    } catch (err) {
      showFeedback(String(err) || t('space.load_failed'), 'error')
    } finally {
      enteringChat.value = false
    }
  }

  // 进入指定子房间
  const handleEnterRoom = async (roomId: string) => {
    // 子房间 room_id 为空时（如 m.space.child 状态事件缺 state_key）直接拦截，
    // 避免把空 targetId 传入 useEnterChat 触发告警与无效跳转。
    if (!roomId) {
      showFeedback(t('space.load_failed'), 'warning')
      return
    }
    try {
      await enterChatFn(roomId, 'room')
    } catch (err) {
      showFeedback(String(err), 'error')
    }
  }

  // 选择层级树里的空间：与 SpaceList.vue 的 handleSelectSpace 同行为（a11y 播报 + 路由跳转），
  // 但 SpaceDetailsPane 的 selectSpace 事件携带的是 SpaceInfo，需取 spaceId。
  const handleSelectSpace = (space: SpaceInfo) => {
    if (!space?.spaceId) return
    const selectedName = space.name || spaces.value.find((s) => s.spaceId === space.spaceId)?.name || space.spaceId
    announce(t('space.space_selected', { name: selectedName }), 'polite')
    void router.push(buildSpaceRoute(space.spaceId))
  }

  // 点击成员：与 GroupDetails.vue 的 handleMemberClick 同行为，跳转好友详情
  const handleMemberClick = (userId: string) => {
    if (!userId) return
    void router.push({ path: `/friend/${encodeURIComponent(userId)}` }).catch((err) => {
      logger.warn('Failed to navigate to member detail:', err)
    })
  }

  // 切换子房间建议标记（星标）
  const handleToggleSuggested = async (roomId: string, currentSuggested: boolean) => {
    try {
      const ok = await toggleSuggestedInSpace(roomId, currentSuggested)
      if (ok) {
        showFeedback(
          currentSuggested ? t('space.unmark_suggested_success') : t('space.mark_suggested_success'),
          'success'
        )
      } else {
        showFeedback(t('space.toggle_suggested_failed'), 'error')
      }
    } catch (err) {
      showFeedback(String(err) || t('space.toggle_suggested_failed'), 'error')
    }
  }

  // 空间设置入口：回到概览子视图，展示完整管理面板
  const handleSpaceSettings = () => {
    subView.value = 'overview'
  }

  // 离开空间（带确认弹窗）
  const handleLeaveSpace = () => {
    if (!spaceId.value) return
    window.$dialog?.create({
      title: t('space.leave_space'),
      content: t('space.leave_space_confirm', { name: spaceName.value }),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
      onPositiveClick: async () => {
        try {
          await matrixSpaceService.leaveSpace(spaceId.value)
          await reloadSpaces()
          showFeedback(t('space.leave_space_success'), 'success')
          exitToList()
        } catch (err) {
          showFeedback(String(err) || t('space.leave_space_failed'), 'error')
        }
      }
    })
  }

  // 删除空间（带确认弹窗，仅创建者可删除）
  const handleDeleteSpace = () => {
    if (!spaceId.value) return
    if (!matrixClientService.canManageSpace(spaceId.value)) {
      showFeedback(t('space.delete_space_failed'), 'error')
      return
    }
    window.$dialog?.create({
      title: t('space.delete_space'),
      content: t('space.delete_space_confirm', { name: spaceName.value }),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
      onPositiveClick: async () => {
        try {
          await matrixSpaceService.deleteSpace(spaceId.value)
          await reloadSpaces()
          showFeedback(t('space.delete_space_success'), 'success')
          exitToList()
        } catch (err) {
          showFeedback(String(err), 'error')
        }
      }
    })
  }

  // 打开邀请成员面板
  const openInviteSpaceMember = () => {
    if (!spaceId.value || !canManageSelectedSpace.value) return
    inviteForm.userId = ''
    manageMode.value = 'invite'
  }

  // 打开添加子房间面板
  const openAddSpaceRoom = () => {
    if (!spaceId.value || !canManageSelectedSpace.value) return
    addRoomForm.roomId = ''
    addRoomForm.suggested = false
    manageMode.value = 'add-room'
  }

  // 内联编辑：保存空间名称
  const handleSaveSpaceName = async (newName: string) => {
    if (!spaceId.value || !newName) return
    const currentName = selectedSpaceDetail.value?.name ?? activeSpaceItem.value?.name ?? ''
    if (newName === currentName) return

    savingSpaceName.value = true
    try {
      const ok = await updateSelectedSpace({ name: newName })
      if (ok) {
        showFeedback(t('space.name_saved'), 'success')
      } else {
        showFeedback(t('space.name_error'), 'error')
      }
    } catch {
      showFeedback(t('space.name_error'), 'error')
    } finally {
      savingSpaceName.value = false
    }
  }

  // 内联编辑：保存空间简介
  const handleSaveSpaceTopic = async (newTopic: string) => {
    if (!spaceId.value) return
    const currentTopic = selectedSpaceDetail.value?.topic ?? ''
    if (newTopic === currentTopic) return

    savingSpaceTopic.value = true
    try {
      const ok = await updateSelectedSpace({ topic: newTopic })
      if (ok) {
        showFeedback(t('space.topic_saved'), 'success')
      } else {
        showFeedback(t('space.topic_error'), 'error')
      }
    } catch {
      showFeedback(t('space.topic_error'), 'error')
    } finally {
      savingSpaceTopic.value = false
    }
  }

  // 移除子房间（带确认弹窗）
  const handleRemoveSpaceRoom = (roomId: string) => {
    if (!spaceId.value || !roomId) return
    window.$dialog?.warning({
      title: t('space.remove_room'),
      content: t('space.remove_room_confirm'),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
      onPositiveClick: async () => {
        try {
          // 走 composable 的 removeRoom：刷新失败只置 refreshError（局部提示），
          // 不会把已生效的移除判为失败。
          const ok = await removeRoomFromSpace(roomId)
          await reloadSpaces()
          if (!ok) {
            showFeedback(t('space.remove_room_failed'), 'error')
            return
          }
          showFeedback(t('space.remove_room_success'), 'success')
        } catch (err) {
          showFeedback(String(err) || t('space.remove_room_failed'), 'error')
        }
      }
    })
  }

  // 提交邀请成员
  const submitInviteSpaceMember = async () => {
    const userId = inviteForm.userId.trim()
    if (!userId) {
      showFeedback(t('space.invite_user_required'), 'warning')
      return
    }

    const ok = await inviteSpaceMember(userId)
    if (!ok) {
      showFeedback(t('space.invite_failed'), 'error')
      return
    }

    showFeedback(t('space.invite_success'), 'success')
    closeManagePane()
  }

  // 提交添加子房间
  const submitAddSpaceRoom = async () => {
    const roomId = addRoomForm.roomId.trim()
    if (!roomId) {
      showFeedback(t('space.add_room_required'), 'warning')
      return
    }

    const ok = await addRoomToSpace(roomId, { suggested: addRoomForm.suggested })
    if (!ok) {
      showFeedback(t('space.add_room_failed'), 'error')
      return
    }

    await Promise.allSettled([reloadSpaces(), loadSpaceRooms()])
    showFeedback(t('space.add_room_success'), 'success')
    closeManagePane()
  }

  // 提交管理面板（统一入口）
  const submitManagePane = async () => {
    switch (manageMode.value) {
      case 'invite':
        await submitInviteSpaceMember()
        return
      case 'add-room':
        await submitAddSpaceRoom()
        return
      default:
        return
    }
  }

  // 加入 / 申请加入成功后刷新空间状态（实际请求由 SpaceDetailsPane 内的 TjgSpaceJoinCta 发起）
  const handleJoinSpace = async () => {
    if (!spaceId.value) return
    joiningSpace.value = true
    try {
      await reloadSpaces()
      await Promise.allSettled([loadSelectedSpace(), loadSpaceMembers(), loadSpaceRooms()])
    } catch (err) {
      showFeedback(String(err) || t('space.join_space_failed'), 'error')
    } finally {
      joiningSpace.value = false
    }
  }

  return {
    handleEnterChat,
    handleEnterRoom,
    handleSelectSpace,
    handleMemberClick,
    handleToggleSuggested,
    handleSpaceSettings,
    handleLeaveSpace,
    handleDeleteSpace,
    openInviteSpaceMember,
    openAddSpaceRoom,
    handleSaveSpaceName,
    handleSaveSpaceTopic,
    handleRemoveSpaceRoom,
    submitInviteSpaceMember,
    submitAddSpaceRoom,
    submitManagePane,
    handleJoinSpace
  }
}
