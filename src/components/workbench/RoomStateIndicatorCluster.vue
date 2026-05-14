<template>
  <n-flex align="center" :size="3" class="room-state-cluster">
    <n-tooltip v-if="isEncrypted" trigger="hover">
      <template #trigger>
        <svg class="room-state-cluster__icon color-[--hula-color-primary-500]">
          <use href="#encryption" />
        </svg>
      </template>
      {{ t('room.state.encrypted') }}
    </n-tooltip>

    <n-tooltip v-if="isBurnAfterRead" trigger="hover">
      <template #trigger>
        <svg class="room-state-cluster__icon color-[--hula-color-warning-500]">
          <use href="#flame" />
        </svg>
      </template>
      {{ t('room.state.burn_after_read') }}
    </n-tooltip>

    <n-tooltip v-if="hasDraft" trigger="hover">
      <template #trigger>
        <svg class="room-state-cluster__icon color-[--hula-text-tertiary]">
          <use href="#edit" />
        </svg>
      </template>
      {{ t('room.state.has_draft') }}
    </n-tooltip>

    <n-tooltip v-if="hasFailedSend" trigger="hover">
      <template #trigger>
        <svg class="room-state-cluster__icon color-[--hula-color-danger-500]">
          <use href="#error" />
        </svg>
      </template>
      {{ t('room.state.failed_send') }}
    </n-tooltip>

    <span v-if="memberCount" class="room-state-cluster__text">
      {{ memberCount }}
    </span>
  </n-flex>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  isEncrypted?: boolean
  isBurnAfterRead?: boolean
  hasDraft?: boolean
  hasFailedSend?: boolean
  memberCount?: number
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.room-state-cluster {
  flex-shrink: 0;
}

.room-state-cluster__icon {
  width: 12px;
  height: 12px;
  display: block;
}

.room-state-cluster__text {
  font-size: 10px;
  color: var(--hula-text-quaternary);
  line-height: 1;
}
</style>
