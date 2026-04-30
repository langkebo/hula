<template>
  <RoomSpaceWorkbench
    ref="workbenchRef"
    :session-list="filteredSessionList"
    :total-count="sessionList.length"
    :spaces="spaces"
    :space-loading="spaceLoading"
    :selected-space-id="selectedSpaceId"
    :search-keyword="searchKeyword"
    :session-type-filter="sessionTypeFilter"
    :session-sort="sessionSort"
    :active-space="activeSpace"
    :can-manage-active-space="canManageSelectedSpace"
    :selected-session="selectedSession"
    :sync-loading="syncLoading"
    :session-loading="chatStore.sessionOptions.isLoading"
    :network-banner="networkBanner"
    :manage-mode="manageMode"
    :manage-submitting="manageSubmitting"
    :invite-user-id="inviteForm.userId"
    :add-room-id="addRoomForm.roomId"
    :add-room-suggested="addRoomForm.suggested"
    :settings-name="settingsForm.name"
    :settings-topic="settingsForm.topic"
    :on-retry-network="retrySessions"
    :get-item-classes="getItemClasses"
    :visible-menu="visibleMenu"
    :visible-special-menu="visibleSpecialMenu"
    :on-msg-click="handleMsgClick"
    :on-msg-dblclick="handleMsgDblclick"
    :on-menu-show="handleMenuShow"
    @update:selected-space-id="setSelectedSpaceId"
    @update:search-keyword="setSearchKeyword"
    @update:session-type-filter="setSessionTypeFilter"
    @update:session-sort="setSessionSort"
    @update:invite-user-id="inviteForm.userId = $event"
    @update:add-room-id="addRoomForm.roomId = $event"
    @update:add-room-suggested="addRoomForm.suggested = $event"
    @update:settings-name="settingsForm.name = $event"
    @update:settings-topic="settingsForm.topic = $event"
    @create-space="openCreateSpace"
    @invite-space-member="openInviteSpaceMember"
    @add-space-room="openAddSpaceRoom"
    @open-space-settings="openSpaceSettings"
    @close-manage-pane="closeManagePane"
    @submit-manage-pane="submitManagePane" />
</template>
<script lang="ts" setup name="spaceList">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useMessage as useNaiveMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type RoomSpaceWorkbench from '@/components/workbench/RoomSpaceWorkbench.vue'
import { useSpace, useSpaceMembers, useSpaceRooms } from '@/composables/space'
import { canManageSpaceByPowerLevel } from '@/composables/workbench/spacePermissions'
import { useRoomSpaceWorkbench } from '@/composables/workbench/useRoomSpaceWorkbench'
import { useSessionListState } from '@/composables/workbench/useSessionListState'
import { useSessionPageSync } from '@/composables/workbench/useSessionPageSync'
import { MittEnum, RoomTypeEnum } from '@/enums'
import { openMsgSession } from '@/hooks/session/openMsgSession'
import { useMessage } from '@/hooks/useMessage.ts'
import { useMitt } from '@/hooks/useMitt'
import { useTauriListener } from '@/hooks/useTauriListener'
import { buildCreateSpaceRoute, SPACE_ROUTE_NAMES } from '@/router/spaceNavigation'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import type { SpaceOptions } from '@/services/matrix/room/MatrixSpaceService'

type SpaceManageMode = 'invite' | 'add-room' | 'settings'

const { t } = useI18n()
const message = useNaiveMessage()
const router = useRouter()
const appWindow = WebviewWindow.getCurrent()
const { addListener } = useTauriListener()
const { handleMsgClick, handleMsgDelete, handleMsgDblclick, visibleMenu, visibleSpecialMenu } = useMessage()
const {
  chatStore,
  globalStore,
  groupStore,
  syncLoading,
  networkBanner,
  retrySessions,
  sessionList,
  selectedSession,
  handleMenuShow,
  getItemClasses,
  invalidateSessionCache
} = useSessionListState()

const {
  spaces,
  spaceLoading,
  selectedSpaceId,
  activeSpace,
  searchKeyword,
  sessionTypeFilter,
  sessionSort,
  filteredSessionList,
  setSelectedSpaceId,
  setSearchKeyword,
  setSessionTypeFilter,
  setSessionSort,
  ensureRoomVisible,
  reloadSpaces,
  reloadActiveSpaceRooms
} = useRoomSpaceWorkbench(sessionList)

const workbenchRef = ref<InstanceType<typeof RoomSpaceWorkbench> | null>(null)
const manageMode = ref<SpaceManageMode | null>(null)
const inviteForm = reactive({ userId: '' })
const addRoomForm = reactive({ roomId: '', suggested: false })
const settingsForm = reactive({ name: '', topic: '' })
const {
  space: selectedSpaceDetail,
  load: loadSelectedSpace,
  update: updateSelectedSpace,
  mutating: settingsMutating
} = useSpace(() => selectedSpaceId.value)
const { invite: inviteSpaceMember, mutating: inviteMutating } = useSpaceMembers(() => selectedSpaceId.value)
const { addRoom: addRoomToSpace, mutating: addRoomMutating } = useSpaceRooms(() => selectedSpaceId.value)

const canManageSelectedSpace = computed(() => {
  const spaceId = selectedSpaceId.value
  return canManageSpaceByPowerLevel(matrixClientService.getClient(), spaceId)
})
const manageSubmitting = computed(() => {
  switch (manageMode.value) {
    case 'invite':
      return inviteMutating.value
    case 'add-room':
      return addRoomMutating.value
    case 'settings':
      return settingsMutating.value
    default:
      return false
  }
})

const openCreateSpace = () => {
  void router.push(buildCreateSpaceRoute())
}

const openInviteSpaceMember = () => {
  if (!selectedSpaceId.value || !canManageSelectedSpace.value) return
  inviteForm.userId = ''
  manageMode.value = 'invite'
}

const openAddSpaceRoom = () => {
  if (!selectedSpaceId.value || !canManageSelectedSpace.value) return
  addRoomForm.roomId = ''
  addRoomForm.suggested = false
  manageMode.value = 'add-room'
}

const openSpaceSettings = async () => {
  if (!selectedSpaceId.value || !canManageSelectedSpace.value) return
  await loadSelectedSpace()
  settingsForm.name = selectedSpaceDetail.value?.name ?? activeSpace.value?.name ?? ''
  settingsForm.topic = selectedSpaceDetail.value?.topic ?? ''
  manageMode.value = 'settings'
}

const closeManagePane = () => {
  manageMode.value = null
}

const submitInviteSpaceMember = async () => {
  const userId = inviteForm.userId.trim()
  if (!userId) {
    message.warning(t('space.invite_user_required'))
    return
  }

  const ok = await inviteSpaceMember(userId)
  if (!ok) {
    message.error(t('space.invite_failed'))
    return
  }

  message.success(t('space.invite_success'))
  closeManagePane()
}

const submitAddSpaceRoom = async () => {
  const roomId = addRoomForm.roomId.trim()
  if (!roomId) {
    message.warning(t('space.add_room_required'))
    return
  }

  const ok = await addRoomToSpace(roomId, { suggested: addRoomForm.suggested })
  if (!ok) {
    message.error(t('space.add_room_failed'))
    return
  }

  await Promise.all([reloadSpaces(), reloadActiveSpaceRooms()])
  message.success(t('space.add_room_success'))
  closeManagePane()
}

const submitSpaceSettings = async () => {
  const nextName = settingsForm.name.trim()
  if (!nextName) {
    message.warning(t('space.name_required'))
    return
  }

  const currentName = selectedSpaceDetail.value?.name ?? activeSpace.value?.name ?? ''
  const currentTopic = selectedSpaceDetail.value?.topic ?? ''
  const payload: Partial<SpaceOptions> = {}

  if (nextName !== currentName) {
    payload.name = nextName
  }
  if (settingsForm.topic !== currentTopic) {
    payload.topic = settingsForm.topic
  }

  if (!Object.keys(payload).length) {
    closeManagePane()
    return
  }

  const ok = await updateSelectedSpace(payload)
  if (!ok) {
    message.error(t('space.settings_failed'))
    return
  }

  await reloadSpaces()
  message.success(t('space.settings_success'))
  closeManagePane()
}

const submitManagePane = async () => {
  switch (manageMode.value) {
    case 'invite':
      await submitInviteSpaceMember()
      return
    case 'add-room':
      await submitAddSpaceRoom()
      return
    case 'settings':
      await submitSpaceSettings()
      return
    default:
      return
  }
}

watch(selectedSpaceId, (spaceId) => {
  if (spaceId) return
  closeManagePane()
})
useSessionPageSync({
  activeRouteName: SPACE_ROUTE_NAMES.workbench,
  handleMsgClick,
  beforeHandleSession: ensureRoomVisible
})

onBeforeMount(async () => {
  useMitt.emit(MittEnum.LOCATE_SESSION, { roomId: globalStore.currentSessionRoomId })
})

onMounted(async () => {
  if (appWindow.label === 'home') {
    await addListener(
      appWindow.listen('search_to_msg', (event: { payload: { uid: string; roomType: number } }) => {
        openMsgSession(event.payload.uid, event.payload.roomType)
      }),
      'search_to_msg'
    )
  }
  useMitt.on(MittEnum.UPDATE_SESSION_LAST_MSG, (payload?: { roomId?: string }) => {
    invalidateSessionCache(payload?.roomId)
  })
  useMitt.on(MittEnum.DELETE_SESSION, async (roomId: string) => {
    await handleMsgDelete(roomId)
  })
  useMitt.on(MittEnum.LOCATE_SESSION, async (e: { roomId: string }) => {
    ensureRoomVisible(e.roomId)
    const index = filteredSessionList.value.findIndex((item) => item.roomId === e.roomId)
    if (index !== -1) {
      await workbenchRef.value?.scrollToSessionIndex(index)
    }
  })
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/message';

#image-no-data {
  @apply size-full mt-60px text-[--hula-text-primary] text-14px;
}
</style>
