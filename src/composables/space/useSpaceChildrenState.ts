import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { SpaceListItem } from '@/components/workbench/SpaceListPane.vue'
import { useSpace, useSpaceMembers, useSpaceRooms, useSpaces } from '@/composables/space'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { useRoomStore } from '@/stores/domains/chat/room'

type SpaceManageMode = 'invite' | 'add-room'
type SpacePaneSubview = 'overview' | 'members' | 'rooms' | 'hierarchy'

/**
 * SpaceChildrenPane 的状态层：路由派生的空间 ID、空间 / 成员 / 子房间数据源、
 * 管理面板与子面板状态，以及模板直接消费的派生值。
 *
 * 仅从组件内平移，行为与原实现一致；操作逻辑见 useSpaceChildrenActions。
 */
export const useSpaceChildrenState = () => {
  const route = useRoute()
  const roomStore = useRoomStore()

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
    removeRoom: removeRoomFromSpace,
    toggleSuggested: toggleSuggestedInSpace,
    refreshError,
    mutating: addRoomMutating
  } = useSpaceRooms(() => spaceId.value)

  /** 刷新失败后重试：成功后 refreshError 由 load 自动清空 */
  const retryRooms = () => void loadSpaceRooms()

  // 管理面板状态
  const manageMode = ref<SpaceManageMode | null>(null)
  const enteringChat = ref(false)
  const joiningSpace = ref(false)
  const savingSpaceName = ref(false)
  const savingSpaceTopic = ref(false)
  const inviteForm = reactive({ userId: '' })
  const addRoomForm = reactive({ roomId: '', suggested: false })

  // 子面板状态机：overview（默认概览） / members / rooms / hierarchy
  const subView = ref<SpacePaneSubview>('overview')

  // 关闭管理面板
  const closeManagePane = () => {
    manageMode.value = null
  }

  // 当前空间展示名：列表项优先，缺省回落 spaceId（用于确认弹窗文案）
  const spaceName = computed(() => spaces.value.find((s) => s.spaceId === spaceId.value)?.name ?? spaceId.value)

  // 当前用户是否为该空间成员（用于决定显示"进入空间"还是"加入空间"）
  const isMember = computed(() => {
    if (!spaceId.value) return true
    return !!spaces.value.find((s) => s.spaceId === spaceId.value)
  })

  // 当前激活的空间对象（合并 SpaceInfo 与列表项信息，供 SpaceDetailsPane 展示）
  // 关键：计数（memberCount / childCount）与 name/topic 优先采用 useSpace 的 getSpace 结果
  // （已修复为基于已加载房间/服务端 stats 计算），而不是 spaces 列表项——列表项的计数常为 0/0，
  // 这正是"空间详情不展示"的根因：详情面板拿到的 memberCount/childCount 始终是 0。
  const activeSpaceItem = computed<SpaceListItem | null>(() => {
    if (!spaceId.value) return null
    const found = spaces.value.find((s) => s.spaceId === spaceId.value)
    const detail = selectedSpaceDetail.value
    if (detail) {
      return {
        spaceId: detail.spaceId,
        name: detail.name || found?.name || '',
        childCount: detail.childCount ?? found?.childCount ?? 0,
        avatarUrl: detail.avatarUrl || found?.avatarUrl,
        topic: detail.topic || found?.topic,
        memberCount: detail.memberCount ?? found?.memberCount ?? 0,
        isPinned: found ? roomStore.hasTag(found.spaceId, 'm.favourite') : false
      }
    }
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

  return {
    spaceId,
    spaces,
    spaceName,
    reloadSpaces,
    selectedSpaceDetail,
    loadSelectedSpace,
    updateSelectedSpace,
    spaceMembers,
    membersLoading,
    loadSpaceMembers,
    inviteSpaceMember,
    spaceRooms,
    roomsLoading,
    loadSpaceRooms,
    addRoomToSpace,
    removeRoomFromSpace,
    toggleSuggestedInSpace,
    refreshError,
    retryRooms,
    manageMode,
    enteringChat,
    joiningSpace,
    savingSpaceName,
    savingSpaceTopic,
    inviteForm,
    addRoomForm,
    subView,
    closeManagePane,
    isMember,
    activeSpaceItem,
    canManageSelectedSpace,
    manageSubmitting
  }
}

export type SpaceChildrenState = ReturnType<typeof useSpaceChildrenState>
