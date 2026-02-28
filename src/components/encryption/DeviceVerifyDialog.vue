<template>
  <n-modal v-model:show="visible" preset="card" title="设备验证" style="width: 450px" :mask-closable="false">
    <n-spin :show="loading">
      <div v-if="step === 'intro'" class="step-content">
        <div class="intro-icon">
          <Icon icon="mdi:shield-check" :width="64" />
        </div>
        <div class="intro-text">
          <p>验证此设备可以确保您的加密通信安全。</p>
          <p>验证后，您可以确认此设备确实是您本人的设备。</p>
        </div>
        <div class="device-info-card">
          <div class="info-row">
            <span class="info-label">设备ID</span>
            <span class="info-value">{{ deviceId }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">设备名称</span>
            <span class="info-value">{{ deviceName || '未命名设备' }}</span>
          </div>
        </div>
        <div class="step-actions">
          <n-button @click="handleCancel">取消</n-button>
          <n-button type="primary" @click="startVerification">开始验证</n-button>
        </div>
      </div>

      <div v-else-if="step === 'showKey'" class="step-content">
        <div class="key-display">
          <div class="key-label">设备密钥指纹</div>
          <div class="fingerprint-display">
            <div v-for="(chunk, index) in fingerprintChunks" :key="index" class="fingerprint-chunk">
              {{ chunk }}
            </div>
          </div>
          <div class="key-hint">
            <Icon icon="mdi:information" :width="16" />
            <span>请确认此指纹与您其他设备上显示的指纹一致</span>
          </div>
        </div>
        <div class="verification-question">
          <p>此指纹是否与您其他设备上显示的一致？</p>
        </div>
        <div class="step-actions">
          <n-button @click="handleCancel">取消</n-button>
          <n-button type="error" @click="handleReject">不匹配</n-button>
          <n-button type="primary" @click="handleConfirm">确认匹配</n-button>
        </div>
      </div>

      <div v-else-if="step === 'success'" class="step-content">
        <div class="success-icon">
          <Icon icon="mdi:check-circle" :width="64" class="success-color" />
        </div>
        <div class="success-text">
          <h3>设备验证成功！</h3>
          <p>此设备已被标记为已验证。</p>
        </div>
        <div class="step-actions">
          <n-button type="primary" @click="handleClose">完成</n-button>
        </div>
      </div>

      <div v-else-if="step === 'rejected'" class="step-content">
        <div class="error-icon">
          <Icon icon="mdi:alert-circle" :width="64" class="error-color" />
        </div>
        <div class="error-text">
          <h3>验证失败</h3>
          <p>指纹不匹配，此设备可能不是您的设备。</p>
          <p class="warning-text">建议您检查设备或联系支持。</p>
        </div>
        <div class="step-actions">
          <n-button @click="handleClose">关闭</n-button>
        </div>
      </div>
    </n-spin>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NModal, NButton, NSpin, useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { matrixEncryptionService } from '@/services/matrix'
import { matrixClientService } from '@/services/matrix'

defineOptions({
  name: 'DeviceVerifyDialog'
})

const props = defineProps<{
  show: boolean
  deviceId?: string
  deviceName?: string
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'success'): void
}>()

const message = useMessage()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

type Step = 'intro' | 'showKey' | 'success' | 'rejected'
const step = ref<Step>('intro')
const loading = ref(false)
const fingerprint = ref('')
const userId = ref('')

const fingerprintChunks = computed(() => {
  if (!fingerprint.value) return []
  return fingerprint.value.match(/.{1,4}/g) || []
})

onMounted(async () => {
  const client = matrixClientService.getClient()
  if (client) {
    userId.value = client.getUserId() || ''
  }
})

function handleCancel() {
  visible.value = false
  resetState()
}

function handleClose() {
  visible.value = false
  resetState()
}

function resetState() {
  step.value = 'intro'
  fingerprint.value = ''
  loading.value = false
}

async function startVerification() {
  loading.value = true

  try {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('客户端未初始化')
    }

    const crypto = client.getCrypto?.()
    if (!crypto) {
      throw new Error('加密模块不可用')
    }

    const targetDeviceId = props.deviceId || client.deviceId
    const keys = await crypto.getOwnDeviceKeys?.()

    if (keys?.ed25519) {
      fingerprint.value = keys.ed25519
    } else {
      const deviceKeys = await client.getStoredDevice?.(userId.value, targetDeviceId)
      if (deviceKeys) {
        fingerprint.value = deviceKeys.getFingerprint?.() || '无法获取指纹'
      }
    }

    step.value = 'showKey'
  } catch (error) {
    console.error('[DeviceVerify] 获取设备密钥失败:', error)
    message.error('获取设备密钥失败')
  } finally {
    loading.value = false
  }
}

async function handleConfirm() {
  loading.value = true

  try {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('客户端未初始化')
    }

    const targetDeviceId = props.deviceId || client.deviceId

    await matrixEncryptionService.trustDevice(userId.value, targetDeviceId)

    step.value = 'success'
    message.success('设备验证成功')
  } catch (error) {
    console.error('[DeviceVerify] 验证失败:', error)
    message.error('验证失败')
  } finally {
    loading.value = false
  }
}

function handleReject() {
  step.value = 'rejected'
}
</script>

<style scoped>
.step-content {
  padding: 16px 0;
}

.intro-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
  color: var(--primary-color, #1890ff);
}

.intro-text {
  text-align: center;
  margin-bottom: 24px;
}

.intro-text p {
  margin: 8px 0;
  color: var(--text-color, #333);
}

.device-info-card {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

:deep(.dark) .device-info-card {
  background-color: rgba(255, 255, 255, 0.05);
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.info-row:not(:last-child) {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:deep(.dark) .info-row:not(:last-child) {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.info-label {
  color: #999;
  font-size: 14px;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
}

.key-display {
  text-align: center;
  margin-bottom: 24px;
}

.key-label {
  font-size: 14px;
  color: #999;
  margin-bottom: 12px;
}

.fingerprint-display {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

.fingerprint-chunk {
  font-family: monospace;
  font-size: 18px;
  font-weight: 500;
  padding: 8px 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

:deep(.dark) .fingerprint-chunk {
  background-color: rgba(255, 255, 255, 0.05);
}

.key-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: #999;
}

.verification-question {
  text-align: center;
  margin-bottom: 16px;
}

.verification-question p {
  margin: 0;
  font-weight: 500;
}

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.success-icon,
.error-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.success-color {
  color: #52c41a;
}

.error-color {
  color: #ff4d4f;
}

.success-text,
.error-text {
  text-align: center;
}

.success-text h3,
.error-text h3 {
  margin: 0 0 8px 0;
}

.success-text p,
.error-text p {
  margin: 0;
  color: #999;
}

.warning-text {
  color: #faad14 !important;
  margin-top: 8px !important;
}
</style>
