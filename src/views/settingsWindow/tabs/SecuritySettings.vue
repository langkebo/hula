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
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import KeyBackupSetupDialog from '@/components/encryption/KeyBackupSetupDialog.vue'
import SecureBackupDialog from '@/components/encryption/SecureBackupDialog.vue'
import SecurityKeySetupDialog from '@/components/encryption/SecurityKeySetupDialog.vue'
import InvitePermissionPanel from '@/components/settings/InvitePermissionPanel.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useWindowSessionReady } from '@/composables/common/useWindowSessionReady'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixKeyBackupService } from '@/services/matrix/crypto/MatrixKeyBackupService'
import { useEncryptionStore } from '@/stores/domains/settings/encryption'
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
const encryptionStore = useEncryptionStore()
const { ensureSessionReady } = useWindowSessionReady()

// 加密相关状态：弹窗可见性 + 备份信息（需传给 EncryptionStatusSection）
const showBackupDialog = ref(false)
const showSecurityKeyDialog = ref(false)
const showSecureBackupDialog = ref(false)
const backupLoading = ref(false)
const exportLoading = ref(false)
const hasBackup = ref(false)
const backupInfo = ref<{ version: string | null; count: number } | null>(null)

const encryptionEnabled = computed(() => encryptionStore.encryptionEnabled)
const securityKeyConfigured = computed(() => encryptionStore.securityKeyConfigured)

onMounted(async () => {
  // 本页是独立 Tauri WebView 的一页，MatrixClient 需要先恢复才能读加密/备份状态。
  // 恢复统一走 `useWindowSessionReady()`（幂等、每窗口一次）：入口在 SettingsPage，
  // 此处只是 wait 同一次 in-flight，不再自带 waitForClientReady(15s)。
  const sessionState = await ensureSessionReady()
  logger.info(`[SecuritySettings] session state=${sessionState}; loading encryption status and backup info`)

  await encryptionStore.loadEncryptionStatus()
  await loadBackupInfo()
})

// 加载密钥备份信息（用于 EncryptionStatusSection 的备份状态展示）
async function loadBackupInfo() {
  if (!encryptionEnabled.value) return

  try {
    const info = await matrixKeyBackupService.checkKeyBackup()
    hasBackup.value = !!info
    backupInfo.value = info ? { version: info.version, count: info.count ?? 0 } : null
  } catch (error) {
    logger.error('Failed to fetch backup info', error)
  }
}

// 安全密钥创建成功回调（由 SecurityKeySetupDialog 触发）
function handleSecurityKeyCreated() {
  encryptionStore.markSecurityKeyConfigured()
  showFeedback(t('setting.security.security_key_created'), 'success')
}

function handleSetupBackup() {
  showBackupDialog.value = true
}

// 备份创建成功回调：刷新备份信息并反馈
async function handleBackupSuccess() {
  await loadBackupInfo()
  showFeedback(t('setting.security.backup_setup_success'), 'success')
}

// 导出恢复密钥：通过 cryptoSDKAdapter 导出 keys JSON 并下载
async function handleExportKey() {
  if (!encryptionEnabled.value) {
    showFeedback(t('setting.security.enable_encryption_first'), 'warning')
    return
  }

  exportLoading.value = true
  try {
    const keysResult = await cryptoSDKAdapter.exportKeys()
    const keysJson = keysResult.data

    const blob = new Blob([keysJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tjg-keys-backup-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showFeedback(t('setting.security.keys_exported'), 'success')
  } catch (error) {
    logger.error('Failed to export recovery key', error)
    showFeedback(t('setting.security.export_key_failed'), 'error')
  } finally {
    exportLoading.value = false
  }
}
</script>

<style scoped>
.security-settings {
  padding: 0 var(--tjg-space-2);
}
</style>
