<template>
  <div
    class="room-space-toolbar px-12px py-10px"
    :class="{ 'room-space-toolbar--compact': props.compact }"
    :data-test="props.rootTestId">
    <n-flex vertical :size="10">
      <n-flex align="center" justify="space-between" :size="8" wrap>
        <n-input
          :value="searchKeyword"
          clearable
          size="small"
          class="toolbar-search flex-1 min-w-0 bg-[--hula-surface-search] border-none"
          :placeholder="t('space.search_sessions_placeholder')"
          :aria-label="t('space.search_sessions_placeholder')"
          @update:value="emit('update:searchKeyword', $event)">
          <template #prefix>
            <svg class="size-14px color-[--hula-text-tertiary]">
              <use href="#search"></use>
            </svg>
          </template>
        </n-input>

        <n-popover placement="bottom-end" trigger="click" style="border-radius: 12px; padding: 16px; width: 280px">
          <template #trigger>
            <n-button size="small" quaternary circle>
              <template #icon>
                <n-badge :dot="hasActiveFilters" type="info">
                  <svg class="size-16px color-[--hula-text-secondary]">
                    <use href="#filter"></use>
                  </svg>
                </n-badge>
              </template>
            </n-button>
          </template>

          <n-flex vertical :size="16">
            <!-- Type Filter -->
            <n-flex vertical :size="8">
              <span class="text-[var(--text-xs)] color-[--hula-text-tertiary] font-medium">
                {{ t('space.filter_label') }}
              </span>
              <div class="toolbar-chip-group" role="tablist">
                <button
                  v-for="option in sessionTypeOptions"
                  :key="option.value"
                  type="button"
                  class="toolbar-chip"
                  :class="{ 'toolbar-chip--active': sessionTypeFilter === option.value }"
                  role="tab"
                  :aria-selected="sessionTypeFilter === option.value"
                  :tabindex="sessionTypeFilter === option.value ? 0 : -1"
                  @click="emit('update:sessionTypeFilter', option.value)">
                  {{ option.label }}
                </button>
              </div>
            </n-flex>

            <!-- Engagement Filter -->
            <n-flex vertical :size="8">
              <span class="text-[var(--text-xs)] color-[--hula-text-tertiary] font-medium">
                {{ t('space.engagement_label') }}
              </span>
              <div class="toolbar-chip-group" role="tablist">
                <button
                  v-for="option in sessionEngagementOptions"
                  :key="option.value"
                  type="button"
                  class="toolbar-chip"
                  :class="{ 'toolbar-chip--active': sessionEngagementFilter === option.value }"
                  role="tab"
                  :aria-selected="sessionEngagementFilter === option.value"
                  :tabindex="sessionEngagementFilter === option.value ? 0 : -1"
                  @click="emit('update:sessionEngagementFilter', option.value)">
                  {{ option.label }}
                </button>
              </div>
            </n-flex>

            <!-- Sort Options -->
            <n-flex vertical :size="8">
              <span class="text-[var(--text-xs)] color-[--hula-text-tertiary] font-medium">
                {{ t('space.sort_label') }}
              </span>
              <div class="toolbar-chip-group" role="tablist">
                <button
                  v-for="option in sortOptions"
                  :key="option.value"
                  type="button"
                  class="toolbar-chip"
                  :class="{ 'toolbar-chip--active': sessionSort === option.value }"
                  role="tab"
                  :aria-selected="sessionSort === option.value"
                  :tabindex="sessionSort === option.value ? 0 : -1"
                  @click="emit('update:sessionSort', option.value)">
                  {{ option.label }}
                </button>
              </div>
            </n-flex>

            <n-divider style="margin: 0" />

            <!-- Presets & Clear -->
            <n-flex align="center" justify="space-between" :size="8">
              <button
                type="button"
                class="text-[var(--text-xs)] color-[--hula-text-tertiary] hover:color-[--hula-text-primary] cursor-pointer"
                @click="clearAllFilters">
                {{ t('space.clear_all_filters') }}
              </button>

              <n-flex :size="8">
                <button v-if="canSavePreset" type="button" class="toolbar-preset-button" @click="emit('savePreset')">
                  {{ t('space.save_preset') }}
                </button>
                <button
                  v-if="hasSavedPreset && !savedPresetApplied"
                  type="button"
                  class="toolbar-preset-button toolbar-preset-button--primary"
                  @click="emit('applySavedPreset')">
                  {{ t('space.apply_saved_preset') }}
                </button>
              </n-flex>
            </n-flex>
          </n-flex>
        </n-popover>

        <n-dropdown :options="moreOptions" @select="handleMoreSelect" trigger="click" placement="bottom-end">
          <n-button size="small" quaternary circle>
            <template #icon>
              <svg class="size-16px color-[--hula-text-secondary]">
                <use href="#more"></use>
              </svg>
            </template>
          </n-button>
        </n-dropdown>
      </n-flex>

      <!-- Active Filters Tag (only when active) -->
      <n-flex v-if="hasActiveFilters" align="center" :size="6" class="toolbar-filter-summary">
        <n-tag
          v-if="isNonDefaultTypeFilter"
          size="tiny"
          closable
          round
          :bordered="false"
          class="toolbar-filter-tag"
          @close="emit('update:sessionTypeFilter', WORKBENCH_SESSION_TYPE_FILTERS.all)">
          {{ activeTypeLabel }}
        </n-tag>
        <n-tag
          v-if="isNonDefaultEngagementFilter"
          size="tiny"
          closable
          round
          :bordered="false"
          class="toolbar-filter-tag"
          @close="emit('update:sessionEngagementFilter', WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all)">
          {{ activeEngagementLabel }}
        </n-tag>
        <n-tag
          v-if="isNonDefaultSort"
          size="tiny"
          closable
          round
          :bordered="false"
          class="toolbar-filter-tag"
          @close="emit('update:sessionSort', WORKBENCH_SESSION_SORTS.recent)">
          {{ activeSortLabel }}
        </n-tag>
      </n-flex>
    </n-flex>
    <n-divider style="margin: 10px -12px -10px -12px; width: calc(100% + 24px)" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  WORKBENCH_SESSION_ENGAGEMENT_FILTERS,
  WORKBENCH_SESSION_SORTS,
  WORKBENCH_SESSION_TYPE_FILTERS,
  type WorkbenchSessionEngagementFilter,
  type WorkbenchSessionSort,
  type WorkbenchSessionTypeFilter
} from '@/router/spaceNavigation'

const props = withDefaults(
  defineProps<{
    searchKeyword: string
    sessionTypeFilter: WorkbenchSessionTypeFilter
    sessionEngagementFilter?: WorkbenchSessionEngagementFilter
    sessionSort: WorkbenchSessionSort
    filteredCount: number
    totalCount: number
    compact?: boolean
    batchMode?: boolean
    showCreateAction?: boolean
    showJoinAction?: boolean
    createButtonText?: string
    rootTestId?: string
    testIdPrefix?: string
    hasSavedPreset?: boolean
    canSavePreset?: boolean
    savedPresetApplied?: boolean
  }>(),
  {
    compact: false,
    batchMode: false,
    showCreateAction: true,
    showJoinAction: false,
    sessionEngagementFilter: WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all,
    testIdPrefix: 'session',
    hasSavedPreset: false,
    canSavePreset: false,
    savedPresetApplied: false
  }
)

const emit = defineEmits<{
  'update:searchKeyword': [value: string]
  'update:sessionTypeFilter': [value: WorkbenchSessionTypeFilter]
  'update:sessionEngagementFilter': [value: WorkbenchSessionEngagementFilter]
  'update:sessionSort': [value: WorkbenchSessionSort]
  toggleBatchMode: []
  createSpace: []
  joinRoom: []
  savePreset: []
  applySavedPreset: []
  discoverSpaces: []
}>()

const { t } = useI18n()
const showCreateAction = computed(() => props.showCreateAction)
const showJoinAction = computed(() => props.showJoinAction)
const testIdPrefix = computed(() => props.testIdPrefix)
const createButtonText = computed(() => props.createButtonText || t('space.create'))

const moreOptions = computed(() => {
  const options = []

  options.push({
    label: props.batchMode ? t('room.batch.exit') : t('room.batch.enter'),
    key: 'batch'
  })

  if (showCreateAction.value) {
    options.push({
      label: createButtonText.value,
      key: 'create'
    })
  }

  if (showJoinAction.value) {
    options.push({
      label: t('room.join'),
      key: 'join'
    })
  }

  options.push({
    label: t('space.discovery.title'),
    key: 'discover'
  })

  options.push({
    type: 'divider',
    key: 'd1'
  })

  options.push({
    label: `${props.filteredCount}/${props.totalCount} ${t('space.session_list_label')}`,
    key: 'count',
    disabled: true
  })

  return options
})

const handleMoreSelect = (key: string) => {
  switch (key) {
    case 'batch':
      emit('toggleBatchMode')
      break
    case 'create':
      emit('createSpace')
      break
    case 'join':
      emit('joinRoom')
      break
    case 'discover':
      emit('discoverSpaces')
      break
  }
}

const sessionTypeOptions = computed(() => [
  { value: WORKBENCH_SESSION_TYPE_FILTERS.all, label: t('space.filter_all') },
  { value: WORKBENCH_SESSION_TYPE_FILTERS.group, label: t('space.filter_group') },
  { value: WORKBENCH_SESSION_TYPE_FILTERS.single, label: t('space.filter_single') }
])

const sessionEngagementOptions = computed(() => [
  { value: WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all, label: t('space.engagement_all') },
  { value: WORKBENCH_SESSION_ENGAGEMENT_FILTERS.unread, label: t('space.engagement_unread') },
  { value: WORKBENCH_SESSION_ENGAGEMENT_FILTERS.mention, label: t('space.engagement_mention') },
  { value: WORKBENCH_SESSION_ENGAGEMENT_FILTERS.invite, label: t('space.engagement_invite') }
])

const sortOptions = computed(() => [
  { value: WORKBENCH_SESSION_SORTS.recent, label: t('space.sort_recent') },
  { value: WORKBENCH_SESSION_SORTS.name, label: t('space.sort_name') }
])

const sortSummary = computed(() =>
  props.sessionSort === WORKBENCH_SESSION_SORTS.name ? t('space.sort_summary_name') : t('space.sort_summary_recent')
)

const hasSearchKeyword = computed(() => props.searchKeyword.trim().length > 0)
const isNonDefaultTypeFilter = computed(() => props.sessionTypeFilter !== WORKBENCH_SESSION_TYPE_FILTERS.all)
const isNonDefaultEngagementFilter = computed(
  () => props.sessionEngagementFilter !== WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all
)
const isNonDefaultSort = computed(() => props.sessionSort !== WORKBENCH_SESSION_SORTS.recent)
const hasActiveFilters = computed(
  () =>
    hasSearchKeyword.value ||
    isNonDefaultTypeFilter.value ||
    isNonDefaultEngagementFilter.value ||
    isNonDefaultSort.value
)

const activeTypeLabel = computed(
  () => sessionTypeOptions.value.find((o) => o.value === props.sessionTypeFilter)?.label ?? ''
)
const activeEngagementLabel = computed(
  () => sessionEngagementOptions.value.find((o) => o.value === props.sessionEngagementFilter)?.label ?? ''
)
const activeSortLabel = computed(() => sortOptions.value.find((o) => o.value === props.sessionSort)?.label ?? '')

const clearAllFilters = () => {
  emit('update:searchKeyword', '')
  emit('update:sessionTypeFilter', WORKBENCH_SESSION_TYPE_FILTERS.all)
  emit('update:sessionEngagementFilter', WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all)
  emit('update:sessionSort', WORKBENCH_SESSION_SORTS.recent)
}

type ChipOption<T extends string> = {
  value: T
  label: string
}

const updateSessionTypeFilter = (value: WorkbenchSessionTypeFilter) => emit('update:sessionTypeFilter', value)
const updateSessionEngagementFilter = (value: WorkbenchSessionEngagementFilter) =>
  emit('update:sessionEngagementFilter', value)
const updateSessionSort = (value: WorkbenchSessionSort) => emit('update:sessionSort', value)

const handleChipGroupKeydown = <T extends string>(
  event: KeyboardEvent,
  options: ReadonlyArray<ChipOption<T>>,
  currentValue: T,
  onChange: (value: T) => void
) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
    return
  }

  event.preventDefault()

  const currentIndex = options.findIndex((option) => option.value === currentValue)
  if (currentIndex === -1) return

  let nextIndex = currentIndex
  if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = options.length - 1
  } else {
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
    nextIndex = (currentIndex + direction + options.length) % options.length
  }

  const nextOption = options[nextIndex]
  if (!nextOption) return

  const target = event.currentTarget as HTMLElement | null
  const nextButton = target?.parentElement?.querySelectorAll<HTMLButtonElement>('button[role="tab"]')[nextIndex]
  nextButton?.focus()
  onChange(nextOption.value)
}
</script>

<style scoped lang="scss">
.room-space-toolbar {
  background: var(--hula-surface-panel);
}

.toolbar-search {
  max-width: 360px;
}

.room-space-toolbar--compact {
  padding: 10px;
}

.room-space-toolbar--compact .toolbar-search {
  min-width: 180px !important;
  max-width: none;
}

.toolbar-summary {
  min-width: 56px;
  text-align: right;
}

.toolbar-chip-group {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
}

.room-space-toolbar--compact .toolbar-chip-group {
  gap: 6px;
}

.toolbar-chip {
  border: 1px solid var(--hula-border-default);
  border-radius: var(--hula-radius-full);
  background: transparent;
  padding: 4px 12px;
  color: var(--hula-text-secondary);
  font-size: 12px;
  line-height: 1.5;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.room-space-toolbar--compact .toolbar-chip {
  padding: 4px 10px;
}

.toolbar-chip:hover {
  border-color: var(--hula-color-primary-300);
  color: var(--hula-text-primary);
}

.toolbar-chip:focus-visible {
  outline: 2px solid var(--hula-color-primary-500);
  outline-offset: 2px;
}

.toolbar-chip--active {
  border-color: var(--hula-color-primary-500);
  background: var(--hula-color-primary-100);
  color: var(--hula-color-primary-600);
}

@media (prefers-reduced-motion: reduce) {
  .toolbar-chip {
    transition: none;
  }
}

.toolbar-filter-summary {
  padding: 6px 10px;
  background: var(--hula-surface-search);
  border-radius: 8px;
}

.toolbar-filter-tag {
  background: var(--hula-color-primary-100) !important;
  color: var(--hula-color-primary-600) !important;
  font-size: 11px;
}

.toolbar-clear-all {
  border: 0;
  background: transparent;
  color: var(--hula-color-primary-500);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--hula-color-primary-100);
  }
}

.toolbar-preset-bar {
  padding: 4px 10px;
}

.toolbar-preset-button,
.toolbar-preset-active {
  border-radius: var(--hula-radius-full);
  font-size: 11px;
  line-height: 1.4;
}

.toolbar-preset-button {
  border: 1px solid var(--hula-border-default);
  background: transparent;
  color: var(--hula-text-secondary);
  cursor: pointer;
  padding: 4px 10px;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.toolbar-preset-button:hover {
  border-color: var(--hula-color-primary-300);
  color: var(--hula-text-primary);
}

.toolbar-preset-button--primary {
  border-color: var(--hula-color-primary-500);
  background: var(--hula-color-primary-100);
  color: var(--hula-color-primary-600);
}

.toolbar-preset-active {
  padding: 4px 10px;
  background: var(--hula-surface-search);
  color: var(--hula-text-tertiary);
}
</style>
