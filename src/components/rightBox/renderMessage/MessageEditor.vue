<template>
  <div v-if="visible" class="message-editor">
    <div class="editor-header">
      <span class="edit-label">{{ t('message.editing') }}</span>
      <n-button text @click="handleCancel">
        <template #icon>
          <svg class="size-16px">
            <use href="#close"></use>
          </svg>
        </template>
      </n-button>
    </div>
    <div class="editor-content">
      <n-input
        ref="inputRef"
        v-model:value="editContent"
        type="textarea"
        :autosize="{ minRows: 1, maxRows: 6 }"
        :placeholder="t('message.edit_placeholder')"
        @keydown.enter="handleEnter"
        @keydown.esc="handleCancel" />
    </div>
    <div class="editor-footer">
      <n-button size="small" @click="handleCancel">{{ t('common.cancel') }}</n-button>
      <n-button size="small" type="primary" :loading="saving" @click="handleSave">
        {{ t('common.save') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixMessageRelationService } from '@/services/matrix/messaging/MatrixMessageRelationService'

import { createLogger } from '@/utils/Logger'

const logger = createLogger('MessageEditor')

const props = defineProps<{
  visible: boolean
  roomId: string
  eventId: string
  originalContent: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'saved', newEventId: string): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const inputRef = ref()
const editContent = ref('')
const saving = ref(false)

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      editContent.value = props.originalContent
      nextTick(() => {
        inputRef.value?.focus()
      })
    }
  }
)

const handleEnter = (e: KeyboardEvent) => {
  if (e.shiftKey) return
  e.preventDefault()
  handleSave()
}

const handleCancel = () => {
  emit('update:visible', false)
  emit('cancel')
}

const handleSave = useDebounceFn(async () => {
  if (!editContent.value.trim() || editContent.value === props.originalContent) {
    handleCancel()
    return
  }

  saving.value = true
  try {
    const newEventId = await matrixMessageRelationService.editMessage(props.roomId, props.eventId, {
      body: editContent.value.trim()
    })
    emit('saved', newEventId)
    emit('update:visible', false)
    showFeedback(t('message.edit_success'), 'success')
  } catch (error) {
    logger.error('编辑消息失败:', error)
    showFeedback(t('message.edit_failed'), 'error')
  } finally {
    saving.value = false
  }
}, 300)
</script>

<style scoped lang="scss">
.message-editor {
  @apply flex flex-col gap-8px p-8px bg-[--hula-surface-panel] rounded-8px border-1px border-solid border-[--hula-border-default];
}

.editor-header {
  @apply flex items-center justify-between;
}

.edit-label {
  @apply text-12px color-[--hula-text-tertiary];
}

.editor-content {
  :deep(.n-input) {
    background: transparent;
  }
}

.editor-footer {
  @apply flex justify-end gap-8px;
}
</style>
