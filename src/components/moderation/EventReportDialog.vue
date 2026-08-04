<template>
  <n-modal v-model:show="visible" preset="card" :title="t('moderation.report.title')" style="width: 520px">
    <div class="event-report-dialog">
      <!-- 事件内容预览 -->
      <div v-if="eventContent" class="event-preview">
        <div class="preview-label">{{ t('moderation.report.event_preview') }}</div>
        <div class="preview-content">{{ eventContent }}</div>
      </div>

      <n-divider v-if="eventContent" style="margin: 12px 0" />

      <!-- 举报表单 -->
      <n-form :model="form" :rules="rules">
        <n-form-item :label="t('moderation.report.reason')" path="reason">
          <n-select
            v-model:value="form.reason"
            :options="reasonOptions"
            :placeholder="t('moderation.report.reason_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('moderation.report.comment')" path="comment">
          <n-input
            v-model:value="form.comment"
            type="textarea"
            :rows="3"
            :placeholder="t('moderation.report.comment_placeholder')" />
        </n-form-item>
      </n-form>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <n-button @click="handleClose">{{ t('common.cancel') }}</n-button>
        <n-button type="error" :loading="submitting" :disabled="!form.reason" @click="handleSubmit">
          <template #icon>
            <n-icon><Icon icon="mdi:flag" /></n-icon>
          </template>
          {{ t('moderation.report.submit') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixEventReportService } from '@/services/matrix/moderation/MatrixEventReportService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('EventReportDialog')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const props = defineProps<{
  show: boolean
  eventId: string
  roomId: string
  eventContent?: string
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'reported'): void
}>()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

const submitting = ref(false)

const form = reactive({
  reason: '' as string,
  comment: ''
})

const rules = {
  reason: {
    required: true,
    message: () => t('moderation.report.reason_required')
  }
}

const reasonOptions = computed(() => [
  { label: t('moderation.report.reason_spam'), value: 'spam' },
  { label: t('moderation.report.reason_abuse'), value: 'abuse' },
  { label: t('moderation.report.reason_inappropriate'), value: 'inappropriate' },
  { label: t('moderation.report.reason_other'), value: 'other' }
])

watch(
  () => props.show,
  (val) => {
    if (val) {
      form.reason = ''
      form.comment = ''
    }
  }
)

function handleClose() {
  visible.value = false
}

async function handleSubmit() {
  if (!form.reason) {
    showFeedback(t('moderation.report.reason_required'), 'warning')
    return
  }
  submitting.value = true
  try {
    await matrixEventReportService.createReport({
      event_id: props.eventId,
      room_id: props.roomId,
      reason: form.reason,
      description: form.comment || undefined
    })
    showFeedback(t('moderation.report.success'), 'success')
    visible.value = false
    emit('reported')
  } catch (e) {
    logger.error('举报事件失败', e)
    showFeedback(t('moderation.report.failed'), 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.event-report-dialog {
  .event-preview {
    .preview-label {
      font-size: 13px;
      color: var(--tjg-text-secondary);
      margin-bottom: 6px;
    }

    .preview-content {
      padding: 10px 12px;
      background: var(--tjg-surface-panel-muted);
      border-radius: 6px;
      font-size: 13px;
      max-height: 120px;
      overflow-y: auto;
      word-break: break-all;
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
