<template>
  <div
    class="room-space-toolbar border-b border-[--hula-border-default] px-12px py-10px"
    :class="{ 'room-space-toolbar--compact': props.compact }"
    :data-test="props.rootTestId">
    <n-flex vertical :size="10">
      <n-flex align="center" justify="space-between" :size="12" wrap>
        <n-input
          :value="searchKeyword"
          clearable
          class="toolbar-search min-w-220px flex-1"
          :placeholder="t('space.search_sessions_placeholder')"
          :aria-label="t('space.search_sessions_placeholder')"
          @update:value="emit('update:searchKeyword', $event)">
          <template #prefix>
            <svg class="size-14px color-[--hula-text-tertiary]">
              <use href="#search"></use>
            </svg>
          </template>
        </n-input>

        <n-flex align="center" :size="8" wrap>
          <n-button v-if="showCreateAction" size="small" secondary @click="emit('createSpace')">
            <template #icon>
              <svg class="size-14px">
                <use href="#add"></use>
              </svg>
            </template>
            {{ t('space.create') }}
          </n-button>
          <span class="toolbar-summary text-12px color-[--hula-text-tertiary]">
            {{ filteredCount }}/{{ totalCount }}
          </span>
        </n-flex>
      </n-flex>

      <n-flex align="center" justify="space-between" :size="12" wrap>
        <div class="toolbar-chip-group" role="tablist" :aria-label="t('space.filter_label')">
          <button
            v-for="option in sessionTypeOptions"
            :key="option.value"
            type="button"
            class="toolbar-chip"
            :class="{ 'toolbar-chip--active': sessionTypeFilter === option.value }"
            role="tab"
            :aria-selected="sessionTypeFilter === option.value"
            :tabindex="sessionTypeFilter === option.value ? 0 : -1"
            :data-test="`${testIdPrefix}-type-${option.value}`"
            @click="emit('update:sessionTypeFilter', option.value)"
            @keydown="handleChipGroupKeydown($event, sessionTypeOptions, option.value, updateSessionTypeFilter)">
            {{ option.label }}
          </button>
        </div>

        <n-flex align="center" :size="8" wrap>
          <span class="text-12px color-[--hula-text-tertiary]">{{ sortSummary }}</span>
          <div class="toolbar-chip-group" role="tablist" :aria-label="t('space.sort_label')">
            <button
              v-for="option in sortOptions"
              :key="option.value"
              type="button"
              class="toolbar-chip"
              :class="{ 'toolbar-chip--active': sessionSort === option.value }"
              role="tab"
              :aria-selected="sessionSort === option.value"
              :tabindex="sessionSort === option.value ? 0 : -1"
              :data-test="`${testIdPrefix}-sort-${option.value}`"
              @click="emit('update:sessionSort', option.value)"
              @keydown="handleChipGroupKeydown($event, sortOptions, option.value, updateSessionSort)">
              {{ option.label }}
            </button>
          </div>
        </n-flex>
      </n-flex>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  WORKBENCH_SESSION_SORTS,
  WORKBENCH_SESSION_TYPE_FILTERS,
  type WorkbenchSessionSort,
  type WorkbenchSessionTypeFilter
} from '@/router/spaceNavigation'

const props = withDefaults(
  defineProps<{
    searchKeyword: string
    sessionTypeFilter: WorkbenchSessionTypeFilter
    sessionSort: WorkbenchSessionSort
    filteredCount: number
    totalCount: number
    compact?: boolean
    showCreateAction?: boolean
    rootTestId?: string
    testIdPrefix?: string
  }>(),
  {
    compact: false,
    showCreateAction: true,
    testIdPrefix: 'session'
  }
)

const emit = defineEmits<{
  'update:searchKeyword': [value: string]
  'update:sessionTypeFilter': [value: WorkbenchSessionTypeFilter]
  'update:sessionSort': [value: WorkbenchSessionSort]
  createSpace: []
}>()

const { t } = useI18n()
const showCreateAction = computed(() => props.showCreateAction)
const testIdPrefix = computed(() => props.testIdPrefix)

const sessionTypeOptions = computed(() => [
  { value: WORKBENCH_SESSION_TYPE_FILTERS.all, label: t('space.filter_all') },
  { value: WORKBENCH_SESSION_TYPE_FILTERS.group, label: t('space.filter_group') },
  { value: WORKBENCH_SESSION_TYPE_FILTERS.single, label: t('space.filter_single') }
])

const sortOptions = computed(() => [
  { value: WORKBENCH_SESSION_SORTS.recent, label: t('space.sort_recent') },
  { value: WORKBENCH_SESSION_SORTS.name, label: t('space.sort_name') }
])

const sortSummary = computed(() =>
  props.sessionSort === WORKBENCH_SESSION_SORTS.name ? t('space.sort_summary_name') : t('space.sort_summary_recent')
)

type ChipOption<T extends string> = {
  value: T
  label: string
}

const updateSessionTypeFilter = (value: WorkbenchSessionTypeFilter) => emit('update:sessionTypeFilter', value)
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
</style>
