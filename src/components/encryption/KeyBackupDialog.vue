<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('encryption.backup.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="false"
    class="key-backup-dialog"
    style="width: 600px; max-width: 90vw">
    <n-spin :show="loading">
      <n-steps :current="currentStep" :status="stepStatus" size="small">
        <n-step :title="t('encryption.backup.step.status')" />
        <n-step :title="t('encryption.backup.step.setup')" />
        <n-step :title="t('encryption.backup.step.complete')" />
      </n-steps>

      <div class="step-content mt-20px">
        <template v-if="currentStep === 1">
          <n-flex vertical :size="16">
            <!-- Status section -->
            <div class="status-card">
              <n-flex align="center" :size="12">
                <n-icon
                  size="24"
                  :color="backupStatus.hasBackup ? 'var(--hula-color-success-500)' : 'var(--hula-color-warning-500)'">
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

            <!-- Version Management section -->
            <div v-if="backupVersions.length > 0" class="version-section">
              <div class="section-label">{{ t('encryption.backup.versions.title') }}</div>
              <n-flex vertical :size="8">
                <div v-for="ver in backupVersions" :key="ver.version" class="version-item">
                  <n-flex align="center" justify="space-between">
                    <n-flex vertical :size="2">
                      <span class="text-13px font-medium">
                        {{ t('encryption.backup.versions.version') }} {{ ver.version }}
                      </span>
                      <span class="text-11px text-gray-500">{{ ver.algorithm }}</span>
                    </n-flex>
                    <n-flex :size="8" align="center">
                      <n-button size="tiny" quaternary @click="handleViewVersionDetail(ver.version)">
                        <template #icon>
                          <Icon icon="mdi:eye-outline" />
                        </template>
                      </n-button>
                      <n-popconfirm @positive-click="handleDeleteVersion(ver.version)">
                        <template #trigger>
                          <n-button size="tiny" quaternary type="error">
                            <template #icon>
                              <Icon icon="mdi:delete-outline" />
                            </template>
                          </n-button>
                        </template>
                        {{ t('encryption.backup.versions.delete_confirm') }}
                      </n-popconfirm>
                    </n-flex>
                  </n-flex>
                </div>
              </n-flex>
            </div>

            <!-- Actions -->
            <n-flex :size="12" vertical>
              <n-button block @click="handleCreateBackup">
                {{ t('encryption.backup.create_new') }}
              </n-button>
              <n-button v-if="backupStatus.hasBackup" block @click="handleRestoreBackup">
                {{ t('encryption.backup.restore') }}
              </n-button>

              <!-- Export / Import / Verify buttons -->
              <n-flex :size="8">
                <n-button flex="1" secondary :loading="exporting" @click="handleExportKeys">
                  <template #icon>
                    <Icon icon="mdi:export" />
                  </template>
                  {{ t('encryption.backup.export_keys') }}
                </n-button>
                <n-button flex="1" secondary @click="triggerImportFile">
                  <template #icon>
                    <Icon icon="mdi:import" />
                  </template>
                  {{ t('encryption.backup.import_keys') }}
                </n-button>
              </n-flex>
              <n-button
                v-if="backupStatus.hasBackup && currentBackupVersion"
                block
                secondary
                :loading="verifying"
                @click="handleVerifyBackup">
                <template #icon>
                  <Icon icon="mdi:shield-check-outline" />
                </template>
                {{ t('encryption.backup.verify_backup') }}
              </n-button>
            </n-flex>

            <!-- Import file input (hidden) -->
            <input ref="importFileInput" type="file" accept=".json" class="hidden" @change="handleImportFileChange" />
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

              <n-flex vertical :size="8">
                <span class="text-14px text-gray-500">{{ t('setting.account.current_password') }}</span>
                <n-input
                  v-model:value="currentPassword"
                  type="password"
                  show-password-on="click"
                  :placeholder="t('setting.account.current_password_placeholder')" />
                <span class="text-12px text-gray-500">{{ t('encryption.onboarding.current_password_hint') }}</span>
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

    <!-- Version detail modal -->
    <n-modal
      v-model:show="versionDetailVisible"
      preset="card"
      :title="t('encryption.backup.versions.detail_title')"
      :bordered="false"
      style="width: 460px; max-width: 90vw">
      <n-spin :show="versionDetailLoading">
        <n-descriptions v-if="versionDetail" bordered :column="1" label-placement="left" size="small">
          <n-descriptions-item :label="t('encryption.backup.versions.version')">
            {{ versionDetail.version }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('encryption.backup.versions.algorithm')">
            {{ versionDetail.algorithm }}
          </n-descriptions-item>
          <n-descriptions-item v-if="versionDetail.count != null" :label="t('encryption.backup.versions.key_count')">
            {{ versionDetail.count }}
          </n-descriptions-item>
          <n-descriptions-item v-if="versionDetail.etag" label="ETag">
            {{ versionDetail.etag }}
          </n-descriptions-item>
        </n-descriptions>
      </n-spin>
    </n-modal>

    <!-- Verify result modal -->
    <n-modal
      v-model:show="verifyResultVisible"
      preset="card"
      :title="t('encryption.backup.verify_result.title')"
      :bordered="false"
      style="width: 460px; max-width: 90vw">
      <n-descriptions v-if="verifyResult" bordered :column="1" label-placement="left" size="small">
        <n-descriptions-item :label="t('encryption.backup.verify_result.status')">
          <n-tag :type="verifyResult.valid ? 'success' : 'error'" size="small">
            {{
              verifyResult.valid
                ? t('encryption.backup.verify_result.valid')
                : t('encryption.backup.verify_result.invalid')
            }}
          </n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('encryption.backup.versions.algorithm')">
          {{ verifyResult.algorithm }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('encryption.backup.versions.key_count')">
          {{ verifyResult.key_count }}
        </n-descriptions-item>
      </n-descriptions>
    </n-modal>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useEncryption } from '@/composables/encryption'
import matrixCryptoService from '@/services/matrix/crypto/MatrixCryptoService'
import type { BackupVersion, VerifyResult } from '@/services/matrix/crypto/MatrixKeyBackupService'
import { matrixKeyBackupService } from '@/services/matrix/crypto/MatrixKeyBackupService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import type { GeneratedSecretStorageKey } from '@/types/matrix-extensions'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const encryption = useEncryption()

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
const generatedRecoveryKey = ref<GeneratedSecretStorageKey | null>(null)
const currentPassword = ref('')
const restoreKey = ref('')
const keySaved = ref(false)
const operationSuccess = ref(false)
const successMessage = ref('')

// Version management
const backupVersions = ref<BackupVersion[]>([])
const currentBackupVersion = ref<string | null>(null)

// Version detail
const versionDetailVisible = ref(false)
const versionDetailLoading = ref(false)
const versionDetail = ref<BackupVersion | null>(null)

// Export / Import
const exporting = ref(false)
const importing = ref(false)
const importFileInput = ref<HTMLInputElement | null>(null)

// Verify
const verifying = ref(false)
const verifyResultVisible = ref(false)
const verifyResult = ref<VerifyResult | null>(null)

const canProceed = computed(() => {
  if (mode.value === 'create') {
    return keySaved.value && currentPassword.value.trim().length > 0
  } else {
    return restoreKey.value.trim().length > 0
  }
})

const loadBackupStatus = async () => {
  loading.value = true
  try {
    const info = await encryption.getKeyBackupInfo()
    backupStatus.value = {
      hasBackup: !!info,
      count: info?.count || 0
    }
    if (info?.version) {
      currentBackupVersion.value = info.version
    }
    // Load backup versions
    await loadBackupVersions()
  } catch (err) {
    backupStatus.value = { hasBackup: false, count: 0 }
  } finally {
    loading.value = false
  }
}

const loadBackupVersions = async () => {
  try {
    const versions = await matrixKeyBackupService.getBackupVersions()
    backupVersions.value = versions.map((v) => ({
      version: v.version,
      algorithm: v.algorithm,
      auth_data: v.auth_data
    }))
  } catch {
    backupVersions.value = []
  }
}

const handleViewVersionDetail = async (version: string) => {
  versionDetailLoading.value = true
  versionDetailVisible.value = true
  try {
    const detail = await matrixKeyBackupService.getBackupVersion(version)
    versionDetail.value = detail
  } catch {
    showFeedback(t('encryption.backup.versions.detail_failed'), 'error')
    versionDetailVisible.value = false
  } finally {
    versionDetailLoading.value = false
  }
}

const handleDeleteVersion = async (version: string) => {
  try {
    await matrixKeyBackupService.deleteBackupVersion(version)
    showFeedback(t('encryption.backup.versions.delete_success'), 'success')
    await loadBackupStatus()
  } catch {
    showFeedback(t('encryption.backup.versions.delete_failed'), 'error')
  }
}

const handleExportKeys = async () => {
  exporting.value = true
  try {
    const result = await matrixKeyBackupService.exportKeys()
    const jsonStr = JSON.stringify(result, null, 2)
    const filePath = await save({
      defaultPath: `key-backup-${Date.now()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (filePath) {
      await writeTextFile(filePath, jsonStr)
      showFeedback(t('encryption.backup.export_success'), 'success')
    }
  } catch {
    showFeedback(t('encryption.backup.export_failed'), 'error')
  } finally {
    exporting.value = false
  }
}

const triggerImportFile = async () => {
  try {
    const filePath = await open({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      multiple: false
    })
    if (filePath) {
      await performImport(filePath as string)
    }
  } catch {
    // User cancelled dialog
  }
}

const performImport = async (filePath: string) => {
  importing.value = true
  try {
    const content = await readTextFile(filePath)
    const keys = JSON.parse(content)
    const result = await matrixKeyBackupService.importKeys(keys)
    showFeedback(
      t('encryption.backup.import_success', { count: result.count, total: result.total }),
      result.failed > 0 ? 'warning' : 'success'
    )
    await loadBackupStatus()
  } catch {
    showFeedback(t('encryption.backup.import_failed'), 'error')
  } finally {
    importing.value = false
  }
}

const handleImportFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  importing.value = true
  try {
    const content = await file.text()
    const keys = JSON.parse(content)
    const result = await matrixKeyBackupService.importKeys(keys)
    showFeedback(
      t('encryption.backup.import_success', { count: result.count, total: result.total }),
      result.failed > 0 ? 'warning' : 'success'
    )
    await loadBackupStatus()
  } catch {
    showFeedback(t('encryption.backup.import_failed'), 'error')
  } finally {
    importing.value = false
    target.value = ''
  }
}

const handleVerifyBackup = async () => {
  if (!currentBackupVersion.value) return
  verifying.value = true
  try {
    const result = await matrixKeyBackupService.verifyBackup(currentBackupVersion.value)
    verifyResult.value = result
    verifyResultVisible.value = true
  } catch {
    showFeedback(t('encryption.backup.verify_failed'), 'error')
  } finally {
    verifying.value = false
  }
}

const handleCreateBackup = async () => {
  mode.value = 'create'
  processing.value = true
  try {
    await matrixClientService.waitForClientReady({ timeoutMs: 10000 })
    const generatedKey = await matrixCryptoService.createRecoveryKeyFromPassphrase()
    if (!generatedKey?.encodedPrivateKey) {
      throw new Error('Failed to generate recovery key')
    }
    generatedRecoveryKey.value = generatedKey
    recoveryKey.value = generatedKey.encodedPrivateKey
    currentStep.value = 2
  } catch {
    showFeedback(t('encryption.backup.failed_desc'), 'error')
  } finally {
    processing.value = false
  }
}

const handleRestoreBackup = () => {
  mode.value = 'restore'
  currentStep.value = 2
  restoreKey.value = ''
}

const handleCopyKey = async () => {
  try {
    await navigator.clipboard.writeText(recoveryKey.value)
    showFeedback(t('encryption.backup.copy_success'), 'success')
  } catch (err) {
    showFeedback(t('encryption.backup.copy_failed'), 'error')
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
      showFeedback(t('encryption.backup.download_success'), 'success')
    }
  } catch (err) {
    showFeedback(t('encryption.backup.download_failed'), 'error')
  }
}

const handleProceed = async () => {
  processing.value = true

  try {
    if (mode.value === 'create') {
      if (!currentPassword.value.trim()) {
        showFeedback(t('setting.account.current_password_required'), 'warning')
        return
      }
      if (!generatedRecoveryKey.value) {
        throw new Error('Missing generated recovery key')
      }
      await encryption.setupKeyBackup({
        password: currentPassword.value.trim(),
        generatedKey: generatedRecoveryKey.value
      })
      successMessage.value = t('encryption.backup.create_success')
    } else {
      const result = await encryption.restoreFromBackup(restoreKey.value)
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
  generatedRecoveryKey.value = null
  currentPassword.value = ''
  restoreKey.value = ''
  keySaved.value = false
  operationSuccess.value = false
  successMessage.value = ''
  backupVersions.value = []
  currentBackupVersion.value = null
  versionDetailVisible.value = false
  versionDetail.value = null
  verifyResultVisible.value = false
  verifyResult.value = null
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

.version-section {
  padding: 12px;
  border-radius: 8px;
  background: var(--hula-surface-panel);
  border: 1px solid var(--hula-border-default);
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--hula-text-tertiary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.version-item {
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--hula-surface-raised);
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
