<template>
  <div class="security-settings">
    <div class="settings-section">
      <h3 class="section-title">加密状态</h3>
      <div class="encryption-status">
        <div class="status-icon">
          <Icon :icon="encryptionEnabled ? 'mdi:shield-check' : 'mdi:shield-off'" :width="48" :class="encryptionEnabled ? 'status-secure' : 'status-insecure'" />
        </div>
        <div class="status-info">
          <div class="status-title">{{ encryptionEnabled ? '端到端加密已启用' : '端到端加密未启用' }}</div>
          <div class="status-desc">{{ encryptionEnabled ? '您的消息受到端到端加密保护' : '消息未加密，建议启用加密功能' }}</div>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">恢复密钥</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">安全备份</span>
          <span class="setting-desc">使用恢复密钥备份加密消息</span>
        </div>
        <n-button size="small" @click="handleSetupBackup">设置备份</n-button>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">导出恢复密钥</span>
          <span class="setting-desc">将恢复密钥导出到安全位置</span>
        </div>
        <n-button size="small" @click="handleExportKey">导出</n-button>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NButton, NDivider, NSpin, NEmpty, NSwitch, useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { matrixAccountService } from '@/services/matrix'
import { matrixClientService } from '@/services/matrix'

defineOptions({
  name: 'SecuritySettings'
})

const message = useMessage()

const loadingIgnored = ref(false)
const ignoredUsers = ref<string[]>([])

const showOnlineStatus = ref(true)
const showTypingStatus = ref(true)
const sendReadReceipts = ref(true)

const encryptionEnabled = computed(() => {
  const client = matrixClientService.getClient()
  return !!(client as any)?.crypto
})

onMounted(async () => {
  await loadIgnoredUsers()
  loadPrivacySettings()
})

async function loadIgnoredUsers() {
  loadingIgnored.value = true
  try {
    ignoredUsers.value = await matrixAccountService.getIgnoredUsers()
  } catch (error) {
    console.error('获取忽略用户列表失败:', error)
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
  message.info('安全备份设置功能开发中')
}

function handleExportKey() {
  message.info('导出恢复密钥功能开发中')
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
    const newIgnoredUsers = ignoredUsers.value.filter(u => u !== userId)
    await matrixAccountService.setIgnoredUsers(newIgnoredUsers)
    ignoredUsers.value = newIgnoredUsers
    message.success('已取消忽略该用户')
  } catch (error) {
    message.error('操作失败')
  }
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
  color: #52c41a;
}

.status-insecure {
  color: #faad14;
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
  color: #999;
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
  color: #999;
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
