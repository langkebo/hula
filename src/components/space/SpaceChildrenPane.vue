<template>
  <div class="space-children-pane flex-1 min-h-0 flex flex-col">
    <!-- 空间横幅头部 -->
    <SpaceHeader
      v-if="activeSpaceItem"
      :space="activeSpaceItem"
      :can-manage="canManageSelectedSpace"
      @settings="handleSpaceSettings" />

    <!-- 子房间网格（快速概览） -->
    <section v-if="activeSpaceItem" class="space-children-pane__rooms" :aria-label="t('space.rooms')">
      <SpaceRoomGrid
        :rooms="spaceRooms"
        :loading="roomsLoading"
        @enter-room="handleEnterRoom"
        @preview-room="handleEnterRoom" />
    </section>

    <!-- 完整详情面板（保留既有全部能力） -->
    <SpaceDetailsPane
      class="flex-1 min-h-0"
      :active-space="activeSpaceItem"
      :members="spaceMembers"
      :rooms="spaceRooms"
      :members-loading="membersLoading"
      :rooms-loading="roomsLoading"
      :can-manage="canManageSelectedSpace"
      :is-member="isMember"
      :sub-view="subView"
      :joining-space="joiningSpace"
      :manage-mode="manageMode"
      :manage-submitting="manageSubmitting"
      :invite-user-id="inviteForm.userId"
      :add-room-id="addRoomForm.roomId"
      :add-room-suggested="addRoomForm.suggested"
      :saving-space-name="savingSpaceName"
      :saving-space-topic="savingSpaceTopic"
      :entering-chat="enteringChat"
      @enter-space="handleEnterChat"
      @enter-room="handleEnterRoom"
      @invite-member="openInviteSpaceMember"
      @add-room="openAddSpaceRoom"
      @join-space="handleJoinSpace"
      @save-space-name="handleSaveSpaceName"
      @save-space-topic="handleSaveSpaceTopic"
      @remove-room="handleRemoveSpaceRoom"
      @leave-space="handleLeaveSpace"
      @delete-space="handleDeleteSpace"
      @close-manage-pane="closeManagePane"
      @submit-manage-pane="submitManagePane"
      @update:sub-view="subView = $event"
      @update:invite-user-id="inviteForm.userId = $event"
      @update:add-room-id="addRoomForm.roomId = $event"
      @update:add-room-suggested="addRoomForm.suggested = $event" />
  </div>
</template>

<script lang="ts" setup name="SpaceChildrenPane">
import { useI18n } from 'vue-i18n'
import SpaceHeader from '@/components/space/SpaceHeader.vue'
import SpaceRoomGrid from '@/components/space/SpaceRoomGrid.vue'
import SpaceDetailsPane from '@/components/workbench/SpaceDetailsPane.vue'
import type { SpaceListItem } from '@/components/workbench/SpaceListPane.vue'
import { useEnterChat } from '@/composables/chat/useEnterChat'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSpace, useSpaceMembers, useSpaceRooms, useSpaces } from '@/composables/space'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { useRoomStore } from '@/stores/domains/chat/room'

type SpaceManageMode = 'invite' | 'add-room'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()
const { enterChat: enterChatFn, enterSpace } = useEnterChat()

// 当前空间 ID：从路由参数派生（路由为单一真相源）
const spaceId = computed(() => (route.params.spaceId as string) || '')

// 空间列表（用于查找当前空间的概览信息：avatar/name 等 SpaceInfo 中不存在的字段由列表项维护）
const { spaces, load: reloadSpaces } = useSpaces()

// 选中空间的详情、成员、子房间
const {
  space: selectedSpaceDetail,
  load: loadSelectedSpace,
  update: updateSelectedSpace
} = useSpace(() => spaceId.value)

const {
  members: spaceMembers,
  loading: membersLoading,
  load: loadSpaceMembers,
  invite: inviteSpaceMember,
  mutating: inviteMutating
} = useSpaceMembers(() => spaceId.value)

const {
  rooms: spaceRooms,
  loading: roomsLoading,
  load: loadSpaceRooms,
  addRoom: addRoomToSpace,
  mutating: addRoomMutating
} = useSpaceRooms(() => spaceId.value)

// 管理面板状态
const manageMode = ref<SpaceManageMode | null>(null)
const enteringChat = ref(false)
const joiningSpace = ref(false)
const savingSpaceName = ref(false)
const savingSpaceTopic = ref(false)
const inviteForm = reactive({ userId: '' })
const addRoomForm = reactive({ roomId: '', suggested: false })

// 子面板状态机：overview（默认概览） / members / rooms / hierarchy
const subView = ref<'overview' | 'members' | 'rooms' | 'hierarchy'>('overview')

// 当前用户是否为该空间成员（用于决定显示"进入空间"还是"加入空间"）
const isMember = computed(() => {
  if (!spaceId.value) return true
  return !!spaces.value.find((s) => s.spaceId === spaceId.value)
})

// 当前激活的空间对象（合并 SpaceInfo 与列表项信息，供 SpaceDetailsPane 展示）
const activeSpaceItem = computed<SpaceListItem | null>(() => {
  if (!spaceId.value) return null
  const found = spaces.value.find((s) => s.spaceId === spaceId.value)
  if (!found) return null
  return {
    spaceId: found.spaceId,
    name: found.name,
    childCount: found.childCount,
    avatarUrl: found.avatarUrl,
    topic: found.topic,
    memberCount: found.memberCount,
    isPinned: roomStore.hasTag(found.spaceId, 'm.favourite')
  }
})

const canManageSelectedSpace = computed(() => {
  if (!spaceId.value) return false
  return matrixClientService.canManageSpace(spaceId.value)
})

const manageSubmitting = computed(() => {
  switch (manageMode.value) {
    case 'invite':
      return inviteMutating.value
    case 'add-room':
      return addRoomMutating.value
    default:
      return false
  }
})

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
  try {
    await enterChatFn(roomId, 'room')
  } catch (err) {
    showFeedback(String(err), 'error')
  }
}

// 空间设置入口：回到概览子视图，展示完整管理面板
const handleSpaceSettings = () => {
  subView.value = 'overview'
}

// 离开空间（带确认弹窗）
const handleLeaveSpace = () => {
  if (!spaceId.value) return
  const spaceName = spaces.value.find((s) => s.spaceId === spaceId.value)?.name ?? spaceId.value
  window.$dialog?.create({
    title: t('space.leave_space'),
    content: t('space.leave_space_confirm', { name: spaceName }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await matrixSpaceService.leaveSpace(spaceId.value)
        await reloadSpaces()
        showFeedback(t('space.leave_space_success'), 'success')
        // 离开后返回空间列表
        if (window.history.length > 1) {
          void router.back()
        } else {
          void router.push('/space')
        }
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
  const spaceName = spaces.value.find((s) => s.spaceId === spaceId.value)?.name ?? spaceId.value
  window.$dialog?.create({
    title: t('space.delete_space'),
    content: t('space.delete_space_confirm', { name: spaceName }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await matrixSpaceService.deleteSpace(spaceId.value)
        await reloadSpaces()
        showFeedback(t('space.delete_space_success'), 'success')
        // 删除后返回空间列表
        if (window.history.length > 1) {
          void router.back()
        } else {
          void router.push('/space')
        }
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
        await matrixSpaceService.removeChild(spaceId.value!, roomId)
        await Promise.allSettled([reloadSpaces(), loadSpaceRooms()])
        showFeedback(t('space.remove_room_success'), 'success')
      } catch (err) {
        showFeedback(String(err) || t('space.remove_room_failed'), 'error')
      }
    }
  })
}

// 关闭管理面板
const closeManagePane = () => {
  manageMode.value = null
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

// 加入空间（非成员场景）
const handleJoinSpace = async () => {
  if (!spaceId.value) return
  joiningSpace.value = true
  try {
    await matrixSpaceService.joinSpace(spaceId.value)
    await reloadSpaces()
    await Promise.allSettled([loadSelectedSpace(), loadSpaceMembers(), loadSpaceRooms()])
    showFeedback(t('space.join_space_success'), 'success')
  } catch (err) {
    showFeedback(String(err) || t('space.join_space_failed'), 'error')
  } finally {
    joiningSpace.value = false
  }
}

// 路由参数变化时自动加载空间详情、成员、子房间
watch(
  spaceId,
  async (id) => {
    // 切换空间时重置子面板状态
    subView.value = 'overview'
    if (id) {
      await Promise.allSettled([loadSelectedSpace(), loadSpaceMembers(), loadSpaceRooms()])
    } else {
      closeManagePane()
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.space-children-pane__rooms {
  flex-shrink: 0;
  padding: var(--tjg-space-3) var(--tjg-space-4);
  border-bottom: 1px solid var(--tjg-border-default);
  background: var(--tjg-surface-panel);
  max-height: 280px;
  overflow: auto;
}
</style>
