<template>
  <div v-if="visible" class="message-forward-dialog" data-test="forward-dialog" role="dialog" @click.stop>
    <div class="dialog-header">
      <span class="dialog-title">{{ t('message.forward_title') }}</span>
      <button type="button" class="dialog-close" :aria-label="t('common.close')" @click="handleCancel">
        <svg class="size-16px"><use href="#close"></use></svg>
      </button>
    </div>

    <div class="dialog-body">
      <div class="search-row">
        <svg class="search-icon size-16px"><use href="#search"></use></svg>
        <input
          data-test="forward-search"
          type="text"
          class="search-input"
          :placeholder="t('message.forward_search_placeholder')"
          v-model="searchKeyword"
          @input="onSearchInput" />
        <button
          v-if="searchKeyword"
          type="button"
          class="search-clear"
          :aria-label="t('common.clear')"
          @click="clearSearch">
          <svg class="size-14px"><use href="#close"></use></svg>
        </button>
      </div>

      <div class="results-area">
        <div v-if="loading" class="results-loading">{{ t('common.loading') }}</div>
        <div v-else-if="searchResults.length === 0" class="results-empty">
          {{ searchKeyword ? t('message.forward_no_results') : t('message.forward_hint') }}
        </div>
        <ul v-else class="results-list">
          <li
            v-for="item in searchResults"
            :key="item.id"
            class="result-item"
            :class="{ 'result-item--selected': isSelected(item.id) }"
            @click="toggleTarget(item.id)">
            <span class="result-checkbox" :class="{ 'result-checkbox--checked': isSelected(item.id) }">
              <svg v-if="isSelected(item.id)" class="size-12px"><use href="#success"></use></svg>
            </span>
            <span class="result-name">{{ item.name }}</span>
            <span class="result-type">{{ t(`message.forward_type_${item.type}`) }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div class="dialog-footer">
      <span v-if="selectedTargets.length" class="selected-count" data-test="forward-count">
        {{ t('message.forward_selected', { count: selectedTargets.length }) }}
      </span>
      <span v-else class="selected-count selected-count--empty">{{ t('message.forward_no_selection') }}</span>
      <div class="footer-actions">
        <button type="button" class="btn btn--secondary" data-test="forward-cancel" @click="handleCancel">
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn--primary"
          data-test="forward-submit"
          :disabled="selectedTargets.length === 0 || submitting"
          @click="handleSubmit">
          {{ submitting ? t('common.sending') : t('common.send') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixSearchService } from '@/services/matrix/MatrixSearchService'
import { matrixForwardService } from '@/services/matrix/messaging/MatrixForwardService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MessageForwardDialog')

const props = defineProps<{
  visible: boolean
  sourceRoomId: string
  eventIds: string[]
}>()

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  success: []
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

interface ForwardTarget {
  id: string
  name: string
  type: 'room' | 'friend'
}

const searchKeyword = ref('')
const searchResults = ref<ForwardTarget[]>([])
const selectedTargets = ref<string[]>([])
const loading = ref(false)
const submitting = ref(false)

const isSelected = (id: string) => selectedTargets.value.includes(id)

const toggleTarget = (id: string) => {
  if (isSelected(id)) {
    selectedTargets.value = selectedTargets.value.filter((target) => target !== id)
  } else {
    selectedTargets.value = [...selectedTargets.value, id]
  }
}

const performSearch = async () => {
  const keyword = searchKeyword.value.trim()
  if (!keyword) {
    searchResults.value = []
    return
  }

  loading.value = true
  try {
    const rooms = await matrixSearchService.searchRooms(keyword).catch((err) => {
      logger.error('searchRooms failed:', err)
      return []
    })

    // searchRooms 返回所有已加入的房间（含单聊 DM 房间），按类型分类展示
    searchResults.value = rooms
      .filter((room) => room.roomId !== props.sourceRoomId)
      .map((room) => ({
        id: room.roomId,
        name: room.roomName || room.roomId,
        type: (room.isDirect ? 'friend' : 'room') as 'room' | 'friend'
      }))
  } finally {
    loading.value = false
  }
}

const handleSearch = useDebounceFn(performSearch, 300)

const onSearchInput = () => {
  void handleSearch()
}

const clearSearch = () => {
  searchKeyword.value = ''
  searchResults.value = []
}

const handleCancel = () => {
  emit('update:visible', false)
}

const handleSubmit = async () => {
  if (selectedTargets.value.length === 0 || submitting.value) return
  submitting.value = true
  try {
    const results = await matrixForwardService.forwardRoomMessages(
      props.sourceRoomId,
      props.eventIds,
      selectedTargets.value
    )
    const failedCount = results.filter((r) => !r.success).length
    if (results.length > 0 && failedCount === results.length) {
      // 全部失败：保持对话框打开，用户可重试
      showFeedback(t('message.forward_failed'), 'error')
      return
    }
    if (failedCount > 0) {
      // 部分失败：提示部分目标未送达，但已成功的部分保留
      showFeedback(t('message.forward_partial_failed', { failed: failedCount, total: results.length }), 'warning')
    } else {
      showFeedback(t('message.forward_success'), 'success')
    }
    emit('success')
    emit('update:visible', false)
  } catch (err) {
    logger.error('forward failed:', err)
    showFeedback(t('message.forward_failed'), 'error')
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      selectedTargets.value = []
      searchKeyword.value = ''
      searchResults.value = []
    }
  }
)
</script>

<style scoped lang="scss">
.message-forward-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1001;
  width: min(420px, 90vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--hula-surface-elevated);
  border: 1px solid var(--hula-border-default);
  border-radius: 12px;
  box-shadow: var(--hula-shadow-floating-menu);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--hula-border-layout-divider);
}

.dialog-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--hula-text-primary);
}

.dialog-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--hula-text-secondary);
  cursor: pointer;

  &:hover {
    background: var(--hula-surface-list-hover);
    color: var(--hula-text-primary);
  }
}

.dialog-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px 16px;
  gap: 12px;
}

.search-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  height: 36px;
  background: var(--hula-surface-search);
  border: 1px solid transparent;
  border-radius: 8px;

  &:focus-within {
    border-color: var(--hula-color-primary-500);
  }
}

.search-icon {
  color: var(--hula-text-tertiary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--hula-text-primary);
  font-size: 13px;

  &::placeholder {
    color: var(--hula-text-tertiary);
  }
}

.search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  background: var(--hula-surface-list-hover);
  color: var(--hula-text-secondary);
  cursor: pointer;

  &:hover {
    color: var(--hula-text-primary);
  }
}

.results-area {
  flex: 1;
  min-height: 200px;
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid var(--hula-border-layout-divider);
  border-radius: 8px;
  background: var(--hula-surface-panel);
}

.results-loading,
.results-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  color: var(--hula-text-tertiary);
  font-size: 12px;
}

.results-list {
  list-style: none;
  margin: 0;
  padding: 4px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.12s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
  }

  &--selected {
    background: var(--hula-color-primary-100, color-mix(in srgb, var(--hula-color-primary-500) 12%, transparent));
  }
}

.result-checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid var(--hula-border-contrast);
  border-radius: 4px;
  color: #fff;
  flex-shrink: 0;

  &--checked {
    background: var(--hula-color-primary-500);
    border-color: var(--hula-color-primary-500);
  }
}

.result-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--hula-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-type {
  font-size: 11px;
  color: var(--hula-text-tertiary);
  flex-shrink: 0;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--hula-border-layout-divider);
  gap: 12px;
}

.selected-count {
  font-size: 12px;
  color: var(--hula-color-primary-500);
}

.selected-count--empty {
  color: var(--hula-text-tertiary);
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.btn {
  height: 28px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}

.btn--secondary {
  background: var(--hula-surface-list-hover);
  color: var(--hula-text-primary);

  &:hover {
    background: var(--hula-surface-list-active, var(--hula-surface-list-hover));
  }
}

.btn--primary {
  background: var(--hula-color-primary-500);
  color: #fff;

  &:hover:not(:disabled) {
    background: var(--hula-color-primary-600, var(--hula-color-primary-500));
  }

  &:disabled {
    background: var(--hula-color-primary-500);
    opacity: 0.4;
    cursor: not-allowed;
  }
}
</style>
