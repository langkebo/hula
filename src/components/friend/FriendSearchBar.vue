<template>
  <div class="friend-search-bar" :dir="dir">
    <n-input
      :value="modelValue"
      clearable
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      @update:value="handleValueChange"
      @keydown.enter="handleEnterSearch">
      <template #prefix>
        <svg class="size-14px"><use href="#search" /></svg>
      </template>
    </n-input>

    <div v-if="showHistoryPanel" class="friend-search-bar__history">
      <div class="friend-search-bar__history-header">
        <span>{{ t('friend.search.history') }}</span>
        <button
          type="button"
          class="friend-search-bar__clear"
          :aria-label="t('friend.search.clear_history')"
          @click="$emit('clear-history')">
          {{ t('friend.search.clear_history') }}
        </button>
      </div>
      <div class="friend-search-bar__chips">
        <button
          v-for="item in history"
          :key="item"
          type="button"
          class="friend-search-bar__chip"
          @click="$emit('select-history', item)">
          {{ item }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    modelValue: string
    history?: string[]
    showHistory?: boolean
    placeholder?: string
    dir?: 'ltr' | 'rtl'
    debounceMs?: number
  }>(),
  {
    history: () => [],
    showHistory: true,
    placeholder: '',
    dir: 'ltr',
    debounceMs: 240
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: [value: string]
  'select-history': [value: string]
  'clear-history': []
}>()

const { t } = useI18n()
const ariaLabel = props.placeholder || t('friend.list.search')
const emitSearch = useDebounceFn((value: string) => emit('search', value), props.debounceMs)
const showHistoryPanel = computed(() => props.showHistory && props.history.length > 0)

const handleValueChange = (value: string) => {
  emit('update:modelValue', value)
  emitSearch(value)
}

const handleEnterSearch = () => {
  emit('search', props.modelValue)
}
</script>

<style scoped lang="scss">
.friend-search-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.friend-search-bar__history {
  background: color-mix(in srgb, var(--hula-color-primary-500) 5%, var(--hula-surface-panel));
  border: 1px solid var(--hula-border-default);
  border-radius: 12px;
  padding: 10px;
}

.friend-search-bar__history-header {
  align-items: center;
  color: var(--hula-text-tertiary);
  display: flex;
  font-size: 12px;
  justify-content: space-between;
}

.friend-search-bar__clear,
.friend-search-bar__chip {
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
}

.friend-search-bar__clear {
  color: var(--hula-color-primary-500);
  transition: color var(--hula-motion-duration-fast) var(--hula-motion-ease-standard);

  &:hover {
    color: var(--hula-color-primary-600);
  }
}

.friend-search-bar__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.friend-search-bar__chip {
  background: var(--hula-color-primary-100);
  border-radius: var(--hula-radius-full);
  color: var(--hula-text-secondary);
  cursor: pointer;
  font-size: 12px;
  padding: 4px 10px;
  transition:
    background-color var(--hula-motion-duration-fast) var(--hula-motion-ease-standard),
    transform var(--hula-motion-duration-fast) var(--hula-motion-ease-standard);

  &:hover {
    background: var(--hula-color-primary-200);
    transform: translateY(-1px);
  }
}
</style>
