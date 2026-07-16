<template>
  <div v-if="multiSelect.multiSelectMode.value" class="mobile-batch-toolbar">
    <span class="mobile-batch-toolbar__count">
      {{ t('message.multi_select.selected_count', { count: multiSelect.selectedIds.value.length }) }}
    </span>
    <div class="mobile-batch-toolbar__actions">
      <van-button size="small" plain type="primary" :loading="multiSelect.processing.value" @click="handleCopy">
        {{ t('message.multi_select.copy') }}
      </van-button>
      <van-button size="small" plain type="primary" @click="$emit('forward')">
        {{ t('message.multi_select.forward') }}
      </van-button>
      <van-button size="small" plain type="danger" @click="handleDelete">
        {{ t('message.multi_select.delete') }}
      </van-button>
    </div>
    <van-button size="small" plain type="default" data-testid="cancel-btn" @click="handleCancel">
      {{ t('common.cancel') }}
    </van-button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessageMultiSelect } from '@/composables/messaging/useMessageMultiSelect'

defineOptions({ name: 'MobileBatchToolbar' })

const props = defineProps<{
  roomId: string
}>()

const emit = defineEmits<{
  (e: 'forward'): void
  (e: 'cancel'): void
}>()

const multiSelect = useMessageMultiSelect({ roomId: computed(() => props.roomId) })

onMounted(() => {
  multiSelect.enterMultiSelect()
})

onUnmounted(() => {
  multiSelect.exitMultiSelect()
})

const { t } = useI18n()

const handleCopy = async () => {
  await multiSelect.batchCopy()
}

const handleDelete = async () => {
  await multiSelect.batchDelete()
}

const handleCancel = () => {
  multiSelect.exitMultiSelect()
  emit('cancel')
}
</script>

<style scoped lang="scss">
.mobile-batch-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  background: var(--hula-surface-panel);
  border-top: 1px solid var(--hula-border-default);

  &__count {
    font-size: 14px;
    color: var(--hula-text-secondary);
    white-space: nowrap;
    min-width: 60px;
  }

  &__actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
