<template>
  <n-flex :size="2" align="center" class="workbench-pane-tabs">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      class="workbench-pane-tabs__tab"
      :class="{
        'workbench-pane-tabs__tab--active': modelValue === tab.key,
        'workbench-pane-tabs__tab--disabled': tab.disabled
      }"
      :disabled="tab.disabled"
      @click="!tab.disabled && emit('update:modelValue', tab.key)">
      <svg v-if="tab.icon" class="size-12px"><use :href="tab.icon" /></svg>
      <span>{{ tab.label }}</span>
      <span v-if="tab.badge && tab.badge > 0" class="workbench-pane-tabs__badge">
        {{ tab.badge > 99 ? '99+' : tab.badge }}
      </span>
    </button>
  </n-flex>
</template>

<script setup lang="ts" generic="T extends string">
export type PaneTab<T> = {
  key: T
  label: string
  icon?: string
  badge?: number
  disabled?: boolean
}

defineProps<{
  modelValue: T
  tabs: PaneTab<T>[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()
</script>

<style scoped lang="scss">
.workbench-pane-tabs {
  flex-shrink: 0;
}

.workbench-pane-tabs__tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--hula-text-tertiary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  position: relative;

  &:hover:not(&--disabled):not(&--active) {
    background: var(--hula-surface-list-hover);
    color: var(--hula-text-secondary);
  }

  &--active {
    background: var(--hula-surface-search);
    color: var(--hula-color-primary-500);
    font-weight: 600;
  }

  &--disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.workbench-pane-tabs__badge {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--badge-danger-bg);
  color: var(--badge-danger-text);
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}
</style>
