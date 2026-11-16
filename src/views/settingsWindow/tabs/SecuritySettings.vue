<template>
  <div class="security-settings">
    <!-- 加密状态与恢复密钥管理：弹窗状态由主组件持有（跨 section 共享） -->
    <EncryptionStatusSection
      :encryption-enabled="encryptionEnabled"
      :security-key-configured="securityKeyConfigured"
      :has-backup="hasBackup"
      :backup-info="backupInfo"
      :backup-loading="backupLoading"
      :export-loading="exportLoading"
      @setup-backup="handleSetupBackup"
      @export-key="handleExportKey"
      @manage-security-key="showSecurityKeyDialog = true"
      @manage-secure-backup="showSecureBackupDialog = true" />

    <n-divider />

    <PrivacySettingsSection />

    <n-divider />

    <ThreePidSection />

    <n-divider />

    <IgnoredUsersSection />

    <n-divider />

    <BlockedUsersSection />

    <n-divider />

    <n-card :title="t('setting.invite_permission.title')" class="settings-card">
      <InvitePermissionPanel />
    </n-card>

    <KeyBackupSetupDialog v-model:show="showBackupDialog" @success="handleBackupSuccess" />
    <SecureBackupDialog v-model:show="showSecureBackupDialog" />
    <SecurityKeySetupDialog v-model:show="showSecurityKeyDialog" @success="handleSecurityKeyCreated" />

    <n-divider />

    <PrivateChatSection />
  </div>
</template>

<script setup lang="ts">
import { NCard, NDivider } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import KeyBackupSetupDialog from '@/components/encryption/KeyBackupSetupDialog.vue'
import SecureBackupDialog from '@/components/encryption/SecureBackupDialog.vue'
import SecurityKeySetupDialog from '@/components/encryption/SecurityKeySetupDialog.vue'
import InvitePermissionPanel from '@/components/settings/InvitePermissionPanel.vue'
import ThreePidSection from '@/components/settings/ThreePidSection.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useWindowSessionReady } from '@/composables/common/useWindowSessionReady'
import { useSecuritySettings } from '@/composables/encryption/useSecuritySettings'
import { createLogger } from '@/utils/Logger'
import BlockedUsersSection from './sections/BlockedUsersSection.vue'
import EncryptionStatusSection from './sections/EncryptionStatusSection.vue'
import IgnoredUsersSection from './sections/IgnoredUsersSection.vue'
import PrivacySettingsSection from './sections/PrivacySettingsSection.vue'
import PrivateChatSection from './sections/PrivateChatSection.vue'

const logger = createLogger('SecuritySettings')

defineOptions({
  name: 'SecuritySettings'
})

const { showFeedback } = useActionFeedback()
const { t } = useI18n()
const { ensureSessionReady } = useWindowSessionReady()
const {
  encryptionEnabled,
  securityKeyConfigured,
  hasBackup,
  backupInfo,
  backupLoading,
  exportLoading,
  refreshEncryptionStatus,
  refreshBackupStatus,
  markSecurityKeyConfigured,
  exportRecoveryKeys
} = useSecuritySettings()

// 弹窗可见性属桌面布局细节，留在组件内；加密/备份状态统一由 useSecuritySettings 提供（与移动端同源）
const showBackupDialog = ref(false)
const showSecurityKeyDialog = ref(false)
const showSecureBackupDialog = ref(false)

onMounted(async () => {
  // 本页是独立 Tauri WebView 的一页，MatrixClient 需要先恢复才能读加密/备份状态。
  // 恢复统一走 `useWindowSessionReady()`（幂等、每窗口一次）：入口在 SettingsPage，
  // 此处只是 wait 同一次 in-flight，不再自带 waitForClientReady(15s)。
  const sessionState = await ensureSessionReady()
  logger.info(`[SecuritySettings] session state=${sessionState}; loading encryption status`)
  await refreshEncryptionStatus()
})

// 安全密钥创建成功回调（由 SecurityKeySetupDialog 触发）
function handleSecurityKeyCreated() {
  markSecurityKeyConfigured()
  showFeedback(t('setting.security.security_key_created'), 'success')
}

function handleSetupBackup() {
  showBackupDialog.value = true
}

// 备份创建成功回调：刷新备份状态并反馈
async function handleBackupSuccess() {
  await refreshBackupStatus()
  showFeedback(t('setting.security.backup_setup_success'), 'success')
}

// 导出恢复密钥：SDK 导出与下载细节统一在 useSecuritySettings → useKeyExport（与移动端共用实现）
async function handleExportKey() {
  try {
    const result = await exportRecoveryKeys(`tjg-keys-backup-${Date.now()}.json`)
    if (!result.ok) {
      if (result.reason === 'encryption-disabled') {
        showFeedback(t('setting.security.enable_encryption_first'), 'warning')
      } else {
        showFeedback(t('setting.security.export_key_failed'), 'error')
      }
      return
    }
    showFeedback(t('setting.security.keys_exported'), 'success')
  } catch (error) {
    logger.error('Failed to export recovery key', error)
    showFeedback(t('setting.security.export_key_failed'), 'error')
  }
}
</script>

<style scoped>
.security-settings {
  padding: 0 var(--tjg-space-2);
}
</style>
