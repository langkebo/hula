<template>
  <div class="encryption-settings">
    <div class="settings-section">
      <h3 class="section-title">加密密钥</h3>
      <div class="key-status" :class="encryptionEnabled ? 'key-status-active' : 'key-status-inactive'">
        <Icon :icon="encryptionEnabled ? 'mdi:key-variant' : 'mdi:key-outline'" :width="32" />
        <div class="key-info">
          <div class="key-name">加密密钥状态</div>
          <div class="key-desc">{{ keyStatus }}</div>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">安全备份</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">启用安全备份</span>
          <span class="setting-desc">将加密密钥备份到服务器</span>
        </div>
        <n-switch v-model:value="backupEnabled" :disabled="!encryptionEnabled" @update:value="handleBackupToggle" />
      </div>
      <div v-if="backupEnabled && encryptionEnabled" class="setting-item">
        <div class="setting-info">
          <span class="setting-label">备份版本</span>
          <span class="setting-desc">当前备份版本: {{ backupVersion }}</span>
        </div>
        <n-button size="small" :loading="createBackupLoading" @click="handleCreateBackup">创建新备份</n-button>
      </div>
      <div v-if="backupEnabled && encryptionEnabled" class="setting-item">
        <div class="setting-info">
          <span class="setting-label">恢复密钥</span>
          <span class="setting-desc">使用恢复密钥还原加密消息</span>
        </div>
        <n-button size="small" @click="handleRestoreBackup">恢复</n-button>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">设备验证</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">验证状态</span>
          <span class="setting-desc">{{ deviceVerified ? '此设备已验证' : '此设备未验证' }}</span>
        </div>
        <n-button v-if="!deviceVerified" size="small" type="primary" @click="handleVerifyDevice">验证设备</n-button>
        <n-tag v-else type="success">已验证</n-tag>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">设备密钥</span>
          <span class="setting-desc">查看此设备的加密密钥指纹</span>
        </div>
        <n-button size="small" @click="handleShowDeviceKey">查看</n-button>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">加密信息</h3>
      <div class="encryption-info">
        <div class="info-item">
          <span class="info-label">加密算法</span>
          <span class="info-value">{{ encryptionAlgorithm }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">已验证设备</span>
          <span class="info-value">{{ verifiedDevicesCount }} 个</span>
        </div>
        <div class="info-item">
          <span class="info-label">未验证设备</span>
          <span class="info-value">{{ unverifiedDevicesCount }} 个</span>
        </div>
      </div>
    </div>

    <KeyBackupSetupDialog v-model:show="showBackupDialog" @success="handleBackupCreated" />

    <KeyBackupRestoreDialog v-model:show="showRestoreDialog" @success="handleRestoreSuccess" />

    <DeviceVerifyDialog v-model:show="showVerifyDialog" @success="handleVerifySuccess" />

    <n-modal v-model:show="deviceKeyVisible" preset="card" title="设备密钥指纹" style="width: 400px">
      <div class="device-key-display">
        <div class="fingerprint">{{ deviceFingerprint }}</div>
        <n-button size="small" @click="copyFingerprint">复制</n-button>
      </div>
      <div class="fingerprint-hint">此指纹用于验证设备身份，请确保与登录时显示的指纹一致</div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NSwitch, NButton, NDivider, NTag, NModal, useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { matrixClientService } from '@/services/matrix'
import { matrixEncryptionService } from '@/services/matrix'
import KeyBackupSetupDialog from '@/components/encryption/KeyBackupSetupDialog.vue'
import KeyBackupRestoreDialog from '@/components/encryption/KeyBackupRestoreDialog.vue'
import DeviceVerifyDialog from '@/components/encryption/DeviceVerifyDialog.vue'

defineOptions({
  name: 'EncryptionSettings'
})

const message = useMessage()

const backupEnabled = ref(false)
const backupVersion = ref('v1')
const deviceVerified = ref(false)
const deviceKeyVisible = ref(false)
const deviceFingerprint = ref('')
const showBackupDialog = ref(false)
const showRestoreDialog = ref(false)
const showVerifyDialog = ref(false)
const createBackupLoading = ref(false)

const encryptionEnabled = computed(() => {
  const client = matrixClientService.getClient()
  return !!(client as any)?.crypto
})

const keyStatus = computed(() => {
  if (!encryptionEnabled.value) {
    return '加密未启用'
  }
  return backupEnabled.value ? '已设置并备份' : '已设置'
})

const encryptionAlgorithm = computed(() => {
  return encryptionEnabled.value ? 'Megolm (AES-256)' : '未启用'
})

const verifiedDevicesCount = ref(0)
const unverifiedDevicesCount = ref(1)

onMounted(async () => {
  await loadEncryptionInfo()
})

async function loadEncryptionInfo() {
  const client = matrixClientService.getClient()
  if (!client || !(client as any).crypto) {
    return
  }

  try {
    const crypto = (client as any).crypto

    if (crypto.getOwnDeviceKeys) {
      const keys = await crypto.getOwnDeviceKeys()
      if (keys.ed25519) {
        deviceFingerprint.value = formatFingerprint(keys.ed25519)
      }
    }

    if (crypto.getGlobalBlacklistUnverifiedDevices) {
      deviceVerified.value = !crypto.getGlobalBlacklistUnverifiedDevices()
    }

    const backupInfo = await matrixEncryptionService.getKeyBackupInfo()
    if (backupInfo) {
      backupEnabled.value = true
      backupVersion.value = `v${backupInfo.version || 1}`
    }

    const savedBackup = localStorage.getItem('hula-backup-enabled')
    if (savedBackup !== null) {
      backupEnabled.value = savedBackup === 'true'
    }
  } catch (error) {
    console.error('加载加密信息失败:', error)
  }
}

function formatFingerprint(key: string): string {
  return key.match(/.{1,4}/g)?.join(' ') || key
}

function handleBackupToggle(value: boolean) {
  if (!encryptionEnabled.value) {
    message.warning('请先启用加密功能')
    backupEnabled.value = false
    return
  }

  localStorage.setItem('hula-backup-enabled', value.toString())
  if (value) {
    showBackupDialog.value = true
  } else {
    message.warning('已禁用安全备份')
  }
}

function handleCreateBackup() {
  showBackupDialog.value = true
}

function handleBackupCreated() {
  backupEnabled.value = true
  backupVersion.value = `v${Date.now()}`
  message.success('备份创建成功')
}

function handleRestoreBackup() {
  showRestoreDialog.value = true
}

function handleRestoreSuccess() {
  message.success('密钥恢复成功')
}

function handleVerifyDevice() {
  showVerifyDialog.value = true
}

function handleVerifySuccess() {
  deviceVerified.value = true
  message.success('设备验证成功')
}

function handleShowDeviceKey() {
  if (!deviceFingerprint.value) {
    deviceFingerprint.value = 'XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX'
  }
  deviceKeyVisible.value = true
}

function copyFingerprint() {
  navigator.clipboard.writeText(deviceFingerprint.value.replace(/\s/g, ''))
  message.success('已复制到剪贴板')
}
</script>

<style scoped>
.encryption-settings {
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

.key-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

.key-status-active {
  background-color: rgba(82, 196, 26, 0.1);
}

.key-status-inactive {
  background-color: rgba(250, 173, 20, 0.1);
}

:deep(.dark) .key-status {
  background-color: rgba(255, 255, 255, 0.05);
}

.key-info {
  display: flex;
  flex-direction: column;
}

.key-name {
  font-size: 14px;
  font-weight: 500;
}

.key-desc {
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

.encryption-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .encryption-info {
  background-color: rgba(255, 255, 255, 0.05);
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 14px;
  color: #666;
}

:deep(.dark) .info-label {
  color: #aaa;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
}

.device-key-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.fingerprint {
  font-family: monospace;
  font-size: 16px;
  letter-spacing: 2px;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  word-break: break-all;
  text-align: center;
}

:deep(.dark) .fingerprint {
  background-color: rgba(255, 255, 255, 0.05);
}

.fingerprint-hint {
  font-size: 12px;
  color: #999;
  text-align: center;
  margin-top: 8px;
}
</style>
