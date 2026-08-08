<template>
  <div class="security-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.security.encryption_status') }}</h3>
      <div class="encryption-status">
        <div class="status-icon">
          <Icon
            :icon="encryptionEnabled ? 'mdi:shield-check' : 'mdi:shield-off'"
            :width="48"
            :class="encryptionEnabled ? 'status-secure' : 'status-insecure'" />
        </div>
        <div class="status-info">
          <div class="status-title">
            {{
              encryptionEnabled
                ? t('setting.security.encryption_enabled_title')
                : t('setting.security.encryption_disabled_title')
            }}
          </div>
          <div class="status-desc">
            {{
              encryptionEnabled
                ? t('setting.security.encryption_enabled_desc')
                : t('setting.security.encryption_disabled_desc')
            }}
          </div>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.security.recovery_key') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.security.security_key_label') }}</span>
          <span class="setting-desc">
            {{
              securityKeyConfigured
                ? t('setting.security.security_key_configured_desc')
                : t('setting.security.security_key_not_configured_desc')
            }}
          </span>
        </div>
        <n-button size="small" @click="showSecurityKeyDialog = true">
          {{ securityKeyConfigured ? t('setting.security.manage') : t('setting.security.setup_action') }}
        </n-button>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.security.backup_label') }}</span>
          <span class="setting-desc">{{ backupStatusText }}</span>
        </div>
        <n-button size="small" :loading="backupLoading" @click="handleSetupBackup">
          {{ hasBackup ? t('setting.security.manage_backup') : t('setting.security.setup_backup') }}
        </n-button>
      </div>
      <div v-if="hasBackup" class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.security.export_recovery_key') }}</span>
          <span class="setting-desc">{{ t('setting.security.export_recovery_key_desc') }}</span>
        </div>
        <n-button size="small" :loading="exportLoading" @click="handleExportKey">
          {{ t('setting.security.export') }}
        </n-button>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.security.secure_backup_label') }}</span>
          <span class="setting-desc">{{ t('setting.security.secure_backup_desc') }}</span>
        </div>
        <n-button size="small" @click="showSecureBackupDialog = true">
          {{ t('setting.security.manage') }}
        </n-button>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.security.privacy_settings') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.security.show_online_status') }}</span>
          <span class="setting-desc">{{ t('setting.security.show_online_status_desc') }}</span>
        </div>
        <n-switch v-model:value="showOnlineStatus" @update:value="handleOnlineStatusChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.security.show_typing_status') }}</span>
          <span class="setting-desc">{{ t('setting.security.show_typing_status_desc') }}</span>
        </div>
        <n-switch v-model:value="showTypingStatus" @update:value="handleTypingStatusChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.security.send_read_receipts') }}</span>
          <span class="setting-desc">{{ t('setting.security.send_read_receipts_desc') }}</span>
        </div>
        <n-switch v-model:value="sendReadReceipts" @update:value="handleReadReceiptsChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.security.ignored_users') }}</h3>
      <n-spin :show="loadingIgnored">
        <div v-if="ignoredUsers.length > 0" class="ignored-list">
          <div v-for="user in ignoredUsers" :key="user" class="ignored-item">
            <span class="user-id">{{ user }}</span>
            <n-button size="tiny" @click="handleUnignore(user)">{{ t('setting.security.unignore') }}</n-button>
          </div>
        </div>
        <n-empty v-else :description="t('setting.security.no_ignored_users')" />
      </n-spin>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.security.blocked_users') }}</h3>
      <n-spin :show="loadingBlocked">
        <div v-if="blockedUsers.length > 0" class="ignored-list">
          <div v-for="user in blockedUsers" :key="user" class="ignored-item">
            <span class="user-id">{{ user }}</span>
            <n-button size="tiny" @click="handleUnblock(user)">{{ t('setting.security.unblock') }}</n-button>
          </div>
        </div>
        <n-empty v-else :description="t('setting.security.no_blocked_users')" />
      </n-spin>
      <div style="margin-top: 8px">
        <n-button size="small" @click="showAddBlocked = true">{{ t('setting.security.add_blocked_user') }}</n-button>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.security.invite_lists') }}</h3>
      <n-alert type="info" :show-icon="true" class="invite-lists-alert">
        {{ t('setting.security.invite_lists_info') }}
      </n-alert>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.security.invite_blocklist') }}</span>
          <span class="setting-desc">{{ t('setting.security.invite_blocklist_desc') }}</span>
        </div>
        <n-button size="small" @click="showInviteBlocklist = true">
          {{ t('setting.security.manage') }} ({{ inviteBlocklist.length }})
        </n-button>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.security.invite_allowlist') }}</span>
          <span class="setting-desc">{{ t('setting.security.invite_allowlist_desc') }}</span>
        </div>
        <n-button size="small" @click="showInviteAllowlist = true">
          {{ t('setting.security.manage') }} ({{ inviteAllowlist.length }})
        </n-button>
      </div>
    </div>

    <n-card :title="t('setting.invite_permission.title')" class="settings-card">
      <InvitePermissionPanel />
    </n-card>

    <KeyBackupSetupDialog v-model:show="showBackupDialog" @success="handleBackupSuccess" />

    <SecureBackupDialog v-model:show="showSecureBackupDialog" />

    <SecurityKeySetupDialog v-model:show="showSecurityKeyDialog" @success="handleSecurityKeyCreated" />

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.private_chat.title') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.private_chat.enable') }}</span>
          <span class="setting-desc">{{ t('setting.private_chat.enable_desc') }}</span>
        </div>
        <n-switch v-model:value="secretChatEnabled" @update:value="handleSecretChatEnabledChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.private_chat.password') }}</span>
          <span class="setting-desc">
            {{
              secretChatConfigured
                ? t('setting.security.private_chat_password_configured')
                : t('setting.security.private_chat_password_not_configured')
            }}
          </span>
        </div>
        <n-button size="small" @click="handleSetupSecretChat">
          {{
            secretChatConfigured ? t('setting.private_chat.change_password') : t('setting.private_chat.set_password')
          }}
        </n-button>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.private_chat.hide_sessions') }}</span>
          <span class="setting-desc">{{ t('setting.private_chat.hide_sessions_desc') }}</span>
        </div>
        <n-switch v-model:value="secretChatHideSessions" :disabled="!secretChatEnabled" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.private_chat.auto_lock') }}</span>
          <span class="setting-desc">{{ t('setting.private_chat.auto_lock_desc') }}</span>
        </div>
        <n-switch v-model:value="secretChatAutoLock" :disabled="!secretChatEnabled" />
      </div>
      <div v-if="secretChatAutoLock" class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.private_chat.lock_timeout') }}</span>
          <span class="setting-desc">{{ t('setting.security.private_chat_lock_timeout_desc') }}</span>
        </div>
        <n-select
          v-model:value="secretChatLockTimeout"
          size="small"
          style="width: 140px"
          :options="lockTimeoutOptions" />
      </div>
      <div v-if="secretChatConfigured" class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.private_chat.clear') }}</span>
          <span class="setting-desc">{{ t('setting.private_chat.clear_desc') }}</span>
        </div>
        <n-button size="small" @click="handleClearSecretChat">{{ t('setting.private_chat.clear') }}</n-button>
      </div>
    </div>

    <n-modal
      v-model:show="showSecretChatDialog"
      preset="card"
      :title="t('setting.private_chat.set_password')"
      style="width: 400px">
      <div class="secret-chat-form">
        <n-form :model="secretChatForm" :rules="secretChatRules">
          <n-form-item path="password" :label="t('setting.private_chat.password')">
            <n-input
              v-model:value="secretChatForm.password"
              type="password"
              :placeholder="t('setting.private_chat.password_placeholder')"
              show-password-on="click" />
          </n-form-item>
          <n-form-item path="confirmPassword" :label="t('setting.private_chat.confirm_password')">
            <n-input
              v-model:value="secretChatForm.confirmPassword"
              type="password"
              :placeholder="t('setting.private_chat.confirm_password_placeholder')"
              show-password-on="click" />
          </n-form-item>
        </n-form>
        <div class="dialog-footer">
          <n-button @click="showSecretChatDialog = false">{{ t('setting.common.cancel') }}</n-button>
          <n-button type="primary" @click="handleSaveSecretChat" :loading="savingSecretChat">
            {{ t('setting.common.save') }}
          </n-button>
        </div>
      </div>
    </n-modal>

    <n-modal
      v-model:show="showAddBlocked"
      preset="dialog"
      :title="t('setting.security.add_blocked_user_title')"
      :positive-text="t('setting.security.add')"
      :negative-text="t('setting.common.cancel')"
      @positive-click="handleAddBlocked">
      <n-form>
        <n-form-item :label="t('setting.security.user_id_label')">
          <n-input v-model:value="newBlockedUser" :placeholder="t('setting.security.user_id_placeholder')" />
        </n-form-item>
      </n-form>
    </n-modal>

    <n-modal
      v-model:show="showInviteBlocklist"
      preset="card"
      :title="t('setting.security.invite_blocklist_manage_title')"
      style="width: 450px">
      <div class="list-management">
        <div v-for="user in inviteBlocklist" :key="user" class="ignored-item">
          <span class="user-id">{{ user }}</span>
          <n-button size="tiny" @click="handleRemoveInviteBlocklist(user)">{{ t('setting.security.remove') }}</n-button>
        </div>
        <n-empty v-if="inviteBlocklist.length === 0" :description="t('setting.security.blocklist_empty')" />
        <div style="margin-top: 8px; display: flex; gap: 8px">
          <n-input
            v-model:value="newBlocklistUser"
            :placeholder="t('setting.security.user_id_placeholder')"
            size="small"
            style="flex: 1" />
          <n-button size="small" type="primary" @click="handleAddInviteBlocklist">
            {{ t('setting.security.add') }}
          </n-button>
        </div>
      </div>
    </n-modal>

    <n-modal
      v-model:show="showInviteAllowlist"
      preset="card"
      :title="t('setting.security.invite_allowlist_manage_title')"
      style="width: 450px">
      <div class="list-management">
        <div v-for="user in inviteAllowlist" :key="user" class="ignored-item">
          <span class="user-id">{{ user }}</span>
          <n-button size="tiny" @click="handleRemoveInviteAllowlist(user)">{{ t('setting.security.remove') }}</n-button>
        </div>
        <n-empty v-if="inviteAllowlist.length === 0" :description="t('setting.security.allowlist_empty')" />
        <div style="margin-top: 8px; display: flex; gap: 8px">
          <n-input
            v-model:value="newAllowlistUser"
            :placeholder="t('setting.security.user_id_placeholder')"
            size="small"
            style="flex: 1" />
          <n-button size="small" type="primary" @click="handleAddInviteAllowlist">
            {{ t('setting.security.add') }}
          </n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  NAlert,
  NButton,
  NCard,
  NDivider,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpin,
  NSwitch,
  useDialog
} from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import KeyBackupSetupDialog from '@/components/encryption/KeyBackupSetupDialog.vue'
import SecureBackupDialog from '@/components/encryption/SecureBackupDialog.vue'
import SecurityKeySetupDialog from '@/components/encryption/SecurityKeySetupDialog.vue'
import InvitePermissionPanel from '@/components/settings/InvitePermissionPanel.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAccount } from '@/composables/user/useAccount'
import { sessionOrchestrator } from '@/services/matrix/auth/SessionOrchestrator'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixKeyBackupService } from '@/services/matrix/crypto/MatrixKeyBackupService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { useEncryptionStore } from '@/stores/domains/settings/encryption'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SecuritySettings')

defineOptions({
  name: 'SecuritySettings'
})

const { showFeedback } = useActionFeedback()
const dialog = useDialog()
const { t } = useI18n()
const { getIgnoredUsers, setIgnoredUsers } = useAccount()
const settingStore = useSettingStore()
const encryptionStore = useEncryptionStore()

const loadingIgnored = ref(false)
const ignoredUsers = ref<string[]>([])
const loadingBlocked = ref(false)
const blockedUsers = ref<string[]>([])
const showAddBlocked = ref(false)
const newBlockedUser = ref('')

const showInviteBlocklist = ref(false)
const showInviteAllowlist = ref(false)
const inviteBlocklist = ref<string[]>([])
const inviteAllowlist = ref<string[]>([])
const newBlocklistUser = ref('')
const newAllowlistUser = ref('')

const showBackupDialog = ref(false)
const showSecurityKeyDialog = ref(false)
const showSecureBackupDialog = ref(false)
const backupLoading = ref(false)
const exportLoading = ref(false)
const hasBackup = ref(false)
const backupInfo = ref<{ version: string | null; count: number } | null>(null)

const encryptionEnabled = computed(() => encryptionStore.encryptionEnabled)
const securityKeyConfigured = computed(() => encryptionStore.securityKeyConfigured)

const showOnlineStatus = ref(true)
const showTypingStatus = ref(true)
const sendReadReceipts = ref(true)

const secretChatConfigured = computed(() => settingStore.isSecretChatConfigured())
const secretChatEnabled = computed({
  get: () => settingStore.secretChatEnabled,
  set: (value: boolean) => settingStore.setSecretChatEnabled(value)
})
const secretChatHideSessions = computed({
  get: () => settingStore.secretChatHideSessions,
  set: (value: boolean) => settingStore.setSecretChatHideSessions(value)
})
const secretChatAutoLock = computed({
  get: () => settingStore.secretChatAutoLock,
  set: (value: boolean) => settingStore.setSecretChatAutoLock(value)
})
const secretChatLockTimeout = computed({
  get: () => settingStore.secretChatLockTimeout,
  set: (value: number) => settingStore.setSecretChatLockTimeout(value)
})
const showSecretChatDialog = ref(false)
const savingSecretChat = ref(false)
const secretChatForm = reactive({
  password: '',
  confirmPassword: ''
})
const secretChatRules = {
  password: {
    required: true,
    message: t('setting.private_chat.password_required'),
    trigger: 'blur'
  },
  confirmPassword: {
    required: true,
    message: t('setting.private_chat.confirm_password_required'),
    trigger: 'blur'
  }
}

const lockTimeoutOptions = computed(() => [
  { label: t('setting.private_chat.1_minute'), value: 1 },
  { label: t('setting.private_chat.5_minutes'), value: 5 },
  { label: t('setting.private_chat.15_minutes'), value: 15 },
  { label: t('setting.private_chat.30_minutes'), value: 30 },
  { label: t('setting.private_chat.1_hour'), value: 60 }
])

function handleSetupSecretChat() {
  secretChatForm.password = ''
  secretChatForm.confirmPassword = ''
  showSecretChatDialog.value = true
}

async function handleSaveSecretChat() {
  if (secretChatForm.password !== secretChatForm.confirmPassword) {
    showFeedback(t('setting.private_chat.password_mismatch'), 'error')
    return
  }

  if (secretChatForm.password.length < 4) {
    showFeedback(t('setting.private_chat.password_too_short'), 'error')
    return
  }

  try {
    savingSecretChat.value = true
    await settingStore.setSecretChatPassword(secretChatForm.password)
    showSecretChatDialog.value = false
    showFeedback(t('setting.private_chat.password_set_success'), 'success')
  } catch (error) {
    showFeedback(t('setting.private_chat.password_set_failed'), 'error')
  } finally {
    savingSecretChat.value = false
  }
}

function handleSecretChatEnabledChange(value: boolean) {
  showFeedback(
    value ? t('setting.security.private_chat_enabled') : t('setting.security.private_chat_disabled'),
    'success'
  )
}

function handleClearSecretChat() {
  dialog.warning({
    title: t('setting.private_chat.clear_confirm_title'),
    content: t('setting.private_chat.clear_confirm_content'),
    positiveText: t('setting.common.confirm'),
    negativeText: t('setting.common.cancel'),
    onPositiveClick: () => {
      settingStore.clearSecretChatPassword()
      showFeedback(t('setting.private_chat.clear_success'), 'success')
    }
  })
}

const backupStatusText = computed(() => {
  if (!encryptionEnabled.value) {
    return t('setting.security.backup_not_enabled')
  }
  if (hasBackup.value && backupInfo.value) {
    return t('setting.security.backup_count', { count: String(backupInfo.value.count) })
  }
  return t('setting.security.backup_not_configured')
})

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

  // ── 步骤 3：加载加密状态和用户数据 ──
  logger.info('[SecuritySettings] 步骤 3/3: 加载加密状态与用户数据')
  await encryptionStore.loadEncryptionStatus()
  await loadIgnoredUsers()
  await loadBlockedUsers()
  loadInviteLists()
  await loadBackupInfo()
  loadPrivacySettings()
  logger.info('[SecuritySettings] onMounted 全部完成')
})

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

function handleSecurityKeyCreated() {
  encryptionStore.markSecurityKeyConfigured()
  showFeedback(t('setting.security.security_key_created'), 'success')
}

async function loadIgnoredUsers() {
  loadingIgnored.value = true
  try {
    ignoredUsers.value = await getIgnoredUsers()
  } catch (error) {
    logger.warn('Failed to fetch ignored users', error)
  } finally {
    loadingIgnored.value = false
  }
}

function loadPrivacySettings() {
  const savedOnline = localStorage.getItem('tjg-show-online')
  if (savedOnline !== null) {
    showOnlineStatus.value = savedOnline === 'true'
  }

  const savedTyping = localStorage.getItem('tjg-show-typing')
  if (savedTyping !== null) {
    showTypingStatus.value = savedTyping === 'true'
  }

  const savedReceipts = localStorage.getItem('tjg-send-receipts')
  if (savedReceipts !== null) {
    sendReadReceipts.value = savedReceipts === 'true'
  }
}

function handleSetupBackup() {
  showBackupDialog.value = true
}

async function handleBackupSuccess() {
  await loadBackupInfo()
  showFeedback(t('setting.security.backup_setup_success'), 'success')
}

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

function handleOnlineStatusChange(value: boolean) {
  localStorage.setItem('tjg-show-online', value.toString())
  showFeedback(
    value ? t('setting.security.online_status_shown') : t('setting.security.online_status_hidden'),
    'success'
  )
}

function handleTypingStatusChange(value: boolean) {
  localStorage.setItem('tjg-show-typing', value.toString())
  showFeedback(
    value ? t('setting.security.typing_status_shown') : t('setting.security.typing_status_hidden'),
    'success'
  )
}

function handleReadReceiptsChange(value: boolean) {
  localStorage.setItem('tjg-send-receipts', value.toString())
  showFeedback(
    value ? t('setting.security.read_receipts_enabled') : t('setting.security.read_receipts_disabled'),
    'success'
  )
}

async function handleUnignore(userId: string) {
  try {
    const newIgnoredUsers = ignoredUsers.value.filter((u) => u !== userId)
    await setIgnoredUsers(newIgnoredUsers)
    ignoredUsers.value = newIgnoredUsers
    showFeedback(t('setting.security.ignored_user_removed'), 'success')
  } catch (error) {
    showFeedback(t('setting.security.operation_failed'), 'error')
  }
}

async function loadBlockedUsers() {
  loadingBlocked.value = true
  try {
    const saved = localStorage.getItem('tjg-blocked-users')
    if (saved) {
      blockedUsers.value = JSON.parse(saved)
    }
  } catch {
    // ignore
  } finally {
    loadingBlocked.value = false
  }
}

function saveBlockedUsers() {
  localStorage.setItem('tjg-blocked-users', JSON.stringify(blockedUsers.value))
}

function handleAddBlocked() {
  if (!newBlockedUser.value.trim()) {
    showFeedback(t('setting.security.input_user_id_required'), 'warning')
    return false
  }
  if (blockedUsers.value.includes(newBlockedUser.value.trim())) {
    showFeedback(t('setting.security.user_already_blocked'), 'warning')
    return false
  }
  blockedUsers.value.push(newBlockedUser.value.trim())
  newBlockedUser.value = ''
  saveBlockedUsers()
  showFeedback(t('setting.security.blocked_user_added'), 'success')
}

function handleUnblock(userId: string) {
  blockedUsers.value = blockedUsers.value.filter((u) => u !== userId)
  saveBlockedUsers()
  showFeedback(t('setting.security.blocked_user_removed'), 'success')
}

function loadInviteLists() {
  try {
    const savedBlock = localStorage.getItem('tjg-invite-blocklist')
    if (savedBlock) inviteBlocklist.value = JSON.parse(savedBlock)
    const savedAllow = localStorage.getItem('tjg-invite-allowlist')
    if (savedAllow) inviteAllowlist.value = JSON.parse(savedAllow)
  } catch {
    // ignore
  }
}

function saveInviteBlocklist() {
  localStorage.setItem('tjg-invite-blocklist', JSON.stringify(inviteBlocklist.value))
}

function saveInviteAllowlist() {
  localStorage.setItem('tjg-invite-allowlist', JSON.stringify(inviteAllowlist.value))
}

function handleAddInviteBlocklist() {
  if (!newBlocklistUser.value.trim()) {
    showFeedback(t('setting.security.input_user_id_required'), 'warning')
    return
  }
  if (inviteBlocklist.value.includes(newBlocklistUser.value.trim())) {
    showFeedback(t('setting.security.user_already_in_blocklist'), 'warning')
    return
  }
  inviteBlocklist.value.push(newBlocklistUser.value.trim())
  newBlocklistUser.value = ''
  saveInviteBlocklist()
  showFeedback(t('setting.security.invite_blocklist_added'), 'success')
}

function handleRemoveInviteBlocklist(userId: string) {
  inviteBlocklist.value = inviteBlocklist.value.filter((u) => u !== userId)
  saveInviteBlocklist()
  showFeedback(t('setting.security.invite_blocklist_removed'), 'success')
}

function handleAddInviteAllowlist() {
  if (!newAllowlistUser.value.trim()) {
    showFeedback(t('setting.security.input_user_id_required'), 'warning')
    return
  }
  if (inviteAllowlist.value.includes(newAllowlistUser.value.trim())) {
    showFeedback(t('setting.security.user_already_in_allowlist'), 'warning')
    return
  }
  inviteAllowlist.value.push(newAllowlistUser.value.trim())
  newAllowlistUser.value = ''
  saveInviteAllowlist()
  showFeedback(t('setting.security.invite_allowlist_added'), 'success')
}

function handleRemoveInviteAllowlist(userId: string) {
  inviteAllowlist.value = inviteAllowlist.value.filter((u) => u !== userId)
  saveInviteAllowlist()
  showFeedback(t('setting.security.invite_allowlist_removed'), 'success')
}
</script>

<style scoped>
.security-settings {
  padding: 0 var(--tjg-space-2);
}

.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-4);
  color: var(--tjg-text-primary);
}

.invite-lists-alert {
  margin-bottom: var(--tjg-space-3);
  font-size: var(--tjg-font-size-sm);
}

.encryption-status {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-4);
  padding: var(--tjg-space-4);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-secure {
  color: var(--tjg-color-success-500);
}

.status-insecure {
  color: var(--tjg-color-warning-500);
}

.status-info {
  display: flex;
  flex-direction: column;
}

.status-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.status-desc {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-3) 0;
  border-bottom: 1px solid var(--tjg-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
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

.ignored-list {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.ignored-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-2) var(--tjg-space-3);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-xs);
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}
</style>
