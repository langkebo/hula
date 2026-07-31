<template>
  <div v-if="visible" class="message-edit-inline" data-test="edit-inline" @click.stop>
    <div class="edit-header">
      <span class="edit-label">{{ t('message.editing') }}</span>
      <button
        type="button"
        class="edit-close"
        data-test="edit-inline-cancel"
        :aria-label="t('common.cancel')"
        @click="handleCancel">
        <svg class="size-14px"><use href="#close"></use></svg>
      </button>
    </div>
    <textarea
      ref="textareaRef"
      v-model="editContent"
      class="edit-textarea"
      data-test="edit-inline-textarea"
      rows="1"
      :placeholder="t('message.edit_placeholder')"
      @keydown.enter="handleEnter"
      @keydown.esc="handleCancel"
      @input="autoResize"></textarea>
    <div class="edit-footer">
      <span class="edit-hint">{{ t('message.edit_inline_hint') }}</span>
      <button
        type="button"
        class="btn btn--primary"
        data-test="edit-inline-save"
        :disabled="submitting"
        @click="handleSubmit">
        {{ submitting ? t('common.saving') : t('common.save') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixMessageRelationService } from '@/services/matrix/messaging/MatrixMessageRelationService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MessageEditInline')

const props = defineProps<{
  visible: boolean
  roomId: string
  eventId: string
  originalContent: string
}>()

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  saved: [newEventId: string]
  cancel: []
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const textareaRef = ref<HTMLTextAreaElement>()
const editContent = ref('')
const submitting = ref(false)

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      editContent.value = props.originalContent
      nextTick(() => {
        textareaRef.value?.focus()
        autoResize()
      })
    }
  },
  { immediate: true }
)

const autoResize = () => {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`
}

const handleCancel = () => {
  emit('update:visible', false)
  emit('cancel')
}

const handleEnter = (e: KeyboardEvent) => {
  // Shift+Enter 换行：保留默认行为
  if (e.shiftKey) return
  e.preventDefault()
  void handleSubmit()
}

const handleSubmit = async () => {
  if (submitting.value) return
  const trimmed = editContent.value.trim()
  // 空内容或未改动：直接取消
  if (!trimmed || trimmed === props.originalContent) {
    handleCancel()
    return
  }
  submitting.value = true
  try {
    const newEventId = await matrixMessageRelationService.editMessage(props.roomId, props.eventId, {
      body: trimmed
    })
    emit('saved', newEventId)
    emit('update:visible', false)
    showFeedback(t('message.edit_success'), 'success')
  } catch (err) {
    logger.error('编辑消息失败:', err)
    showFeedback(t('message.edit_failed'), 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.message-edit-inline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: var(--hula-surface-elevated);
  border: 1px solid var(--hula-color-primary-500);
  border-radius: 8px;
  box-shadow: var(--hula-shadow-floating-menu);
}

.edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--hula-text-tertiary);
}

.edit-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--hula-text-secondary);
  cursor: pointer;

  &:hover {
    background: var(--hula-surface-list-hover);
    color: var(--hula-text-primary);
  }
}

.edit-textarea {
  width: 100%;
  min-height: 36px;
  max-height: 200px;
  padding: 6px 8px;
  border: 1px solid var(--hula-border-default);
  border-radius: 6px;
  background: var(--hula-surface-panel);
  color: var(--hula-text-primary);
  font-size: 13px;
  line-height: 1.4;
  resize: none;
  outline: none;
  font-family: inherit;

  &:focus {
    border-color: var(--hula-color-primary-500);
  }
}

.edit-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.edit-hint {
  font-size: 11px;
  color: var(--hula-text-tertiary);
}

.btn {
  height: 24px;
  padding: 0 10px;
  border: 0;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn--primary {
  background: var(--hula-color-primary-500);
  color: var(--hula-text-inverse);

  &:hover:not(:disabled) {
    background: var(--hula-color-primary-600, var(--hula-color-primary-500));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
