<template>
  <n-modal v-model:show="visible" preset="card" :title="t('moderation.report_room.title')" style="width: 520px">
    <div class="room-report-dialog">
      <!-- 被举报房间预览 -->
      <div v-if="roomId" class="room-preview">
        <div class="preview-label">{{ t('moderation.report_room.room_preview') }}</div>
        <div class="preview-content">
          <span v-if="roomName" class="preview-name">{{ roomName }}</span>
          <span class="preview-roomid">{{ roomId }}</span>
        </div>
      </div>

      <n-divider v-if="roomId" style="margin: 12px 0" />

      <!-- 举报表单 -->
      <n-form :model="form" :rules="rules">
        <n-form-item :label="t('moderation.report_room.reason')" path="reason">
          <n-select
            v-model:value="form.reason"
            :options="reasonOptions"
            :placeholder="t('moderation.report_room.reason_placeholder')"
            data-testid="room-report-reason" />
        </n-form-item>
        <n-form-item :label="t('moderation.report_room.comment')" path="comment">
          <n-input
            v-model:value="form.comment"
            type="textarea"
            :rows="3"
            :placeholder="t('moderation.report_room.comment_placeholder')"
            data-testid="room-report-comment" />
        </n-form-item>
      </n-form>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <n-button data-testid="room-report-cancel" @click="handleClose">
          {{ t('common.cancel') }}
        </n-button>
        <n-button
          type="error"
          data-testid="room-report-submit"
          :loading="submitting"
          :disabled="!form.reason"
          @click="handleSubmit">
          <template #icon>
            <n-icon><Icon icon="mdi:flag" /></n-icon>
          </template>
          {{ t('moderation.report_room.submit') }}
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
import { synapseRustExtensionsService } from '@/services/matrix/SynapseRustExtensionsService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RoomReportDialog')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const props = defineProps<{
  show: boolean
  roomId: string
  roomName?: string
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
    message: () => t('moderation.report_room.reason_required')
  }
}

const reasonOptions = computed(() => [
  { label: t('moderation.report_room.reason_spam'), value: 'spam' },
  { label: t('moderation.report_room.reason_abuse'), value: 'abuse' },
  { label: t('moderation.report_room.reason_inappropriate'), value: 'inappropriate' },
  { label: t('moderation.report_room.reason_other'), value: 'other' }
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
    showFeedback(t('moderation.report_room.reason_required'), 'warning')
    return
  }
  submitting.value = true
  try {
    const description = form.comment.trim() || undefined
    await synapseRustExtensionsService.reportRoom(props.roomId, form.reason, description)
    showFeedback(t('moderation.report_room.success'), 'success')
    visible.value = false
    emit('reported')
  } catch (e) {
    logger.error('举报房间失败', e)
    showFeedback(t('moderation.report_room.failed'), 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.room-report-dialog {
  .room-preview {
    .preview-label {
      font-size: 13px;
      color: var(--hula-text-secondary);
      margin-bottom: 6px;
    }

    .preview-content {
      padding: 10px 12px;
      background: var(--bg-secondary);
      border-radius: 6px;
      font-size: 13px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .preview-name {
      font-weight: 500;
      color: var(--hula-text-primary);
    }

    .preview-roomid {
      color: var(--hula-text-tertiary);
      font-family: monospace;
      font-size: 12px;
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
