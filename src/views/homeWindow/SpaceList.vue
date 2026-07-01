<template>
  <div class="space-list-page h-full flex flex-col">
    <RoomSpaceWorkbench
      ref="workbenchRef"
      :session-list="filteredSessionList"
      :total-count="sessionList.length"
      :spaces="spaces"
      :space-loading="spaceLoading"
      :selected-space-id="selectedSpaceId"
      :highlighted-space-id="activeTopLevelSpaceId"
      :search-keyword="searchKeyword"
      :session-type-filter="sessionTypeFilter"
      :session-engagement-filter="sessionEngagementFilter"
      :session-sort="sessionSort"
      :has-saved-preset="hasSavedPreset"
      :can-save-preset="canSavePreset"
      :saved-preset-applied="savedPresetApplied"
      :active-space="activeSpace"
      :space-breadcrumb-items="spaceBreadcrumbItems"
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
      :overlay-mode="overlayState.mode"
      :forward-event-id="overlayState.forwardEventId"
      :forward-room-id="overlayState.forwardRoomId"
      :history-room-id="overlayState.historyRoomId"
      :merged-msg-ids="overlayState.mergedMsgIds"
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
      @update:session-engagement-filter="setSessionEngagementFilter"
      @update:session-sort="setSessionSort"
      @save-preset="saveCurrentPreset"
      @apply-saved-preset="applySavedPreset"
      @update:invite-user-id="inviteForm.userId = $event"
      @update:add-room-id="addRoomForm.roomId = $event"
      @update:add-room-suggested="addRoomForm.suggested = $event"
      @update:settings-name="settingsForm.name = $event"
      @update:settings-topic="settingsForm.topic = $event"
      @create-space="openCreateSpace"
      @discover-spaces="discoveryVisible = true"
      @invite-space-member="openInviteSpaceMember"
      @add-space-room="openAddSpaceRoom"
      @open-space-settings="openSpaceSettings"
      @select-space-breadcrumb="setSelectedSpaceId"
      @close-manage-pane="closeManagePane"
      @submit-manage-pane="submitManagePane"
      @close-overlay="closeOverlay"
      @overlay-created="handleOverlayCreated"
      @overlay-forwarded="handleOverlayForwarded"
      @overlay-message-selected="handleOverlayMessageSelected"
      @overlay-room-selected="handleOverlayRoomSelected"
      @overlay-user-selected="handleOverlayUserSelected"
      @batch-mark-read="handleBatchMarkRead"
      @batch-pin="handleBatchPin"
      @batch-mute="handleBatchMute"
      @batch-leave="handleBatchLeave" />

    <SpaceDiscovery
      :visible="discoveryVisible"
      @update:visible="discoveryVisible = $event"
      @joined="handleDiscoveryJoined" />
  </div>
</template>
<script lang="ts" setup name="spaceList">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useI18n } from 'vue-i18n'
import SpaceDiscovery from '@/components/space/SpaceDiscovery.vue'
import type RoomSpaceWorkbench from '@/components/workbench/RoomSpaceWorkbench.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAriaLive } from '@/composables/common/useAriaLive'
import { useSpace, useSpaceMembers, useSpaceRooms } from '@/composables/space'
import { useRoomSpaceWorkbench } from '@/composables/workbench/useRoomSpaceWorkbench'
import { useSessionListState } from '@/composables/workbench/useSessionListState'
import { useSessionPageSync } from '@/composables/workbench/useSessionPageSync'
import { MittEnum, NotificationTypeEnum, RoomTypeEnum } from '@/enums'
import { openMsgSession } from '@/hooks/session/openMsgSession'
import { useMessage } from '@/hooks/useMessage.ts'
import { useMitt } from '@/hooks/useMitt'
import { useTauriListener } from '@/hooks/useTauriListener'
import { buildCreateSpaceRoute, SPACE_ROUTE_NAMES } from '@/router/spaceNavigation'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixReceiptService } from '@/services/matrix/messaging/MatrixReceiptService'
import { matrixRoomNotificationService } from '@/services/matrix/notifications/MatrixRoomNotificationService'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { matrixRoomSummaryService } from '@/services/matrix/room/MatrixRoomSummaryService'
import { useRoomStore } from '@/stores/domains/chat/room'
import type { SpaceOptions } from '@/types/matrix-services'

type SpaceManageMode = 'invite' | 'add-room' | 'settings'
type OverlayMode = 'create-room' | 'create-space' | 'forward' | 'search' | 'history' | 'merged-msg'
type SavedWorkbenchPreset = {
  search: string
  type: string
  engagement: string
  sort: string
}

const WORKBENCH_SAVED_PRESET_STORAGE_KEY = 'hula-workbench-saved-preset'

const { t } = useI18n()
const { announce } = useAriaLive()
const { showFeedback } = useActionFeedback()
const router = useRouter()
const roomStore = useRoomStore()
const appWindow = WebviewWindow.getCurrent()
const { addListener } = useTauriListener()
const { handleMsgClick, handleMsgDelete, handleMsgDblclick, visibleMenu, visibleSpecialMenu } = useMessage()
const {
  chatStore,
  globalStore,
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
  sessionEngagementFilter,
  sessionSort,
  filteredSessionList,
  setSelectedSpaceId,
  setSearchKeyword,
  setSessionTypeFilter,
  setSessionEngagementFilter,
  setSessionSort,
  ensureRoomVisible,
  reloadSpaces,
  reloadActiveSpaceRooms
} = useRoomSpaceWorkbench(sessionList)

const normalizeSavedPreset = (value: unknown): SavedWorkbenchPreset | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<SavedWorkbenchPreset>
  if (
    typeof candidate.search !== 'string' ||
    typeof candidate.type !== 'string' ||
    typeof candidate.engagement !== 'string' ||
    typeof candidate.sort !== 'string'
  ) {
    return null
  }

  return {
    search: candidate.search,
    type: candidate.type,
    engagement: candidate.engagement,
    sort: candidate.sort
  }
}

const readSavedPreset = (): SavedWorkbenchPreset | null => {
  try {
    return normalizeSavedPreset(JSON.parse(localStorage.getItem(WORKBENCH_SAVED_PRESET_STORAGE_KEY) || 'null'))
  } catch {
    return null
  }
}

const writeSavedPreset = (preset: SavedWorkbenchPreset) => {
  localStorage.setItem(WORKBENCH_SAVED_PRESET_STORAGE_KEY, JSON.stringify(preset))
}

const workbenchRef = ref<InstanceType<typeof RoomSpaceWorkbench> | null>(null)
const manageMode = ref<SpaceManageMode | null>(null)
const discoveryVisible = ref(false)
const savedPreset = ref<SavedWorkbenchPreset | null>(readSavedPreset())
const inviteForm = reactive({ userId: '' })
const addRoomForm = reactive({ roomId: '', suggested: false })
const settingsForm = reactive({ name: '', topic: '' })
const overlayState = reactive<{
  mode: OverlayMode | null
  forwardEventId: string
  forwardRoomId: string
  historyRoomId: string
  mergedMsgIds: string[]
}>({
  mode: null,
  forwardEventId: '',
  forwardRoomId: '',
  historyRoomId: '',
  mergedMsgIds: []
})
const {
  space: selectedSpaceDetail,
  load: loadSelectedSpace,
  update: updateSelectedSpace,
  mutating: settingsMutating,
  getTreePath: getSelectedSpaceTreePath
} = useSpace(() => selectedSpaceId.value)
const { invite: inviteSpaceMember, mutating: inviteMutating } = useSpaceMembers(() => selectedSpaceId.value)
const { addRoom: addRoomToSpace, mutating: addRoomMutating } = useSpaceRooms(() => selectedSpaceId.value)

const canManageSelectedSpace = computed(() => {
  const spaceId = selectedSpaceId.value
  return matrixClientService.canManageSpace(spaceId)
})

const spaceBreadcrumbItems = ref<Array<{ spaceId: string; name: string }>>([])
const activeTopLevelSpaceId = computed(() => {
  if (!selectedSpaceId.value) return ''
  // 如果当前选中的就在顶级列表中，直接返回
  if (spaces.value.some((s) => s.spaceId === selectedSpaceId.value)) {
    return selectedSpaceId.value
  }
  // 否则从面包屑路径中取第一个
  return spaceBreadcrumbItems.value[0]?.spaceId ?? ''
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
const currentPreset = computed<SavedWorkbenchPreset>(() => ({
  search: searchKeyword.value.trim(),
  type: sessionTypeFilter.value,
  engagement: sessionEngagementFilter.value,
  sort: sessionSort.value
}))
const hasCustomFilters = computed(
  () =>
    Boolean(currentPreset.value.search) ||
    currentPreset.value.type !== 'all' ||
    currentPreset.value.engagement !== 'all' ||
    currentPreset.value.sort !== 'recent'
)
const hasSavedPreset = computed(() => Boolean(savedPreset.value))
const savedPresetApplied = computed(() => {
  if (!savedPreset.value) {
    return false
  }

  return JSON.stringify(savedPreset.value) === JSON.stringify(currentPreset.value)
})
const canSavePreset = computed(() => hasCustomFilters.value && !savedPresetApplied.value)

const loadSpaceBreadcrumbItems = async () => {
  const spaceId = selectedSpaceId.value
  if (!spaceId) {
    spaceBreadcrumbItems.value = []
    return
  }

  const path = await getSelectedSpaceTreePath()
  const fallbackName = activeSpace.value?.name ?? selectedSpaceDetail.value?.name ?? ''
  const normalizedPath = path.length
    ? path
    : [
        {
          spaceId,
          name: fallbackName
        }
      ]

  const dedupedPath = normalizedPath.filter(
    (item, index, items) => items.findIndex((candidate) => candidate.spaceId === item.spaceId) === index
  )

  if (dedupedPath.at(-1)?.spaceId !== spaceId) {
    dedupedPath.push({
      spaceId,
      name: fallbackName
    })
  }

  spaceBreadcrumbItems.value = dedupedPath.map((item) => ({
    spaceId: item.spaceId,
    name: item.name || (item.spaceId === spaceId ? fallbackName : item.spaceId)
  }))
}

const openCreateSpace = () => {
  void router.push(buildCreateSpaceRoute())
}

const handleDiscoveryJoined = async (_spaceId: string) => {
  await reloadSpaces()
}

const saveCurrentPreset = () => {
  const nextPreset = {
    ...currentPreset.value
  }
  savedPreset.value = nextPreset
  writeSavedPreset(nextPreset)
  showFeedback(t('space.saved_preset_saved'), 'success')
}

const applySavedPreset = () => {
  if (!savedPreset.value) {
    return
  }

  setSearchKeyword(savedPreset.value.search)
  setSessionTypeFilter(savedPreset.value.type as typeof sessionTypeFilter.value)
  setSessionEngagementFilter(savedPreset.value.engagement as typeof sessionEngagementFilter.value)
  setSessionSort(savedPreset.value.sort as typeof sessionSort.value)
  showFeedback(t('space.saved_preset_applied'), 'success')
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

  await Promise.allSettled([reloadSpaces(), reloadActiveSpaceRooms()])
  showFeedback(t('space.add_room_success'), 'success')
  closeManagePane()
}

const submitSpaceSettings = async () => {
  const nextName = settingsForm.name.trim()
  if (!nextName) {
    showFeedback(t('space.name_required'), 'warning')
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
    showFeedback(t('space.settings_failed'), 'error')
    return
  }

  await reloadSpaces()
  showFeedback(t('space.settings_success'), 'success')
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

const closeOverlay = () => {
  overlayState.mode = null
  overlayState.forwardEventId = ''
  overlayState.forwardRoomId = ''
  overlayState.historyRoomId = ''
  overlayState.mergedMsgIds = []
}

const handleOverlayCreated = async (data: { roomId?: string; space?: unknown }) => {
  if (data.roomId) {
    await reloadActiveSpaceRooms()
  }
  if (data.space) {
    await reloadSpaces()
  }
  closeOverlay()
}

const handleOverlayForwarded = (_roomIds: string[]) => {
  closeOverlay()
}

const handleOverlayMessageSelected = (roomId: string, _eventId: string) => {
  ensureRoomVisible(roomId)
  closeOverlay()
}

const handleOverlayRoomSelected = (roomId: string) => {
  ensureRoomVisible(roomId)
  closeOverlay()
}

const handleOverlayUserSelected = (_userId: string) => {
  closeOverlay()
}

const showBatchResult = (successCount: number, failCount: number) => {
  const feedback = t('setting.notice.message_group_batch_update_result', {
    success_count: successCount,
    fail_count: failCount
  })

  if (successCount > 0 && failCount === 0) {
    showFeedback(feedback, 'success')
    return
  }

  if (successCount > 0) {
    showFeedback(feedback, 'warning')
    return
  }

  showFeedback(feedback, 'error')
}

const runBatchAction = async (
  roomIds: string[],
  action: (session: (typeof filteredSessionList.value)[number]) => Promise<void>
) => {
  if (!roomIds.length) {
    return
  }

  const sessionMap = new Map(filteredSessionList.value.map((session) => [session.roomId, session] as const))
  const results = await Promise.allSettled(
    roomIds.map(async (roomId) => {
      const session = sessionMap.get(roomId)
      if (!session) {
        throw new Error(`Session not found: ${roomId}`)
      }
      await action(session)
    })
  )

  const successCount = results.filter((result) => result.status === 'fulfilled').length
  const failCount = results.length - successCount
  showBatchResult(successCount, failCount)
}

const handleBatchMarkRead = async (roomIds: string[]) => {
  await runBatchAction(roomIds, async (session) => {
    await matrixReceiptService.markRoomAsRead(session.roomId)
    await matrixRoomSummaryService.clearUnreadSummary(session.roomId).catch(() => undefined)
    chatStore.updateSession(session.roomId, {
      unreadCount: 0
    })
  })
  chatStore.updateTotalUnreadCount()
}

const handleBatchPin = async (roomIds: string[]) => {
  await runBatchAction(roomIds, async (session) => {
    if (roomStore.hasTag(session.roomId, 'm.favourite')) {
      return
    }
    await roomStore.addRoomTag(session.roomId, 'm.favourite')
  })
}

const handleBatchMute = async (roomIds: string[]) => {
  await runBatchAction(roomIds, async (session) => {
    await matrixRoomNotificationService.setRoomNotification(session.roomId, NotificationTypeEnum.NOT_DISTURB)
    chatStore.updateSession(session.roomId, {
      muteNotification: NotificationTypeEnum.NOT_DISTURB
    })
  })
  chatStore.updateTotalUnreadCount()
}

const handleBatchLeave = async (roomIds: string[]) => {
  await runBatchAction(roomIds, async (session) => {
    if (session.type === RoomTypeEnum.SINGLE) {
      throw new Error(`Direct message is not supported for batch leave: ${session.roomId}`)
    }
    await matrixRoomActionFacade.leaveRoom(session.roomId)
    await handleMsgDelete(session.roomId)
  })
}

watch(selectedSpaceId, (spaceId) => {
  if (spaceId) {
    const spaceName = spaces.value.find((s) => s.spaceId === spaceId)?.name || activeSpace.value?.name || spaceId
    announce(t('space.space_selected', { name: spaceName }), 'polite')
    return
  }
  closeManagePane()
})

watch(
  [selectedSpaceId, activeSpace],
  async () => {
    await loadSpaceBreadcrumbItems()
  },
  { immediate: true }
)

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
