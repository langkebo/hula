<template>
  <div v-if="visible" class="sliding-sync-indicator" :class="`sliding-sync-indicator--${status}`">
    <div class="sliding-sync-indicator__icon">
      <n-spin v-if="status === 'syncing'" :size="14" />
      <svg v-else-if="status === 'complete'" class="sliding-sync-indicator__check">
        <use href="#check-circle"></use>
      </svg>
      <svg v-else-if="status === 'error'" class="sliding-sync-indicator__error">
        <use href="#error-circle"></use>
      </svg>
    </div>
    <span class="sliding-sync-indicator__text">{{ statusText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NSpin } from 'naive-ui'

const props = defineProps<{
  status: 'syncing' | 'complete' | 'error' | 'idle'
  visible?: boolean
  syncedRooms?: number
  totalRooms?: number
}>()

const statusText = computed(() => {
  switch (props.status) {
    case 'syncing':
      if (props.syncedRooms !== undefined && props.totalRooms !== undefined) {
        return `同步中 ${props.syncedRooms}/${props.totalRooms}`
      }
      return '同步中...'
    case 'complete':
      return '同步完成'
    case 'error':
      return '同步失败'
    default:
      return ''
  }
})
</script>

<style scoped>
.sliding-sync-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  background: var(--bg-hover);
  border: 1px solid var(--line-color);
  transition: all 0.3s ease;
}

.sliding-sync-indicator--syncing {
  background: var(--hula-color-info-100);
  border-color: color-mix(in srgb, var(--hula-color-info-500) 30%, transparent);
  color: var(--hula-color-info-500);
}

.sliding-sync-indicator--complete {
  background: var(--hula-color-success-100);
  border-color: color-mix(in srgb, var(--hula-color-success-500) 30%, transparent);
  color: var(--hula-color-success-500);
}

.sliding-sync-indicator--error {
  background: var(--hula-color-danger-100);
  border-color: color-mix(in srgb, var(--hula-color-danger-500) 30%, transparent);
  color: var(--hula-color-danger-500);
}

.sliding-sync-indicator__icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.sliding-sync-indicator__check,
.sliding-sync-indicator__error {
  width: 14px;
  height: 14px;
}

.sliding-sync-indicator__text {
  white-space: nowrap;
}
</style>
