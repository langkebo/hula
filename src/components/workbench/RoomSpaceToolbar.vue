<template>
  <div class="room-space-toolbar border-b border-[--hula-border-default] px-12px py-10px">
    <n-flex vertical :size="10">
      <n-flex align="center" justify="space-between" :size="12" wrap>
        <n-input
          :value="searchKeyword"
          clearable
          class="toolbar-search min-w-220px flex-1"
          :placeholder="t('space.search_sessions_placeholder')"
          @update:value="emit('update:searchKeyword', $event)">
          <template #prefix>
            <svg class="size-14px color-[--hula-text-tertiary]">
              <use href="#search"></use>
            </svg>
          </template>
        </n-input>

        <n-flex align="center" :size="8" wrap>
          <n-button size="small" secondary @click="emit('createSpace')">
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
            :data-test="`session-type-${option.value}`"
            @click="emit('update:sessionTypeFilter', option.value)">
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
              :data-test="`session-sort-${option.value}`"
              @click="emit('update:sessionSort', option.value)">
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
  createSpace: []
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
</script>

<style scoped lang="scss">
.room-space-toolbar {
  background: var(--hula-surface-panel);
}

.toolbar-search {
  max-width: 360px;
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

.toolbar-chip--active {
  border-color: var(--hula-color-primary-500);
  background: var(--hula-color-primary-100);
  color: var(--hula-color-primary-600);
}
</style>
