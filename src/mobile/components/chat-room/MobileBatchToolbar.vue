<template>
  <div class="mobile-batch-toolbar">
    <!-- 顶部状态栏: 已选数量 + 全选/取消全选 -->
    <div class="mobile-batch-toolbar__header">
      <span class="mobile-batch-toolbar__count" data-test="batch-selected-count">
        {{ t('message.multi_choose.selected_count', { count: selectedIds.length }) }}
      </span>
      <van-button
        size="small"
        plain
        type="primary"
        round
        data-test="batch-select-all-btn"
        @click="handleToggleSelectAll">
        {{ isAllSelected ? t('message.multi_choose.unselect_all') : t('message.multi_choose.select_all') }}
      </van-button>
    </div>

    <!-- 底部操作按钮 -->
    <div class="mobile-batch-toolbar__actions">
      <van-button
        type="default"
        size="small"
        plain
        :disabled="selectedIds.length === 0 || processing"
        :loading="processing && pendingAction === 'copy'"
        data-test="batch-copy-btn"
        class="mobile-batch-toolbar__action"
        @click="handleCopy">
        <template #icon>
          <van-icon name="records" />
        </template>
        {{ t('message.multi_select.copy') }}
      </van-button>
      <van-button
        type="default"
        size="small"
        plain
        :disabled="selectedIds.length === 0 || processing"
        :loading="processing && pendingAction === 'forward'"
        data-test="batch-forward-btn"
        class="mobile-batch-toolbar__action"
        @click="handleForward">
        <template #icon>
          <van-icon name="share-o" />
        </template>
        {{ t('message.multi_select.forward') }}
      </van-button>
      <van-button
        type="default"
        size="small"
        plain
        :disabled="selectedIds.length === 0 || processing"
        :loading="processing && pendingAction === 'delete'"
        data-test="batch-delete-btn"
        class="mobile-batch-toolbar__action"
        @click="handleDelete">
        <template #icon>
          <van-icon name="delete-o" />
        </template>
        {{ t('message.multi_select.delete') }}
      </van-button>
      <van-button
        type="default"
        size="small"
        plain
        :disabled="processing"
        data-test="batch-exit-btn"
        class="mobile-batch-toolbar__action"
        @click="handleExit">
        <template #icon>
          <van-icon name="cross" />
        </template>
        {{ t('message.multi_choose.exit_multi_select') }}
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import 'vant/es/dialog/style'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMessageMultiSelect } from '@/composables/messaging/useMessageMultiSelect'
import { useGlobalStore } from '@/stores/domains/widget/global'

defineOptions({ name: 'MobileBatchToolbar' })

const emit = defineEmits<{
  (
    e: 'forward',
    payload: {
      eventId: string
      roomId: string
      eventIds: string[]
    }
  ): void
  (e: 'exit'): void
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const globalStore = useGlobalStore()

const {
  selectedIds,
  selectedMessages,
  isAllSelected,
  processing,
  selectAll,
  clearSelection,
  batchCopy,
  batchForward,
  batchDelete,
  exitMultiSelect
} = useMessageMultiSelect({ roomId: globalStore.currentSessionRoomId })

// 跟踪当前正在执行的批量操作（用于 loading 态区分）
const pendingAction = ref<'copy' | 'forward' | 'delete' | null>(null)

const handleToggleSelectAll = (): void => {
  if (isAllSelected.value) {
    clearSelection()
  } else {
    selectAll()
  }
}

const handleCopy = async (): Promise<void> => {
  if (selectedIds.value.length === 0) {
    showFeedback(t('message.multi_select.empty_selection'), 'warning')
    return
  }
  pendingAction.value = 'copy'
  try {
    await batchCopy()
  } finally {
    pendingAction.value = null
  }
}

const handleForward = async (): Promise<void> => {
  if (selectedIds.value.length === 0) {
    showFeedback(t('message.multi_select.empty_selection'), 'warning')
    return
  }
  pendingAction.value = 'forward'
  try {
    const target = await batchForward()
    if (!target) return
    // 退出多选模式后通知父组件打开转发弹窗
    exitMultiSelect()
    emit('exit')
    emit('forward', target)
  } finally {
    pendingAction.value = null
  }
}

const handleDelete = async (): Promise<void> => {
  if (selectedIds.value.length === 0) {
    showFeedback(t('message.multi_select.empty_selection'), 'warning')
    return
  }
  pendingAction.value = 'delete'
  try {
    await batchDelete()
  } finally {
    pendingAction.value = null
  }
}

const handleExit = (): void => {
  exitMultiSelect()
  emit('exit')
}

// 防御性提示: selectedMessages 变化时,理论上 computed 已自动同步,无需额外逻辑
// 仅在开发态提示,便于发现状态不同步问题
if (import.meta.env.DEV) {
  watch(
    () => selectedMessages.value.length,
    (n) => {
      if (n > 0 && selectedIds.value.length !== n) {
      }
    }
  )
}
</script>

<style scoped lang="scss">
.mobile-batch-toolbar {
  display: flex;
  flex-direction: column;
  background: var(--tjg-surface-panel);
  border-top: 1px solid var(--tjg-border-default);
  box-shadow: var(--tjg-shadow-top-bar);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid var(--tjg-border-default);
  }

  &__count {
    font-size: 13px;
    color: var(--tjg-text-secondary);
  }

  &__actions {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  }

  &__action {
    margin: 0;
    font-size: 12px;
  }
}
</style>
