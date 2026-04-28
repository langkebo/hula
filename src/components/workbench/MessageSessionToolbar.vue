<template>
  <div
    class="message-session-toolbar border-b border-[--hula-border-default] px-12px py-10px"
    data-test="message-session-toolbar">
    <div class="toolbar-stack">
      <div class="toolbar-row toolbar-row--top">
        <label class="toolbar-search min-w-220px flex-1">
          <svg class="toolbar-search__icon size-14px color-[--hula-text-tertiary]" aria-hidden="true">
            <use href="#search"></use>
          </svg>
          <input
            :value="searchKeyword"
            type="text"
            class="toolbar-search__input"
            :placeholder="t('space.search_sessions_placeholder')"
            :aria-label="t('space.search_sessions_placeholder')"
            @input="emit('update:searchKeyword', ($event.target as HTMLInputElement).value)" />
          <button
            v-if="searchKeyword"
            type="button"
            class="toolbar-search__clear"
            :aria-label="t('common.clear')"
            @click="emit('update:searchKeyword', '')">
            x
          </button>
        </label>
        <span class="toolbar-summary text-12px color-[--hula-text-tertiary]">{{ filteredCount }}/{{ totalCount }}</span>
      </div>

      <div class="toolbar-row toolbar-row--bottom">
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
            :data-test="`message-session-type-${option.value}`"
            @click="emit('update:sessionTypeFilter', option.value)"
            @keydown="handleChipGroupKeydown($event, sessionTypeOptions, option.value, updateSessionTypeFilter)">
            {{ option.label }}
          </button>
        </div>

        <div class="toolbar-sort-meta">
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
              :data-test="`message-session-sort-${option.value}`"
              @click="emit('update:sessionSort', option.value)"
              @keydown="handleChipGroupKeydown($event, sortOptions, option.value, updateSessionSort)">
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>
    </div>
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

const { t } = useI18n()

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
.message-session-toolbar {
  background: var(--hula-surface-panel);
}

.toolbar-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-search {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 360px;
  min-height: 36px;
  border: 1px solid var(--hula-border-default);
  border-radius: 999px;
  background: var(--hula-surface-elevated, var(--hula-surface-panel));
  padding: 0 12px;
}

.toolbar-search:focus-within {
  border-color: var(--hula-color-primary-500);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--hula-color-primary-500) 18%, transparent);
}

.toolbar-search__icon {
  flex-shrink: 0;
}

.toolbar-search__input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--hula-text-primary);
  font-size: 13px;
  line-height: 1.5;
}

.toolbar-search__input::placeholder {
  color: var(--hula-text-tertiary);
}

.toolbar-search__clear {
  border: 0;
  background: transparent;
  color: var(--hula-text-tertiary);
  font-size: 12px;
  line-height: 1;
  padding: 0;
  cursor: pointer;
}

.toolbar-sort-meta {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
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
