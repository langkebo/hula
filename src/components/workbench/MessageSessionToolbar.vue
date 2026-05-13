<template>
  <RoomSpaceToolbar
    root-test-id="message-session-toolbar"
    test-id-prefix="message-session"
    :search-keyword="searchKeyword"
    :session-type-filter="sessionTypeFilter"
    :session-engagement-filter="sessionEngagementFilter"
    :session-sort="sessionSort"
    :filtered-count="filteredCount"
    :total-count="totalCount"
    :show-create-action="showCreateAction"
    :show-join-action="showJoinAction"
    :create-button-text="createButtonText"
    @update:search-keyword="emit('update:searchKeyword', $event)"
    @update:session-type-filter="emit('update:sessionTypeFilter', $event)"
    @update:session-engagement-filter="emit('update:sessionEngagementFilter', $event)"
    @update:session-sort="emit('update:sessionSort', $event)"
    @create-space="emit('createRoom')"
    @join-room="emit('joinRoom')" />
</template>

<script setup lang="ts">
import {
  WORKBENCH_SESSION_ENGAGEMENT_FILTERS,
  type WorkbenchSessionEngagementFilter,
  type WorkbenchSessionSort,
  type WorkbenchSessionTypeFilter
} from '@/router/spaceNavigation'
import RoomSpaceToolbar from './RoomSpaceToolbar.vue'

withDefaults(
  defineProps<{
    searchKeyword: string
    sessionTypeFilter: WorkbenchSessionTypeFilter
    sessionEngagementFilter?: WorkbenchSessionEngagementFilter
    sessionSort: WorkbenchSessionSort
    filteredCount: number
    totalCount: number
    showCreateAction?: boolean
    showJoinAction?: boolean
    createButtonText?: string
  }>(),
  {
    sessionEngagementFilter: WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all,
    showCreateAction: false,
    showJoinAction: false
  }
)

const emit = defineEmits<{
  'update:searchKeyword': [value: string]
  'update:sessionTypeFilter': [value: WorkbenchSessionTypeFilter]
  'update:sessionEngagementFilter': [value: WorkbenchSessionEngagementFilter]
  'update:sessionSort': [value: WorkbenchSessionSort]
  createRoom: []
  joinRoom: []
}>()
</script>
