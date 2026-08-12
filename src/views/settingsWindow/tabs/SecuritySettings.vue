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

    <InviteListsSection />

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
import { sessionOrchestrator } from '@/services/matrix/auth/SessionOrchestrator'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixKeyBackupService } from '@/services/matrix/crypto/MatrixKeyBackupService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { useEncryptionStore } from '@/stores/domains/settings/encryption'
import { createLogger } from '@/utils/Logger'
import BlockedUsersSection from './sections/BlockedUsersSection.vue'
import EncryptionStatusSection from './sections/EncryptionStatusSection.vue'
import IgnoredUsersSection from './sections/IgnoredUsersSection.vue'
import InviteListsSection from './sections/InviteListsSection.vue'
import PrivacySettingsSection from './sections/PrivacySettingsSection.vue'
import PrivateChatSection from './sections/PrivateChatSection.vue'

const logger = createLogger('SecuritySettings')

defineOptions({
  name: 'SecuritySettings'
})

const { showFeedback } = useActionFeedback()
const { t } = useI18n()
const encryptionStore = useEncryptionStore()

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
  // P0-#3：安全设置窗口是独立 Tauri WebView，MatrixClientService 为新实例。
  // ensureClientReady() 从后端存储的 token 重建客户端，内部通过 store 的
  // loginWithToken → settlePostLoginStartup → startClient 完成客户端启动
  // （含 Rust Crypto 初始化）。必须 await 确保整个流程完成后再加载数据。
  logger.info('[SecuritySettings] onMounted 开始 — 独立 WebView 会话恢复流程启动')

  // ── 步骤 1：ensureClientReady（从后端 token 重建客户端 + loginWithToken + startClient）──
  logger.info('[SecuritySettings] 步骤 1/3: 调用 sessionOrchestrator.ensureClientReady()')
  const t1 = Date.now()
  try {
    await sessionOrchestrator.ensureClientReady()
    logger.info(`[SecuritySettings] 步骤 1/3 完成: ensureClientReady 成功 (${Date.now() - t1}ms)`)
  } catch (err) {
    logger.warn(
      `[SecuritySettings] 步骤 1/3 失败: ensureClientReady 失败 (${Date.now() - t1}ms):`,
      err instanceof Error ? err.message : String(err)
    )
  }

  // ── 步骤 2：waitForClientReady（确保 MatrixClient 实例可用）──
  logger.info('[SecuritySettings] 步骤 2/3: 调用 waitForClientReady({ timeoutMs: 15000 })')
  const t2 = Date.now()
  try {
    await matrixClientService.waitForClientReady({ timeoutMs: 15000 })
    const client = matrixClientService.getClient()
    const userId = matrixClientService.getUserId()
    const deviceId = client?.getDeviceId?.() ?? null
    const cryptoReady = matrixClientService.isCryptoReady()
    logger.info(
      `[SecuritySettings] 步骤 2/3 完成: waitForClientReady 成功 (${Date.now() - t2}ms) — userId=${userId}, deviceId=${deviceId}, cryptoReady=${cryptoReady}`
    )
  } catch (err) {
    logger.warn(
      `[SecuritySettings] 步骤 2/3 失败: waitForClientReady 超时 (${Date.now() - t2}ms):`,
      err instanceof Error ? err.message : String(err)
    )
  }

  // ── 步骤 3：加载加密状态和备份信息（隐私/忽略/屏蔽/邀请列表由各子组件自行加载）──
  logger.info('[SecuritySettings] 步骤 3/3: 加载加密状态与备份信息')
  await encryptionStore.loadEncryptionStatus()
  await loadBackupInfo()
  logger.info('[SecuritySettings] onMounted 全部完成')
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
