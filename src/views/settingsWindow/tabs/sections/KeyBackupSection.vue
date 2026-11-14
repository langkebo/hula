<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.encryption.backup_section') }}</h3>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.encryption.backup_enable_label') }}</span>
        <span class="setting-desc">{{ t('setting.encryption.backup_enable_desc') }}</span>
      </div>
      <n-switch :value="backupEnabled" :disabled="!encryptionEnabled" @update:value="handleBackupToggle" />
    </div>
    <div v-if="backupEnabled && encryptionEnabled" class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.encryption.backup_version_label') }}</span>
        <span class="setting-desc">
          {{ t('setting.encryption.backup_version_desc', { version: backupVersion }) }}
        </span>
      </div>
      <n-button size="small" :loading="createBackupLoading" @click="showBackupDialog = true">
        {{ t('setting.encryption.create_backup') }}
      </n-button>
    </div>
    <div v-if="backupEnabled && encryptionEnabled" class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.encryption.restore_key_label') }}</span>
        <span class="setting-desc">{{ t('setting.encryption.restore_key_desc') }}</span>
      </div>
      <n-button size="small" @click="showRestoreDialog = true">{{ t('setting.encryption.restore') }}</n-button>
    </div>

    <KeyBackupSetupDialog v-model:show="showBackupDialog" @success="handleBackupCreated" />
    <KeyBackupRestoreDialog v-model:show="showRestoreDialog" @success="handleRestoreSuccess" />
  </div>
</template>

<script setup lang="ts">
/**
 * 安全备份区（开关 / 新建 / 恢复）。
 *
 * 为什么独立成组件：`EncryptionSettings.vue` 属 check:file-size 超限文件
 * （baseline 677 行，棘轮只许缩不许增）。按本仓既有约定（`tabs/sections/*.vue`）
 * 把整段及异步动作一并抽出，父组件只保留一行 tag。
 */
import { NButton, NSwitch, useDialog } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import KeyBackupRestoreDialog from '@/components/encryption/KeyBackupRestoreDialog.vue'
import KeyBackupSetupDialog from '@/components/encryption/KeyBackupSetupDialog.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useEncryptionSettings } from '@/composables/encryption/useEncryptionSettings'
import { matrixKeyBackupService } from '@/services/matrix/crypto/MatrixKeyBackupService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('KeyBackupSection')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const dialog = useDialog()
const { encryptionEnabled, backupEnabled, backupVersion, refreshBackup } = useEncryptionSettings()

const showBackupDialog = ref(false)
const showRestoreDialog = ref(false)
const createBackupLoading = ref(false)

// 开关值只由 encryptionStore.backupEnabled（matrixKeyBackupService.checkKeyBackup 的服务器状态）决定。
// 打开走设置向导；关闭删除服务器上的备份版本（需二次确认，旧密钥将不可恢复）。
function handleBackupToggle(value: boolean) {
  if (!encryptionEnabled.value) {
    showFeedback(t('setting.encryption.enable_required'), 'warning')
    return
  }

  if (value) {
    showBackupDialog.value = true
    return
  }

  if (!backupVersion.value) {
    showFeedback(t('setting.encryption.backup_disable_unavailable'), 'warning')
    return
  }

  dialog.warning({
    title: t('setting.encryption.backup_disable_title'),
    content: t('setting.encryption.backup_disable_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await matrixKeyBackupService.deleteKeyBackupVersion(backupVersion.value as string)
        await refreshBackup()
        showFeedback(t('setting.encryption.backup_disabled_feedback'), 'success')
      } catch (error) {
        logger.error('Failed to delete key backup version:', error)
        showFeedback(t('setting.encryption.backup_disable_failed'), 'error')
      }
    }
  })
}

async function handleBackupCreated() {
  // 备份版本以服务器状态为准（此前用 Date.now() 伪造版本号，界面会展示假版本）
  await refreshBackup()
  showFeedback(t('setting.encryption.backup_created'), 'success')
}

async function handleRestoreSuccess() {
  // 恢复后备份状态同样以服务器为准（与移动端 onKeyBackupComplete 一致）
  await refreshBackup()
  showFeedback(t('setting.encryption.restore_success'), 'success')
}
</script>

<style scoped>
/* 与父页（EncryptionSettings）保持同一套 token 与类名 */
.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-4);
  color: var(--tjg-text-primary);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-3) 0;
  border-bottom: 1px solid var(--tjg-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.setting-label {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}

.setting-desc {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}
</style>
