<template>
  <div class="friend-search-bar" :dir="dir">
    <n-input
      :value="modelValue"
      clearable
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      class="friend-search-bar__input"
      @update:value="handleValueChange"
      @keydown.enter="handleEnterSearch"
      @keydown.esc="handleEsc">
      <template #prefix>
        <svg class="size-16px color-[--tjg-text-tertiary]"><use href="#search" /></svg>
      </template>
      <template v-if="showGlobalSearchAction" #suffix>
        <button
          type="button"
          class="friend-search-bar__global"
          :aria-label="t('search.title')"
          :title="t('search.title')"
          @click="$emit('global-search', modelValue)">
          <svg class="size-16px"><use href="#expand" /></svg>
        </button>
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
    /** 阶段 3：是否显示全局搜索触发按钮 */
    showGlobalSearchAction?: boolean
  }>(),
  {
    history: () => [],
    showHistory: true,
    placeholder: '',
    dir: 'ltr',
    debounceMs: 300,
    showGlobalSearchAction: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: [value: string]
  'select-history': [value: string]
  'clear-history': []
  /** 阶段 3：点击全局搜索按钮时触发 */
  'global-search': [value: string]
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

// 阶段 9：Esc 清空搜索框并失焦（需求文档 3.3.6）
const handleEsc = () => {
  emit('update:modelValue', '')
  emit('search', '')
}
</script>

<style scoped lang="scss">
.friend-search-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 阶段 9：搜索栏规范（需求文档 3.3.6）—— 高度 40px，圆角 8px，背景 --tjg-surface-search */
.friend-search-bar__input {
  :deep(.n-input) {
    --n-height: 40px;
    --n-font-size: 14px;
    --n-border-radius: 8px;
    background: var(--tjg-surface-search);
  }

  :deep(.n-input__input-el) {
    font-size: 14px;
  }
}

.friend-search-bar__history {
  background: color-mix(in srgb, var(--tjg-color-primary-500) 5%, var(--tjg-surface-panel));
  border: 1px solid var(--tjg-border-default);
  border-radius: 12px;
  padding: 10px;
}

.friend-search-bar__history-header {
  align-items: center;
  color: var(--tjg-text-tertiary);
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
  color: var(--tjg-color-primary-500);
  transition: color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    color: var(--tjg-color-primary-600);
  }
}

.friend-search-bar__global {
  background: transparent;
  border: 0;
  border-radius: 4px;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  transition:
    background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
    color: var(--tjg-text-primary);
  }
}

.friend-search-bar__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.friend-search-bar__chip {
  background: var(--tjg-color-primary-100);
  border-radius: var(--tjg-radius-full);
  color: var(--tjg-text-secondary);
  cursor: pointer;
  font-size: 12px;
  padding: 4px 10px;
  transition:
    background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    transform var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-color-primary-200);
    transform: translateY(-1px);
  }
}
</style>
