<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('encryption.backup.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="false"
    class="key-backup-dialog"
    style="width: 500px; max-width: 90vw">
    <n-spin :show="loading">
      <n-steps :current="currentStep" :status="stepStatus" size="small">
        <n-step :title="t('encryption.backup.step.status')" />
        <n-step :title="t('encryption.backup.step.setup')" />
        <n-step :title="t('encryption.backup.step.complete')" />
      </n-steps>

      <div class="step-content mt-20px">
        <template v-if="currentStep === 1">
          <n-flex vertical :size="16">
            <div class="status-card">
              <n-flex align="center" :size="12">
                <n-icon size="24" :color="backupStatus.hasBackup ? '#18a058' : '#f0a020'">
                  <svg><use :href="backupStatus.hasBackup ? '#check-circle' : '#warning'" /></svg>
                </n-icon>
                <n-flex vertical :size="4">
                  <span class="text-14px font-medium">
                    {{ backupStatus.hasBackup ? t('encryption.backup.has_backup') : t('encryption.backup.no_backup') }}
                  </span>
                  <span v-if="backupStatus.hasBackup" class="text-12px text-gray-500">
                    {{ t('encryption.backup.keys_count', { count: backupStatus.count }) }}
                  </span>
                </n-flex>
              </n-flex>
            </div>

            <n-flex :size="12" vertical>
              <n-button block @click="handleCreateBackup">
                {{ t('encryption.backup.create_new') }}
              </n-button>
              <n-button v-if="backupStatus.hasBackup" block @click="handleRestoreBackup">
                {{ t('encryption.backup.restore') }}
              </n-button>
            </n-flex>
          </n-flex>
        </template>

        <template v-else-if="currentStep === 2">
          <n-flex vertical :size="16">
            <template v-if="mode === 'create'">
              <n-alert type="info" :title="t('encryption.backup.recovery_key_title')">
                {{ t('encryption.backup.recovery_key_desc') }}
              </n-alert>

              <n-flex vertical :size="8">
                <span class="text-14px text-gray-500">{{ t('encryption.backup.your_key') }}</span>
                <div class="recovery-key-display">
                  <code>{{ recoveryKey }}</code>
                </div>
                <n-flex :size="8">
                  <n-button size="small" @click="handleCopyKey">
                    <template #icon>
                      <n-icon>
                        <svg><use href="#copy" /></svg>
                      </n-icon>
                    </template>
                    {{ t('encryption.backup.copy_key') }}
                  </n-button>
                  <n-button size="small" @click="handleDownloadKey">
                    <template #icon>
                      <n-icon>
                        <svg><use href="#download" /></svg>
                      </n-icon>
                    </template>
                    {{ t('encryption.backup.download_key') }}
                  </n-button>
                </n-flex>
              </n-flex>

              <n-checkbox v-model:checked="keySaved">
                {{ t('encryption.backup.key_saved_confirm') }}
              </n-checkbox>
            </template>

            <template v-else-if="mode === 'restore'">
              <n-flex vertical :size="12">
                <span class="text-14px text-gray-500">{{ t('encryption.backup.enter_key') }}</span>
                <n-input
                  v-model:value="restoreKey"
                  type="textarea"
                  :placeholder="t('encryption.backup.key_placeholder')"
                  :autosize="{ minRows: 3, maxRows: 5 }" />
              </n-flex>
            </template>
          </n-flex>
        </template>

        <template v-else-if="currentStep === 3">
          <n-result
            :status="operationSuccess ? 'success' : 'error'"
            :title="operationSuccess ? t('encryption.backup.success') : t('encryption.backup.failed')"
            :description="operationSuccess ? successMessage : t('encryption.backup.failed_desc')">
            <template #footer>
              <n-button type="primary" @click="handleClose">
                {{ t('common.close') }}
              </n-button>
            </template>
          </n-result>
        </template>
      </div>
    </n-spin>

    <template #footer>
      <n-flex justify="end" :size="12">
        <n-button v-if="currentStep > 1 && currentStep < 3" @click="handleBack">
          {{ t('common.back') }}
        </n-button>
        <n-button
          v-if="currentStep === 2"
          type="primary"
          :disabled="!canProceed"
          :loading="processing"
          @click="handleProceed">
          {{ mode === 'create' ? t('encryption.backup.confirm_create') : t('encryption.backup.confirm_restore') }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { useI18n } from 'vue-i18n'
import { matrixEncryptionService } from '@/services/matrix/crypto/MatrixEncryptionService'

const { t } = useI18n()

const visible = defineModel<boolean>('show', { default: false })

const loading = ref(false)
const processing = ref(false)
const currentStep = ref(1)
const stepStatus = ref<'process' | 'finish' | 'error' | 'wait'>('process')
const mode = ref<'create' | 'restore'>('create')
const backupStatus = ref({
  hasBackup: false,
  count: 0
})
const recoveryKey = ref('')
const restoreKey = ref('')
const keySaved = ref(false)
const operationSuccess = ref(false)
const successMessage = ref('')

const canProceed = computed(() => {
  if (mode.value === 'create') {
    return keySaved.value
  } else {
    return restoreKey.value.trim().length > 0
  }
})

const loadBackupStatus = async () => {
  loading.value = true
  try {
    const info = await matrixEncryptionService.getKeyBackupInfo()
    backupStatus.value = {
      hasBackup: !!info,
      count: info?.count || 0
    }
  } catch (err) {
    backupStatus.value = { hasBackup: false, count: 0 }
  } finally {
    loading.value = false
  }
}

const handleCreateBackup = () => {
  mode.value = 'create'
  currentStep.value = 2
  recoveryKey.value = generateRecoveryKey()
}

const handleRestoreBackup = () => {
  mode.value = 'restore'
  currentStep.value = 2
  restoreKey.value = ''
}

const generateRecoveryKey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let key = ''
  for (let i = 0; i < 64; i++) {
    if (i > 0 && i % 8 === 0) key += ' '
    key += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return key
}

const handleCopyKey = async () => {
  try {
    await navigator.clipboard.writeText(recoveryKey.value)
    window.$message.success(t('encryption.backup.copy_success'))
  } catch (err) {
    window.$message.error(t('encryption.backup.copy_failed'))
  }
}

const handleDownloadKey = async () => {
  try {
    const filePath = await save({
      defaultPath: `recovery-key-${Date.now()}.txt`,
      filters: [{ name: 'Text', extensions: ['txt'] }]
    })

    if (filePath) {
      await writeTextFile(filePath, recoveryKey.value)
      window.$message.success(t('encryption.backup.download_success'))
    }
  } catch (err) {
    window.$message.error(t('encryption.backup.download_failed'))
  }
}

const handleProceed = async () => {
  processing.value = true

  try {
    if (mode.value === 'create') {
      await matrixEncryptionService.setupKeyBackup(recoveryKey.value)
      successMessage.value = t('encryption.backup.create_success')
    } else {
      const result = await matrixEncryptionService.restoreFromBackup(restoreKey.value)
      successMessage.value = t('encryption.backup.restore_success', {
        imported: result.imported,
        total: result.total
      })
    }

    operationSuccess.value = true
    currentStep.value = 3
    stepStatus.value = 'finish'
  } catch (err) {
    operationSuccess.value = false
    currentStep.value = 3
    stepStatus.value = 'error'
  } finally {
    processing.value = false
  }
}

const handleBack = () => {
  currentStep.value--
  stepStatus.value = 'process'
}

const handleClose = () => {
  visible.value = false
  resetState()
}

const resetState = () => {
  currentStep.value = 1
  stepStatus.value = 'process'
  recoveryKey.value = ''
  restoreKey.value = ''
  keySaved.value = false
  operationSuccess.value = false
  successMessage.value = ''
}

watch(visible, (val) => {
  if (val) {
    loadBackupStatus()
  } else {
    resetState()
  }
})
</script>

<style scoped lang="scss">
.key-backup-dialog {
  :deep(.n-card-header) {
    padding: 16px 20px;
  }

  :deep(.n-card__content) {
    padding: 16px 20px;
  }

  :deep(.n-card__footer) {
    padding: 12px 20px;
    border-top: 1px solid var(--hula-border-default);
  }
}

.status-card {
  padding: 16px;
  border-radius: 8px;
  background: var(--hula-surface-panel);
  border: 1px solid var(--hula-border-default);
}

.recovery-key-display {
  padding: 12px 16px;
  background: var(--hula-surface-panel);
  border-radius: 8px;
  border: 1px solid var(--hula-border-default);
  word-break: break-all;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.6;
}
</style>
