<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('encryption.backup_restore_dialog.title')"
    style="width: 500px"
    :mask-closable="false">
    <n-spin :show="loading">
      <div class="restore-content">
        <div class="intro-text">
          <p>{{ t('encryption.backup_restore_dialog.intro_primary') }}</p>
          <p class="hint-text">{{ t('encryption.backup_restore_dialog.intro_hint') }}</p>
        </div>

        <n-form ref="formRef" :model="formData" label-placement="top">
          <n-form-item :label="t('encryption.backup_restore_dialog.recovery_key_label')" path="recoveryKey">
            <n-input
              v-model:value="formData.recoveryKey"
              type="textarea"
              :placeholder="t('encryption.recovery_key_placeholder')"
              :rows="4"
              :disabled="loading" />
          </n-form-item>
        </n-form>

        <div v-if="restoreProgress !== null" class="progress-section">
          <n-progress type="line" :percentage="restoreProgress" :indicator-placement="'inside'" processing />
          <div class="progress-text">
            {{ t('encryption.backup_restore_dialog.restoring_progress', { progress: restoreProgress }) }}
          </div>
        </div>

        <div v-if="restoreResult" class="result-section" :class="restoreResult.success ? 'success' : 'error'">
          <Icon :icon="restoreResult.success ? 'mdi:check-circle' : 'mdi:alert-circle'" :width="24" />
          <span>{{ restoreResult.message }}</span>
        </div>
      </div>
    </n-spin>

    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" :disabled="loading">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="loading" :disabled="!formData.recoveryKey.trim()" @click="handleRestore">
          {{ t('encryption.restore') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NForm, NFormItem, NInput, NModal, NProgress, NSpin, useMessage } from 'naive-ui'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixEncryptionService } from '@/services/matrix/crypto/MatrixEncryptionService'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'

const logger = createLogger('KeyBackupRestore')
const timerManager = useTimerManager()
const { t } = useI18n()

defineOptions({
  name: 'KeyBackupRestoreDialog'
})

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'success'): void
}>()

const message = useMessage()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

const loading = ref(false)
const restoreProgress = ref<number | null>(null)
const restoreResult = ref<{ success: boolean; message: string } | null>(null)

const formData = reactive({
  recoveryKey: ''
})

function handleCancel() {
  visible.value = false
  resetState()
}

function resetState() {
  formData.recoveryKey = ''
  loading.value = false
  restoreProgress.value = null
  restoreResult.value = null
}

async function handleRestore() {
  if (!formData.recoveryKey.trim()) {
    message.warning(t('encryption.recovery_key_required'))
    return
  }

  loading.value = true
  restoreProgress.value = 0
  restoreResult.value = null
  let progressInterval: number | null = null

  try {
    progressInterval = timerManager.setInterval(() => {
      if (restoreProgress.value !== null && restoreProgress.value < 90) {
        restoreProgress.value += 10
      }
    }, 200)

    const result = await matrixEncryptionService.restoreFromBackup(formData.recoveryKey.trim())

    timerManager.clearInterval(progressInterval)
    restoreProgress.value = 100

    restoreResult.value = {
      success: true,
      message: t('encryption.backup_restore_dialog.restore_result_success', { imported: result.imported })
    }

    message.success(t('encryption.restore_success'))

    timerManager.setTimeout(() => {
      visible.value = false
      resetState()
      emit('success')
    }, 1500)
  } catch (error) {
    logger.error('Failed to restore from backup:', error)
    restoreProgress.value = null
    restoreResult.value = {
      success: false,
      message: t('encryption.backup_restore_dialog.restore_result_failed')
    }
    message.error(t('encryption.restore_backup_failed'))
  } finally {
    if (progressInterval !== null) {
      timerManager.clearInterval(progressInterval)
    }
    loading.value = false
  }
}
</script>

<style scoped>
.restore-content {
  padding: 8px 0;
}

.intro-text {
  margin-bottom: 20px;
}

.intro-text p {
  margin: 4px 0;
}

.hint-text {
  color: var(--color-text-quaternary);
  font-size: 13px;
}

.progress-section {
  margin-top: 16px;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .progress-section {
  background-color: rgba(255, 255, 255, 0.05);
}

.progress-text {
  text-align: center;
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-text-quaternary);
}

.result-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
}

.result-section.success {
  background-color: var(--color-success-light);
  color: var(--color-success);
}

.result-section.error {
  background-color: var(--color-danger-hover);
  color: var(--color-danger);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
