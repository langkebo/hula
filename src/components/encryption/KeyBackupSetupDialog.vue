<template>
  <n-modal :show="show" @update:show="emit('update:show', $event)" preset="card" :title="dialogTitle" style="width: 500px" :mask-closable="false">
    <n-spin :show="loading">
      <div v-if="step === 'intro'" class="step-content">
        <div class="intro-icon">
          <Icon icon="mdi:shield-key" :width="64" />
        </div>
        <div class="intro-text">
          <p>安全备份可以保护您的加密消息。即使您丢失设备或清除数据，也可以通过恢复密钥找回历史消息。</p>
          <p class="warning-text">请妥善保管恢复密钥，它将用于恢复您的加密消息。</p>
        </div>
        <div class="intro-actions">
          <n-button @click="handleCancel">取消</n-button>
          <n-button type="primary" @click="startSetup">开始设置</n-button>
        </div>
      </div>

      <div v-else-if="step === 'create'" class="step-content">
        <div class="create-info">
          <Icon icon="mdi:key-chain" :width="48" />
          <p>正在创建安全备份...</p>
        </div>
      </div>

      <div v-else-if="step === 'showKey'" class="step-content">
        <div class="key-display">
          <div class="key-label">您的恢复密钥</div>
          <div class="key-value">{{ recoveryKey }}</div>
          <div class="key-actions">
            <n-button size="small" @click="copyKey">
              <template #icon><Icon icon="mdi:content-copy" :width="16" /></template>
              复制密钥
            </n-button>
            <n-button size="small" @click="downloadKey">
              <template #icon><Icon icon="mdi:download" :width="16" /></template>
              下载密钥
            </n-button>
          </div>
        </div>
        <div class="key-warning">
          <Icon icon="mdi:alert-circle" :width="20" />
          <span>请将此密钥保存在安全的地方，不要分享给他人。</span>
        </div>
        <n-checkbox v-model:checked="keySaved" class="key-checkbox">我已安全保存恢复密钥</n-checkbox>
        <div class="step-actions">
          <n-button @click="handleCancel">取消</n-button>
          <n-button type="primary" :disabled="!keySaved" @click="confirmSetup">确认完成</n-button>
        </div>
      </div>

      <div v-else-if="step === 'verify'" class="step-content">
        <div class="verify-info">
          <p>请输入您刚才保存的恢复密钥以确认备份已正确保存：</p>
        </div>
        <n-input
          v-model:value="verifyKey"
          type="textarea"
          placeholder="请输入恢复密钥"
          :rows="3"
          class="verify-input" />
        <div class="step-actions">
          <n-button @click="step = 'showKey'">返回</n-button>
          <n-button type="primary" :disabled="!verifyKey.trim()" @click="verifyKeyInput">验证密钥</n-button>
        </div>
      </div>

      <div v-else-if="step === 'success'" class="step-content">
        <div class="success-icon">
          <Icon icon="mdi:check-circle" :width="64" class="success-color" />
        </div>
        <div class="success-text">
          <h3>安全备份设置成功！</h3>
          <p>您的加密消息现在已受到保护。</p>
        </div>
        <div class="step-actions">
          <n-button type="primary" @click="handleClose">完成</n-button>
        </div>
      </div>
    </n-spin>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NModal, NButton, NSpin, NCheckbox, NInput, useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { matrixEncryptionService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'
const logger = createLogger('KeyBackupSetup')

defineOptions({
  name: 'KeyBackupSetupDialog'
})

const props = defineProps<{
  show: boolean
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

type Step = 'intro' | 'create' | 'showKey' | 'verify' | 'success'
const step = ref<Step>('intro')
const loading = ref(false)
const recoveryKey = ref('')
const keySaved = ref(false)
const verifyKey = ref('')

const dialogTitle = computed(() => {
  switch (step.value) {
    case 'intro':
      return '设置安全备份'
    case 'create':
      return '创建备份中'
    case 'showKey':
      return '保存恢复密钥'
    case 'verify':
      return '验证恢复密钥'
    case 'success':
      return '设置完成'
    default:
      return '安全备份'
  }
})

function handleCancel() {
  visible.value = false
  resetState()
}

function handleClose() {
  visible.value = false
  resetState()
  emit('success')
}

function resetState() {
  step.value = 'intro'
  recoveryKey.value = ''
  keySaved.value = false
  verifyKey.value = ''
  loading.value = false
}

async function startSetup() {
  loading.value = true
  step.value = 'create'

  try {
    const key = await matrixEncryptionService.setupKeyBackup()
    recoveryKey.value = key
    step.value = 'showKey'
  } catch (error) {
    logger.error('创建备份失败:', error)
    message.error('创建安全备份失败，请稍后重试')
    step.value = 'intro'
  } finally {
    loading.value = false
  }
}

function copyKey() {
  navigator.clipboard
    .writeText(recoveryKey.value)
    .then(() => message.success('恢复密钥已复制到剪贴板'))
    .catch(() => message.error('复制失败，请手动复制'))
}

function downloadKey() {
  const blob = new Blob([recoveryKey.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hula-recovery-key-${Date.now()}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  message.success('恢复密钥已下载')
}

function confirmSetup() {
  step.value = 'verify'
}

async function verifyKeyInput() {
  if (verifyKey.value.trim() !== recoveryKey.value) {
    message.error('密钥不匹配，请重新输入')
    return
  }

  loading.value = true
  try {
    const backupInfo = await matrixEncryptionService.getKeyBackupInfo()
    if (backupInfo) {
      step.value = 'success'
      message.success('安全备份验证成功')
    } else {
      message.error('备份验证失败，请重试')
    }
  } catch (error) {
    logger.error('验证备份失败:', error)
    message.error('验证备份失败')
  } finally {
    loading.value = false
  }
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

.warning-text {
  color: #faad14 !important;
  font-weight: 500;
}

.intro-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.create-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 0;
}

.key-display {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

:deep(.dark) .key-display {
  background-color: rgba(255, 255, 255, 0.05);
}

.key-label {
  font-size: 14px;
  color: #999;
  margin-bottom: 8px;
}

.key-value {
  font-family: monospace;
  font-size: 14px;
  word-break: break-all;
  line-height: 1.6;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
  margin-bottom: 12px;
}

:deep(.dark) .key-value {
  background-color: rgba(255, 255, 255, 0.05);
}

.key-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.key-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: rgba(250, 173, 20, 0.1);
  border-radius: 8px;
  margin-bottom: 16px;
  color: #faad14;
}

.key-checkbox {
  margin-bottom: 16px;
}

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.verify-info {
  margin-bottom: 16px;
}

.verify-input {
  margin-bottom: 16px;
}

.success-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.success-color {
  color: #52c41a;
}

.success-text {
  text-align: center;
}

.success-text h3 {
  margin: 0 0 8px 0;
}

.success-text p {
  margin: 0;
  color: #999;
}
</style>
