<template>
  <div v-if="visible" class="room-batch-action-bar">
    <n-flex align="center" :size="12" class="flex-1 min-w-0">
      <n-checkbox :checked="allSelected" :indeterminate="indeterminate" @update:checked="emit('toggleAll')" />
      <span class="text-12px color-[--hula-text-secondary]">
        {{ t('room.batch.selected_count', { count: selectedCount }) }}
      </span>
    </n-flex>

    <n-flex align="center" :size="6">
      <n-tooltip trigger="hover">
        <template #trigger>
          <button type="button" class="room-batch-action-bar__btn" @click="emit('markRead')">
            <svg class="size-14px"><use href="#read" /></svg>
          </button>
        </template>
        {{ t('room.batch.mark_read') }}
      </n-tooltip>

      <n-tooltip trigger="hover">
        <template #trigger>
          <button type="button" class="room-batch-action-bar__btn" @click="emit('pin')">
            <svg class="size-14px"><use href="#pin" /></svg>
          </button>
        </template>
        {{ t('room.batch.pin') }}
      </n-tooltip>

      <n-tooltip trigger="hover">
        <template #trigger>
          <button type="button" class="room-batch-action-bar__btn" @click="emit('mute')">
            <svg class="size-14px"><use href="#close-remind" /></svg>
          </button>
        </template>
        {{ t('room.batch.mute') }}
      </n-tooltip>

      <n-tooltip trigger="hover">
        <template #trigger>
          <button
            type="button"
            class="room-batch-action-bar__btn room-batch-action-bar__btn--danger"
            @click="emit('leave')">
            <svg class="size-14px"><use href="#logout" /></svg>
          </button>
        </template>
        {{ t('room.batch.leave') }}
      </n-tooltip>

      <n-divider vertical />

      <button type="button" class="room-batch-action-bar__close" @click="emit('close')">
        {{ t('common.close') }}
      </button>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  visible: boolean
  selectedCount: number
  totalCount: number
}>()

const emit = defineEmits<{
  toggleAll: []
  markRead: []
  pin: []
  mute: []
  leave: []
  close: []
}>()

const { t } = useI18n()

const allSelected = computed(() => props.selectedCount === props.totalCount && props.totalCount > 0)
const indeterminate = computed(() => props.selectedCount > 0 && props.selectedCount < props.totalCount)
</script>

<style scoped lang="scss">
.room-batch-action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: var(--hula-surface-elevated);
  border-bottom: 1px solid var(--hula-border-default);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.room-batch-action-bar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--hula-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
    color: var(--hula-text-primary);
  }

  &--danger:hover {
    background: rgba(239, 68, 68, 0.1);
    color: var(--hula-color-danger-500);
  }
}

.room-batch-action-bar__close {
  border: 0;
  background: transparent;
  color: var(--hula-text-tertiary);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
    color: var(--hula-text-primary);
  }
}
</style>
