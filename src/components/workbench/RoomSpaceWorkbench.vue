<template>
  <div
    class="room-space-workbench h-full flex flex-col"
    :class="{
      'room-space-workbench--compact': isCompactLayout,
      'room-space-workbench--narrow': isNarrowLayout,
      'room-space-workbench--detail-open': showDetailDrawer
    }">
    <RoomSpaceToolbar
      :compact="isCompactLayout"
      :batch-mode="batchMode"
      :search-keyword="searchKeyword"
      :session-type-filter="sessionTypeFilter"
      :session-engagement-filter="sessionEngagementFilter"
      :session-sort="sessionSort"
      :filtered-count="sessionList.length"
      :total-count="totalCount"
      :has-saved-preset="hasSavedPreset"
      :can-save-preset="canSavePreset"
      :saved-preset-applied="savedPresetApplied"
      @update:search-keyword="emit('update:searchKeyword', $event)"
      @update:session-type-filter="emit('update:sessionTypeFilter', $event)"
      @update:session-engagement-filter="emit('update:sessionEngagementFilter', $event)"
      @update:session-sort="emit('update:sessionSort', $event)"
      @toggle-batch-mode="toggleBatchMode"
      @save-preset="emit('savePreset')"
      @apply-saved-preset="emit('applySavedPreset')"
      @create-space="emit('createSpace')" />

    <div class="room-space-workbench__shell min-h-0 flex flex-1">
      <aside class="room-space-workbench__space-nav min-h-0 flex flex-col">
        <SpaceListPane
          :compact="isCompactLayout"
          :narrow="isNarrowLayout"
          :spaces="spaces"
          :selected-space-id="selectedSpaceId"
          :highlighted-space-id="highlightedSpaceId"
          :loading="spaceLoading"
          :total-count="totalCount"
          @select-space="emit('update:selectedSpaceId', $event)" />

        <section
          v-if="selectedSpaceId"
          class="room-space-workbench__tree-panel min-h-0 border-r border-t border-[--hula-border-default] bg-[--hula-surface-panel]">
          <header
            class="room-space-workbench__tree-header px-12px py-10px text-12px font-600 text-[--hula-text-tertiary]">
            {{ t('space.space_tree_label') }}
          </header>
          <div class="room-space-workbench__tree-body min-h-0 flex-1 overflow-hidden px-6px pb-6px">
            <HulaSpaceTree
              :space-id="selectedSpaceId"
              :selected-space-id="selectedSpaceId"
              :loader="spaceTreeLoader"
              @select="handleTreeSelect" />
          </div>
        </section>
      </aside>

      <div class="room-space-workbench__content min-w-0 flex flex-1 flex-col">
        <RoomSpaceActionBar
          v-if="activeSpace"
          :compact="isCompactLayout"
          :breadcrumb-items="spaceBreadcrumbItems"
          :space-name="activeSpace.name"
          :room-count="activeSpace.childCount"
          :session-count="sessionList.length"
          :can-manage-space="canManageActiveSpace"
          @select-breadcrumb="emit('update:selectedSpaceId', $event)"
          @invite="emit('inviteSpaceMember')"
          @add-room="emit('addSpaceRoom')"
          @settings="emit('openSpaceSettings')" />

        <RoomBatchActionBar
          :visible="batchMode"
          :selected-count="batchSelectedIds.size"
          :total-count="sessionList.length"
          @toggle-all="toggleAllBatchSelections"
          @mark-read="handleBatchMarkRead"
          @pin="handleBatchPin"
          @mute="handleBatchMute"
          @leave="handleBatchLeave"
          @close="closeBatchMode" />

        <div
          class="room-space-workbench__session-layout min-h-0 flex flex-1"
          :class="{ 'room-space-workbench__session-layout--narrow': isNarrowLayout }">
          <div class="min-w-0 flex-1">
            <div v-if="isNarrowLayout && hasDetailContext" class="workbench-detail-toggle-row">
              <button
                type="button"
                class="workbench-detail-toggle"
                :aria-expanded="showDetailDrawer"
                data-test="workbench-detail-toggle"
                @click="toggleDetailDrawer">
                {{ showDetailDrawer ? t('common.close') : t('space.details_title') }}
              </button>
            </div>
            <RoomSessionList
              ref="sessionListRef"
              :session-list="sessionList"
              :sync-loading="syncLoading"
              :session-loading="sessionLoading"
              :network-banner="networkBanner"
              :empty-description="emptyDescription"
              :get-item-classes="getItemClasses"
              :visible-menu="visibleMenu"
              :visible-special-menu="visibleSpecialMenu"
              :on-msg-click="onMsgClick"
              :on-msg-dblclick="onMsgDblclick"
              :on-menu-show="onMenuShow"
              :on-retry-network="onRetryNetwork"
              :batch-mode="batchMode"
              :batch-selected-ids="batchSelectedIds"
              @batch-toggle="toggleBatchSelection" />
          </div>

          <WorkbenchDetailPane
            :compact="isCompactLayout"
            :narrow="isNarrowLayout"
            :drawer-mode="isNarrowLayout"
            :drawer-visible="showDetailDrawer"
            :selected-session="selectedSession"
            :active-space="activeSpace"
            :visible-session-count="sessionList.length"
            :total-session-count="totalCount"
            :manage-mode="manageMode"
            :can-manage-space="canManageActiveSpace"
            :manage-submitting="manageSubmitting"
            :invite-user-id="inviteUserId"
            :add-room-id="addRoomId"
            :add-room-suggested="addRoomSuggested"
            :settings-name="settingsName"
            :settings-topic="settingsTopic"
            :overlay-mode="overlayMode"
            :forward-event-id="forwardEventId"
            :forward-room-id="forwardRoomId"
            :history-room-id="historyRoomId"
            :merged-msg-ids="mergedMsgIds"
            @close-manage-pane="emit('closeManagePane')"
            @submit-manage-pane="emit('submitManagePane')"
            @update:invite-user-id="emit('update:inviteUserId', $event)"
            @update:add-room-id="emit('update:addRoomId', $event)"
            @update:add-room-suggested="emit('update:addRoomSuggested', $event)"
            @update:settings-name="emit('update:settingsName', $event)"
            @update:settings-topic="emit('update:settingsTopic', $event)"
            @close-drawer="closeDetailDrawer"
            @close-overlay="emit('closeOverlay')"
            @overlay-created="emit('overlayCreated', $event)"
            @overlay-forwarded="emit('overlayForwarded', $event)"
            @overlay-message-selected="
              (roomId: string, eventId: string) => emit('overlayMessageSelected', roomId, eventId)
            "
            @overlay-room-selected="emit('overlayRoomSelected', $event)"
            @overlay-user-selected="emit('overlayUserSelected', $event)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAriaLive } from '@/composables/common/useAriaLive'
import { useViewport } from '@/hooks/useViewport'
import {
  WORKBENCH_SESSION_ENGAGEMENT_FILTERS,
  WORKBENCH_SESSION_TYPE_FILTERS,
  type WorkbenchSessionEngagementFilter,
  type WorkbenchSessionSort,
  type WorkbenchSessionTypeFilter
} from '@/router/spaceNavigation'
import type { SpaceInfo } from '@/services/matrix/room/MatrixSpaceService'
import type { SessionItem } from '@/stores/domains/chat/chat'
import HulaSpaceTree from './HulaSpaceTree.vue'
import RoomBatchActionBar from './RoomBatchActionBar.vue'
import type RoomSessionList from './RoomSessionList.vue'
import RoomSpaceActionBar from './RoomSpaceActionBar.vue'
import RoomSpaceToolbar from './RoomSpaceToolbar.vue'
import SpaceListPane from './SpaceListPane.vue'
import WorkbenchDetailPane from './WorkbenchDetailPane.vue'

type SpaceListItem = {
  spaceId: string
  name: string
  childCount: number
}

type SessionListItem = SessionItem & {
  lastMsg?: string
  lastMsgTime?: string
  isAtMe?: boolean
}

type SpaceManageMode = 'invite' | 'add-room' | 'settings'
type OverlayMode = 'create-room' | 'create-space' | 'forward' | 'search' | 'history' | 'merged-msg'
type WorkbenchLayoutMode = 'wide' | 'compact' | 'narrow'

const props = withDefaults(
  defineProps<{
    sessionList: SessionListItem[]
    totalCount: number
    spaces: SpaceListItem[]
    spaceLoading: boolean
    selectedSpaceId: string
    highlightedSpaceId?: string
    searchKeyword: string
    sessionTypeFilter: WorkbenchSessionTypeFilter
    sessionEngagementFilter?: WorkbenchSessionEngagementFilter
    sessionSort: WorkbenchSessionSort
    hasSavedPreset?: boolean
    canSavePreset?: boolean
    savedPresetApplied?: boolean
    layoutModeOverride?: WorkbenchLayoutMode
    spaceBreadcrumbItems?: Array<{ spaceId: string; name: string }>
    activeSpace: SpaceListItem | null
    canManageActiveSpace: boolean
    selectedSession: SessionListItem | null
    syncLoading: boolean
    sessionLoading: boolean
    networkBanner: { text: string; retryable?: boolean } | null
    manageMode?: SpaceManageMode | null
    manageSubmitting?: boolean
    inviteUserId?: string
    addRoomId?: string
    addRoomSuggested?: boolean
    settingsName?: string
    settingsTopic?: string
    overlayMode?: OverlayMode | null
    forwardEventId?: string
    forwardRoomId?: string
    historyRoomId?: string
    mergedMsgIds?: string[]
    spaceTreeLoader?: (options: {
      spaceId: string
      from?: string
      limit?: number
      maxDepth?: number
      suggestedOnly?: boolean
    }) => Promise<{ rooms: SpaceInfo[]; next_batch?: string }>
    getItemClasses: (item: SessionItem) => Record<string, boolean>
    visibleMenu: (item: SessionItem) => OPT.RightMenu[]
    visibleSpecialMenu: (item: SessionItem) => OPT.RightMenu[]
    onMsgClick: (item: SessionItem) => void | Promise<void>
    onMsgDblclick: (item: SessionItem) => void
    onMenuShow: (roomId: string, isShow: boolean) => void
    onRetryNetwork?: () => void | Promise<void>
  }>(),
  {
    sessionEngagementFilter: WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all
  }
)

const emit = defineEmits<{
  'update:searchKeyword': [value: string]
  'update:sessionTypeFilter': [value: WorkbenchSessionTypeFilter]
  'update:sessionEngagementFilter': [value: WorkbenchSessionEngagementFilter]
  'update:sessionSort': [value: WorkbenchSessionSort]
  'update:selectedSpaceId': [value: string]
  createSpace: []
  savePreset: []
  applySavedPreset: []
  inviteSpaceMember: []
  addSpaceRoom: []
  openSpaceSettings: []
  batchMarkRead: [roomIds: string[]]
  batchPin: [roomIds: string[]]
  batchMute: [roomIds: string[]]
  batchLeave: [roomIds: string[]]
  closeManagePane: []
  submitManagePane: []
  'update:inviteUserId': [value: string]
  'update:addRoomId': [value: string]
  'update:addRoomSuggested': [value: boolean]
  'update:settingsName': [value: string]
  'update:settingsTopic': [value: string]
  closeOverlay: []
  overlayCreated: [data: { roomId?: string; space?: unknown }]
  overlayForwarded: [roomIds: string[]]
  overlayMessageSelected: [roomId: string, eventId: string]
  overlayRoomSelected: [roomId: string]
  overlayUserSelected: [userId: string]
}>()

const sessionListRef = ref<InstanceType<typeof RoomSessionList> | null>(null)
const batchMode = ref(false)
const batchSelectedIds = ref<Set<string>>(new Set())
const detailDrawerOpen = ref(false)
const { t } = useI18n()
const { announce } = useAriaLive()
const { vw } = useViewport()

const layoutMode = computed<WorkbenchLayoutMode>(() => {
  if (props.layoutModeOverride) {
    return props.layoutModeOverride
  }
  if (vw.value < 1200) {
    return 'narrow'
  }
  if (vw.value < 1400) {
    return 'compact'
  }
  return 'wide'
})
const isCompactLayout = computed(() => layoutMode.value === 'compact' || layoutMode.value === 'narrow')
const isNarrowLayout = computed(() => layoutMode.value === 'narrow')
const showDetailDrawer = computed(() => isNarrowLayout.value && detailDrawerOpen.value)
const hasDetailContext = computed(
  () =>
    Boolean(props.selectedSession) ||
    Boolean(props.activeSpace) ||
    Boolean(props.manageMode) ||
    Boolean(props.overlayMode)
)

const emptyDescription = computed(() => {
  if (
    props.selectedSpaceId ||
    props.searchKeyword.trim() ||
    props.sessionTypeFilter !== WORKBENCH_SESSION_TYPE_FILTERS.all ||
    props.sessionEngagementFilter !== WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all
  ) {
    return t('space.empty_filtered_sessions')
  }

  return t('space.empty_sessions')
})

const scrollToSessionIndex = async (index: number) => {
  await sessionListRef.value?.scrollToIndex(index)
}

const resetBatchSelection = () => {
  batchSelectedIds.value = new Set()
}

const closeBatchMode = () => {
  batchMode.value = false
  resetBatchSelection()
  announce(t('room.batch.exit_announcement'), 'polite')
}

const openDetailDrawer = () => {
  if (!isNarrowLayout.value || !hasDetailContext.value) {
    return
  }
  detailDrawerOpen.value = true
}

const closeDetailDrawer = () => {
  detailDrawerOpen.value = false
}

const toggleDetailDrawer = () => {
  if (showDetailDrawer.value) {
    closeDetailDrawer()
    return
  }
  openDetailDrawer()
}

const toggleBatchMode = () => {
  if (batchMode.value) {
    closeBatchMode()
    return
  }

  batchMode.value = true
  resetBatchSelection()
  announce(t('room.batch.enter_announcement'), 'polite')
}

const toggleBatchSelection = (roomId: string) => {
  const nextSelectedIds = new Set(batchSelectedIds.value)
  if (nextSelectedIds.has(roomId)) {
    nextSelectedIds.delete(roomId)
  } else {
    nextSelectedIds.add(roomId)
  }
  batchSelectedIds.value = nextSelectedIds
}

const toggleAllBatchSelections = () => {
  if (batchSelectedIds.value.size === props.sessionList.length) {
    resetBatchSelection()
    announce(t('room.batch.clear_selection_announcement'), 'polite')
    return
  }

  batchSelectedIds.value = new Set(props.sessionList.map((session) => session.roomId))
  announce(t('room.batch.select_all_announcement', { count: props.sessionList.length }), 'polite')
}

const emitBatchAction = (eventName: 'batchMarkRead' | 'batchPin' | 'batchMute' | 'batchLeave') => {
  const roomIds = [...batchSelectedIds.value]
  if (roomIds.length === 0) {
    return
  }

  switch (eventName) {
    case 'batchMarkRead':
      emit('batchMarkRead', roomIds)
      break
    case 'batchPin':
      emit('batchPin', roomIds)
      break
    case 'batchMute':
      emit('batchMute', roomIds)
      break
    case 'batchLeave':
      emit('batchLeave', roomIds)
      break
  }
  closeBatchMode()
}

const handleBatchMarkRead = () => emitBatchAction('batchMarkRead')
const handleBatchPin = () => emitBatchAction('batchPin')
const handleBatchMute = () => emitBatchAction('batchMute')
const handleBatchLeave = () => emitBatchAction('batchLeave')
const handleTreeSelect = (space: SpaceInfo) => {
  emit('update:selectedSpaceId', space.spaceId)
}

watch(
  () => props.sessionList.map((session) => session.roomId),
  (roomIds) => {
    if (!batchMode.value) {
      return
    }

    const allowedRoomIds = new Set(roomIds)
    batchSelectedIds.value = new Set([...batchSelectedIds.value].filter((roomId) => allowedRoomIds.has(roomId)))
  }
)

watch(isNarrowLayout, (narrow) => {
  if (!narrow) {
    closeDetailDrawer()
  }
})

watch(
  () => [props.manageMode, props.overlayMode] as const,
  ([manageMode, overlayMode]) => {
    if (!isNarrowLayout.value) {
      return
    }
    if (manageMode || overlayMode) {
      openDetailDrawer()
    }
  },
  { immediate: true }
)

defineExpose({
  scrollToSessionIndex
})
</script>

<style scoped lang="scss">
.room-space-workbench {
  background: var(--hula-surface-panel);
}

.room-space-workbench__shell,
.room-space-workbench__content,
.room-space-workbench__session-layout,
.room-space-workbench__space-nav,
.room-space-workbench__tree-panel,
.room-space-workbench__tree-body {
  min-width: 0;
}

.room-space-workbench__space-nav {
  width: 220px;
  min-width: 220px;
}

.room-space-workbench--compact .room-space-workbench__space-nav {
  width: 188px;
  min-width: 188px;
}

.room-space-workbench--narrow .room-space-workbench__space-nav {
  width: 132px;
  min-width: 132px;
}

.room-space-workbench__tree-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.room-space-workbench__tree-header {
  border-bottom: 1px solid var(--hula-border-default);
}

.room-space-workbench__session-layout--narrow {
  position: relative;
}

.workbench-detail-toggle-row {
  padding: 8px 12px 0;
}

.workbench-detail-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--hula-border-default);
  border-radius: var(--hula-radius-full);
  background: var(--hula-surface-panel);
  color: var(--hula-text-secondary);
  font-size: 12px;
  line-height: 1.4;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;
}

.workbench-detail-toggle:hover {
  border-color: var(--hula-color-primary-300);
  color: var(--hula-text-primary);
}
</style>
