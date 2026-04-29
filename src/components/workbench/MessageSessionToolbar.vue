<template>
  <RoomSpaceToolbar
    root-test-id="message-session-toolbar"
    test-id-prefix="message-session"
    :search-keyword="searchKeyword"
    :session-type-filter="sessionTypeFilter"
    :session-sort="sessionSort"
    :filtered-count="filteredCount"
    :total-count="totalCount"
    :show-create-action="false"
    @update:search-keyword="emit('update:searchKeyword', $event)"
    @update:session-type-filter="emit('update:sessionTypeFilter', $event)"
    @update:session-sort="emit('update:sessionSort', $event)" />
</template>

<script setup lang="ts">
import type { WorkbenchSessionSort, WorkbenchSessionTypeFilter } from '@/router/spaceNavigation'
import RoomSpaceToolbar from './RoomSpaceToolbar.vue'

const props = defineProps<{
  searchKeyword: string
  sessionTypeFilter: WorkbenchSessionTypeFilter
  sessionSort: WorkbenchSessionSort
  filteredCount: number
  totalCount: number
}>()

const emit = defineEmits<{
  'update:searchKeyword': [value: string]
  'update:sessionTypeFilter': [value: WorkbenchSessionTypeFilter]
  'update:sessionSort': [value: WorkbenchSessionSort]
}>()
</script>
