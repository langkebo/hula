<template>
  <div
    class="room-space-workbench h-full flex flex-col"
    :class="{
      'room-space-workbench--compact': isCompactLayout,
      'room-space-workbench--narrow': isNarrowLayout
    }">
    <RoomSpaceToolbar
      :compact="isCompactLayout"
      :search-keyword="searchKeyword"
      :session-type-filter="sessionTypeFilter"
      :session-engagement-filter="sessionEngagementFilter"
      :session-sort="sessionSort"
      :filtered-count="sessionList.length"
      :total-count="totalCount"
      @update:search-keyword="emit('update:searchKeyword', $event)"
      @update:session-type-filter="emit('update:sessionTypeFilter', $event)"
      @update:session-engagement-filter="emit('update:sessionEngagementFilter', $event)"
      @update:session-sort="emit('update:sessionSort', $event)"
      @create-space="emit('createSpace')" />

    <div class="min-h-0 flex flex-1">
      <SpaceListPane
        :compact="isCompactLayout"
        :narrow="isNarrowLayout"
        :spaces="spaces"
        :selected-space-id="selectedSpaceId"
        :loading="spaceLoading"
        :total-count="totalCount"
        @select-space="emit('update:selectedSpaceId', $event)" />

      <div class="min-w-0 flex flex-1 flex-col">
        <RoomSpaceActionBar
          v-if="activeSpace"
          :compact="isCompactLayout"
          :space-name="activeSpace.name"
          :room-count="activeSpace.childCount"
          :session-count="sessionList.length"
          :can-manage-space="canManageActiveSpace"
          @invite="emit('inviteSpaceMember')"
          @add-room="emit('addSpaceRoom')"
          @settings="emit('openSpaceSettings')" />

        <div class="min-h-0 flex flex-1">
          <div class="min-w-0 flex-1">
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
              :on-retry-network="onRetryNetwork" />
          </div>

          <WorkbenchDetailPane
            :compact="isCompactLayout"
            :narrow="isNarrowLayout"
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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useViewport } from '@/hooks/useViewport'
import {
  WORKBENCH_SESSION_ENGAGEMENT_FILTERS,
  WORKBENCH_SESSION_TYPE_FILTERS,
  type WorkbenchSessionEngagementFilter,
  type WorkbenchSessionSort,
  type WorkbenchSessionTypeFilter
} from '@/router/spaceNavigation'
import type { SessionItem } from '@/stores/domains/chat/chat'
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

const props = withDefaults(
  defineProps<{
    sessionList: SessionListItem[]
    totalCount: number
    spaces: SpaceListItem[]
    spaceLoading: boolean
    selectedSpaceId: string
    searchKeyword: string
    sessionTypeFilter: WorkbenchSessionTypeFilter
    sessionEngagementFilter?: WorkbenchSessionEngagementFilter
    sessionSort: WorkbenchSessionSort
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
  inviteSpaceMember: []
  addSpaceRoom: []
  openSpaceSettings: []
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
const { t } = useI18n()
const { vw } = useViewport()

const isCompactLayout = computed(() => vw.value < 1400)
const isNarrowLayout = computed(() => vw.value < 1200)

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

defineExpose({
  scrollToSessionIndex
})
</script>

<style scoped lang="scss">
.room-space-workbench {
  background: var(--hula-surface-panel);
}
</style>
