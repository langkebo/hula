<template>
  <div class="security-settings">
    <div class="settings-section">
      <h3 class="section-title">加密状态</h3>
      <div class="encryption-status">
        <div class="status-icon">
          <Icon
            :icon="encryptionEnabled ? 'mdi:shield-check' : 'mdi:shield-off'"
            :width="48"
            :class="encryptionEnabled ? 'status-secure' : 'status-insecure'" />
        </div>
        <div class="status-info">
          <div class="status-title">{{ encryptionEnabled ? '端到端加密已启用' : '端到端加密未启用' }}</div>
          <div class="status-desc">
            {{ encryptionEnabled ? '您的消息受到端到端加密保护' : '消息未加密，建议启用加密功能' }}
          </div>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">恢复密钥</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">安全备份</span>
          <span class="setting-desc">{{ backupStatusText }}</span>
        </div>
        <n-button size="small" :loading="backupLoading" @click="handleSetupBackup">
          {{ hasBackup ? '管理备份' : '设置备份' }}
        </n-button>
      </div>
      <div v-if="hasBackup" class="setting-item">
        <div class="setting-info">
          <span class="setting-label">导出恢复密钥</span>
          <span class="setting-desc">将恢复密钥导出到安全位置</span>
        </div>
        <n-button size="small" :loading="exportLoading" @click="handleExportKey">导出</n-button>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">隐私设置</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示在线状态</span>
          <span class="setting-desc">允许其他用户看到您的在线状态</span>
        </div>
        <n-switch v-model:value="showOnlineStatus" @update:value="handleOnlineStatusChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示输入状态</span>
          <span class="setting-desc">允许其他用户看到您正在输入</span>
        </div>
        <n-switch v-model:value="showTypingStatus" @update:value="handleTypingStatusChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示已读回执</span>
          <span class="setting-desc">发送消息已读回执</span>
        </div>
        <n-switch v-model:value="sendReadReceipts" @update:value="handleReadReceiptsChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">被忽略的用户</h3>
      <n-spin :show="loadingIgnored">
        <div v-if="ignoredUsers.length > 0" class="ignored-list">
          <div v-for="user in ignoredUsers" :key="user" class="ignored-item">
            <span class="user-id">{{ user }}</span>
            <n-button size="tiny" @click="handleUnignore(user)">取消忽略</n-button>
          </div>
        </div>
        <n-empty v-else description="没有忽略的用户" />
      </n-spin>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">屏蔽用户</h3>
      <n-spin :show="loadingBlocked">
        <div v-if="blockedUsers.length > 0" class="ignored-list">
          <div v-for="user in blockedUsers" :key="user" class="ignored-item">
            <span class="user-id">{{ user }}</span>
            <n-button size="tiny" @click="handleUnblock(user)">取消屏蔽</n-button>
          </div>
        </div>
        <n-empty v-else description="没有屏蔽的用户" />
      </n-spin>
      <div style="margin-top: 8px">
        <n-button size="small" @click="showAddBlocked = true">+ 添加屏蔽用户</n-button>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">邀请黑白名单</h3>
      <n-alert type="info" :show-icon="true" style="margin-bottom: 12px; font-size: 12px">
        邀请黑白名单为房间级别设置，此处为全局默认配置。
      </n-alert>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">邀请黑名单</span>
          <span class="setting-desc">阻止这些用户邀请你加入房间</span>
        </div>
        <n-button size="small" @click="showInviteBlocklist = true">管理 ({{ inviteBlocklist.length }})</n-button>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">邀请白名单</span>
          <span class="setting-desc">仅允许这些用户邀请你加入房间</span>
        </div>
        <n-button size="small" @click="showInviteAllowlist = true">管理 ({{ inviteAllowlist.length }})</n-button>
      </div>
    </div>

    <KeyBackupSetupDialog v-model:show="showBackupDialog" @success="handleBackupSuccess" />

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">私密聊天</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">启用私密聊天</span>
          <span class="setting-desc">启用后可通过密码保护隐藏会话</span>
        </div>
        <n-switch v-model:value="secretChatEnabled" @update:value="handleSecretChatEnabledChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">私密聊天密码</span>
          <span class="setting-desc">{{ secretChatConfigured ? '已设置密码保护' : '未设置密码' }}</span>
        </div>
        <n-button size="small" @click="handleSetupSecretChat">
          {{ secretChatConfigured ? '修改密码' : '设置密码' }}
        </n-button>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">隐藏私密会话</span>
          <span class="setting-desc">在会话列表中自动隐藏受保护的私密聊天</span>
        </div>
        <n-switch v-model:value="secretChatHideSessions" :disabled="!secretChatEnabled" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">自动锁定</span>
          <span class="setting-desc">离开应用一段时间后重新校验私密聊天密码</span>
        </div>
        <n-switch v-model:value="secretChatAutoLock" :disabled="!secretChatEnabled" />
      </div>
      <div v-if="secretChatAutoLock" class="setting-item">
        <div class="setting-info">
          <span class="setting-label">自动锁定时间</span>
          <span class="setting-desc">选择私密聊天重新上锁的等待时间</span>
        </div>
        <n-select
          v-model:value="secretChatLockTimeout"
          size="small"
          style="width: 140px"
          :options="lockTimeoutOptions" />
      </div>
      <div v-if="secretChatConfigured" class="setting-item">
        <div class="setting-info">
          <span class="setting-label">清除私密聊天</span>
          <span class="setting-desc">清除密码并重置所有隐藏会话</span>
        </div>
        <n-button size="small" @click="handleClearSecretChat">清除</n-button>
      </div>
    </div>

    <n-modal v-model:show="showSecretChatDialog" preset="card" title="设置私密聊天密码" style="width: 400px">
      <div class="secret-chat-form">
        <n-form :model="secretChatForm" :rules="secretChatRules">
          <n-form-item path="password" label="密码">
            <n-input
              v-model:value="secretChatForm.password"
              type="password"
              placeholder="请输入密码"
              show-password-on="click" />
          </n-form-item>
          <n-form-item path="confirmPassword" label="确认密码">
            <n-input
              v-model:value="secretChatForm.confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              show-password-on="click" />
          </n-form-item>
        </n-form>
        <div class="dialog-footer">
          <n-button @click="showSecretChatDialog = false">取消</n-button>
          <n-button type="primary" @click="handleSaveSecretChat" :loading="savingSecretChat">保存</n-button>
        </div>
      </div>
    </n-modal>

    <n-modal
      v-model:show="showAddBlocked"
      preset="dialog"
      title="添加屏蔽用户"
      positive-text="添加"
      negative-text="取消"
      @positive-click="handleAddBlocked">
      <n-form>
        <n-form-item label="用户 ID">
          <n-input v-model:value="newBlockedUser" placeholder="@user:example.com" />
        </n-form-item>
      </n-form>
    </n-modal>

    <n-modal v-model:show="showInviteBlocklist" preset="card" title="邀请黑名单管理" style="width: 450px">
      <div class="list-management">
        <div v-for="user in inviteBlocklist" :key="user" class="ignored-item">
          <span class="user-id">{{ user }}</span>
          <n-button size="tiny" @click="handleRemoveInviteBlocklist(user)">移除</n-button>
        </div>
        <n-empty v-if="inviteBlocklist.length === 0" description="黑名单为空" />
        <div style="margin-top: 8px; display: flex; gap: 8px">
          <n-input v-model:value="newBlocklistUser" placeholder="@user:example.com" size="small" style="flex: 1" />
          <n-button size="small" type="primary" @click="handleAddInviteBlocklist">添加</n-button>
        </div>
      </div>
    </n-modal>

    <n-modal v-model:show="showInviteAllowlist" preset="card" title="邀请白名单管理" style="width: 450px">
      <div class="list-management">
        <div v-for="user in inviteAllowlist" :key="user" class="ignored-item">
          <span class="user-id">{{ user }}</span>
          <n-button size="tiny" @click="handleRemoveInviteAllowlist(user)">移除</n-button>
        </div>
        <n-empty v-if="inviteAllowlist.length === 0" description="白名单为空" />
        <div style="margin-top: 8px; display: flex; gap: 8px">
          <n-input v-model:value="newAllowlistUser" placeholder="@user:example.com" size="small" style="flex: 1" />
          <n-button size="small" type="primary" @click="handleAddInviteAllowlist">添加</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  NButton,
  NDivider,
  NSpin,
  NEmpty,
  NSwitch,
  NSelect,
  useMessage,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NAlert,
  useDialog
} from 'naive-ui'
import { Icon } from '@iconify/vue'
import { matrixAccountService } from '@/services/matrix'
import { matrixEncryptionService } from '@/services/matrix'
import { useSettingStore } from '@/stores/domains/settings/setting'
import KeyBackupSetupDialog from '@/components/encryption/KeyBackupSetupDialog.vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SecuritySettings')

defineOptions({
  name: 'SecuritySettings'
})

const message = useMessage()
const dialog = useDialog()
const settingStore = useSettingStore()

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
const backupLoading = ref(false)
const exportLoading = ref(false)
const hasBackup = ref(false)
const backupInfo = ref<{ version: string | null; count: number } | null>(null)
const encryptionEnabled = ref(false)

const showOnlineStatus = ref(true)
const showTypingStatus = ref(true)
const sendReadReceipts = ref(true)

const secretChatConfigured = computed(() => settingStore.isSecretChatConfigured())
const secretChatEnabled = computed({
  get: () => settingStore.secretChat.enabled,
  set: (value: boolean) => settingStore.setSecretChatEnabled(value)
})
const secretChatHideSessions = computed({
  get: () => settingStore.secretChat.hideSessions,
  set: (value: boolean) => settingStore.setSecretChatHideSessions(value)
})
const secretChatAutoLock = computed({
  get: () => settingStore.secretChat.autoLock,
  set: (value: boolean) => settingStore.setSecretChatAutoLock(value)
})
const secretChatLockTimeout = computed({
  get: () => settingStore.secretChat.lockTimeout,
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
    message: '请输入密码',
    trigger: 'blur'
  },
  confirmPassword: {
    required: true,
    message: '请再次输入密码',
    trigger: 'blur'
  }
}

const lockTimeoutOptions = [
  { label: '1 分钟', value: 1 },
  { label: '5 分钟', value: 5 },
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '1 小时', value: 60 }
]

function handleSetupSecretChat() {
  secretChatForm.password = ''
  secretChatForm.confirmPassword = ''
  showSecretChatDialog.value = true
}

async function handleSaveSecretChat() {
  if (secretChatForm.password !== secretChatForm.confirmPassword) {
    message.error('两次输入的密码不一致')
    return
  }

  if (secretChatForm.password.length < 4) {
    message.error('密码长度不能少于4位')
    return
  }

  try {
    savingSecretChat.value = true
    settingStore.setSecretChatPassword(secretChatForm.password)
    showSecretChatDialog.value = false
    message.success('私密聊天密码设置成功')
  } catch (error) {
    message.error('设置失败')
  } finally {
    savingSecretChat.value = false
  }
}

function handleSecretChatEnabledChange(value: boolean) {
  message.success(value ? '已启用私密聊天' : '已关闭私密聊天')
}

function handleClearSecretChat() {
  dialog.warning({
    title: '确认清除',
    content: '确定要清除私密聊天密码吗？这将重置所有隐藏会话。',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      settingStore.clearSecretChatPassword()
      message.success('已清除私密聊天设置')
    }
  })
}

const backupStatusText = computed(() => {
  if (!encryptionEnabled.value) {
    return '加密未启用'
  }
  if (hasBackup.value && backupInfo.value) {
    return `已备份 ${backupInfo.value.count} 个密钥`
  }
  return '未设置备份'
})

onMounted(async () => {
  encryptionEnabled.value = await matrixEncryptionService.isEncryptionAvailable()
  await loadIgnoredUsers()
  await loadBlockedUsers()
  loadInviteLists()
  await loadBackupInfo()
  loadPrivacySettings()
})

async function loadBackupInfo() {
  if (!encryptionEnabled.value) return

  try {
    const info = await matrixEncryptionService.getKeyBackupInfo()
    hasBackup.value = !!info
    backupInfo.value = info ? { version: info.version, count: info.count } : null
  } catch (error) {
    logger.error('获取备份信息失败:', error)
  }
}

async function loadIgnoredUsers() {
  loadingIgnored.value = true
  try {
    ignoredUsers.value = await matrixAccountService.getIgnoredUsers()
  } catch (error) {
    logger.error('获取忽略用户列表失败:', error)
  } finally {
    loadingIgnored.value = false
  }
}

function loadPrivacySettings() {
  const savedOnline = localStorage.getItem('hula-show-online')
  if (savedOnline !== null) {
    showOnlineStatus.value = savedOnline === 'true'
  }

  const savedTyping = localStorage.getItem('hula-show-typing')
  if (savedTyping !== null) {
    showTypingStatus.value = savedTyping === 'true'
  }

  const savedReceipts = localStorage.getItem('hula-send-receipts')
  if (savedReceipts !== null) {
    sendReadReceipts.value = savedReceipts === 'true'
  }
}

function handleSetupBackup() {
  showBackupDialog.value = true
}

async function handleBackupSuccess() {
  await loadBackupInfo()
  message.success('安全备份设置成功')
}

async function handleExportKey() {
  if (!encryptionEnabled.value) {
    message.warning('请先启用加密功能')
    return
  }

  exportLoading.value = true
  try {
    const keysJson = await matrixEncryptionService.exportRoomKeys()

    const blob = new Blob([keysJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hula-keys-backup-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    message.success('密钥已导出，请妥善保管')
  } catch (error) {
    logger.error('导出密钥失败:', error)
    message.error('导出密钥失败')
  } finally {
    exportLoading.value = false
  }
}

function handleOnlineStatusChange(value: boolean) {
  localStorage.setItem('hula-show-online', value.toString())
  message.success(value ? '已显示在线状态' : '已隐藏在线状态')
}

function handleTypingStatusChange(value: boolean) {
  localStorage.setItem('hula-show-typing', value.toString())
  message.success(value ? '已显示输入状态' : '已隐藏输入状态')
}

function handleReadReceiptsChange(value: boolean) {
  localStorage.setItem('hula-send-receipts', value.toString())
  message.success(value ? '已启用已读回执' : '已禁用已读回执')
}

async function handleUnignore(userId: string) {
  try {
    const newIgnoredUsers = ignoredUsers.value.filter((u) => u !== userId)
    await matrixAccountService.setIgnoredUsers(newIgnoredUsers)
    ignoredUsers.value = newIgnoredUsers
    message.success('已取消忽略该用户')
  } catch (error) {
    message.error('操作失败')
  }
}

async function loadBlockedUsers() {
  loadingBlocked.value = true
  try {
    const saved = localStorage.getItem('hula-blocked-users')
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
  localStorage.setItem('hula-blocked-users', JSON.stringify(blockedUsers.value))
}

function handleAddBlocked() {
  if (!newBlockedUser.value.trim()) {
    message.warning('请输入用户 ID')
    return false
  }
  if (blockedUsers.value.includes(newBlockedUser.value.trim())) {
    message.warning('该用户已在屏蔽列表中')
    return false
  }
  blockedUsers.value.push(newBlockedUser.value.trim())
  newBlockedUser.value = ''
  saveBlockedUsers()
  message.success('已添加屏蔽用户')
}

function handleUnblock(userId: string) {
  blockedUsers.value = blockedUsers.value.filter((u) => u !== userId)
  saveBlockedUsers()
  message.success('已取消屏蔽该用户')
}

function loadInviteLists() {
  try {
    const savedBlock = localStorage.getItem('hula-invite-blocklist')
    if (savedBlock) inviteBlocklist.value = JSON.parse(savedBlock)
    const savedAllow = localStorage.getItem('hula-invite-allowlist')
    if (savedAllow) inviteAllowlist.value = JSON.parse(savedAllow)
  } catch {
    // ignore
  }
}

function saveInviteBlocklist() {
  localStorage.setItem('hula-invite-blocklist', JSON.stringify(inviteBlocklist.value))
}

function saveInviteAllowlist() {
  localStorage.setItem('hula-invite-allowlist', JSON.stringify(inviteAllowlist.value))
}

function handleAddInviteBlocklist() {
  if (!newBlocklistUser.value.trim()) {
    message.warning('请输入用户 ID')
    return
  }
  if (inviteBlocklist.value.includes(newBlocklistUser.value.trim())) {
    message.warning('该用户已在黑名单中')
    return
  }
  inviteBlocklist.value.push(newBlocklistUser.value.trim())
  newBlocklistUser.value = ''
  saveInviteBlocklist()
  message.success('已添加到邀请黑名单')
}

function handleRemoveInviteBlocklist(userId: string) {
  inviteBlocklist.value = inviteBlocklist.value.filter((u) => u !== userId)
  saveInviteBlocklist()
  message.success('已从邀请黑名单移除')
}

function handleAddInviteAllowlist() {
  if (!newAllowlistUser.value.trim()) {
    message.warning('请输入用户 ID')
    return
  }
  if (inviteAllowlist.value.includes(newAllowlistUser.value.trim())) {
    message.warning('该用户已在白名单中')
    return
  }
  inviteAllowlist.value.push(newAllowlistUser.value.trim())
  newAllowlistUser.value = ''
  saveInviteAllowlist()
  message.success('已添加到邀请白名单')
}

function handleRemoveInviteAllowlist(userId: string) {
  inviteAllowlist.value = inviteAllowlist.value.filter((u) => u !== userId)
  saveInviteAllowlist()
  message.success('已从邀请白名单移除')
}
</script>

<style scoped>
.security-settings {
  padding: 0 8px;
}

.settings-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
}

.encryption-status {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .encryption-status {
  background-color: rgba(255, 255, 255, 0.05);
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-secure {
  color: var(--color-success);
}

.status-insecure {
  color: var(--color-warning);
}

.status-info {
  display: flex;
  flex-direction: column;
}

.status-title {
  font-size: 16px;
  font-weight: 500;
}

.status-desc {
  font-size: 12px;
  color: var(--color-text-quaternary);
  margin-top: 4px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:deep(.dark) .setting-item {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: 14px;
}

.setting-desc {
  font-size: 12px;
  color: var(--color-text-quaternary);
  margin-top: 4px;
}

.ignored-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ignored-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
  font-size: 14px;
}

:deep(.dark) .ignored-item {
  background-color: rgba(255, 255, 255, 0.05);
}
</style>
