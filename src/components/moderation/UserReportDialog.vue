<template>
  <n-modal v-model:show="visible" preset="card" :title="t('moderation.report_user.title')" style="width: 520px">
    <div class="user-report-dialog">
      <!-- 被举报用户预览 -->
      <div v-if="userId" class="user-preview">
        <div class="preview-label">{{ t('moderation.report_user.user_preview') }}</div>
        <div class="preview-content">
          <span v-if="userDisplayName" class="preview-name">{{ userDisplayName }}</span>
          <span class="preview-userid">{{ userId }}</span>
        </div>
      </div>

      <n-divider v-if="userId" style="margin: 12px 0" />

      <!-- 举报表单 -->
      <n-form :model="form" :rules="rules">
        <n-form-item :label="t('moderation.report_user.reason')" path="reason">
          <n-select
            v-model:value="form.reason"
            :options="reasonOptions"
            :placeholder="t('moderation.report_user.reason_placeholder')"
            data-testid="user-report-reason" />
        </n-form-item>
        <n-form-item :label="t('moderation.report_user.comment')" path="comment">
          <n-input
            v-model:value="form.comment"
            type="textarea"
            :rows="3"
            :placeholder="t('moderation.report_user.comment_placeholder')" />
        </n-form-item>
      </n-form>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <n-button data-testid="user-report-cancel" @click="handleClose">
          {{ t('common.cancel') }}
        </n-button>
        <n-button
          type="error"
          data-testid="user-report-submit"
          :loading="submitting"
          :disabled="!form.reason"
          @click="handleSubmit">
          <template #icon>
            <n-icon><Icon icon="mdi:flag" /></n-icon>
          </template>
          {{ t('moderation.report_user.submit') }}
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
import { adminService } from '@/services/matrix/admin/AdminFacadeService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('UserReportDialog')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const props = defineProps<{
  show: boolean
  userId: string
  userDisplayName?: string
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
    message: () => t('moderation.report_user.reason_required')
  }
}

const reasonOptions = computed(() => [
  { label: t('moderation.report_user.reason_spam'), value: 'spam' },
  { label: t('moderation.report_user.reason_abuse'), value: 'abuse' },
  { label: t('moderation.report_user.reason_inappropriate'), value: 'inappropriate' },
  { label: t('moderation.report_user.reason_other'), value: 'other' }
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
    showFeedback(t('moderation.report_user.reason_required'), 'warning')
    return
  }
  submitting.value = true
  try {
    await adminService.reportUser(props.userId, form.reason)
    showFeedback(t('moderation.report_user.success'), 'success')
    visible.value = false
    emit('reported')
  } catch (e) {
    logger.error('举报用户失败', e)
    showFeedback(t('moderation.report_user.failed'), 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.user-report-dialog {
  .user-preview {
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
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .preview-name {
      font-weight: 500;
      color: var(--tjg-text-primary);
    }

    .preview-userid {
      color: var(--tjg-text-tertiary);
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
