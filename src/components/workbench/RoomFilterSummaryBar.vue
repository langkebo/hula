<template>
  <div v-if="activeFilters.length" class="room-filter-summary-bar">
    <span class="room-filter-summary-bar__label">{{ t('space.active_filters') }}:</span>
    <n-flex :size="6" align="center" wrap>
      <n-tag
        v-for="filter in activeFilters"
        :key="filter.key"
        size="tiny"
        closable
        round
        :bordered="false"
        class="room-filter-summary-bar__tag"
        @close="emit('removeFilter', filter.key)">
        {{ filter.label }}
      </n-tag>
    </n-flex>
    <button type="button" class="room-filter-summary-bar__clear" @click="emit('clearAll')">
      {{ t('space.clear_all_filters') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export type FilterEntry = {
  key: string
  label: string
}

const props = defineProps<{
  filters: FilterEntry[]
}>()

const emit = defineEmits<{
  removeFilter: [key: string]
  clearAll: []
}>()

const { t } = useI18n()
const activeFilters = computed(() => props.filters)
</script>

<style scoped lang="scss">
.room-filter-summary-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--hula-surface-search);
  border-radius: 8px;
  flex-wrap: wrap;
}

.room-filter-summary-bar__label {
  font-size: 11px;
  color: var(--hula-text-tertiary);
  flex-shrink: 0;
}

.room-filter-summary-bar__tag {
  background: var(--hula-color-primary-100) !important;
  color: var(--hula-color-primary-600) !important;
  font-size: 11px;
}

.room-filter-summary-bar__clear {
  border: 0;
  background: transparent;
  color: var(--hula-color-primary-500);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background-color 0.15s ease;
  flex-shrink: 0;

  &:hover {
    background: var(--hula-color-primary-100);
  }
}
</style>
