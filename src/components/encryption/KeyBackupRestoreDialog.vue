<template>
  <n-modal v-model:show="visible" preset="card" title="恢复密钥备份" style="width: 500px" :mask-closable="false">
    <n-spin :show="loading">
      <div class="restore-content">
        <div class="intro-text">
          <p>输入您的恢复密钥以还原加密消息历史。</p>
          <p class="hint-text">恢复密钥是一串字符，您在设置备份时保存的。</p>
        </div>

        <n-form ref="formRef" :model="formData" label-placement="top">
          <n-form-item label="恢复密钥" path="recoveryKey">
            <n-input
              v-model:value="formData.recoveryKey"
              type="textarea"
              placeholder="请输入恢复密钥"
              :rows="4"
              :disabled="loading" />
          </n-form-item>
        </n-form>

        <div v-if="restoreProgress !== null" class="progress-section">
          <n-progress type="line" :percentage="restoreProgress" :indicator-placement="'inside'" processing />
          <div class="progress-text">正在恢复密钥... {{ restoreProgress }}%</div>
        </div>

        <div v-if="restoreResult" class="result-section" :class="restoreResult.success ? 'success' : 'error'">
          <Icon :icon="restoreResult.success ? 'mdi:check-circle' : 'mdi:alert-circle'" :width="24" />
          <span>{{ restoreResult.message }}</span>
        </div>
      </div>
    </n-spin>

    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" :disabled="loading">取消</n-button>
        <n-button type="primary" :loading="loading" :disabled="!formData.recoveryKey.trim()" @click="handleRestore">
          恢复
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { NModal, NButton, NSpin, NForm, NFormItem, NInput, NProgress, useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { matrixEncryptionService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'
const logger = createLogger('KeyBackupRestore')
const timerManager = useTimerManager()

defineOptions({
  name: 'KeyBackupRestoreDialog'
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

const loading = ref(false)
const restoreProgress = ref<number | null>(null)
const restoreResult = ref<{ success: boolean; message: string } | null>(null)

const formData = reactive({
  recoveryKey: ''
})

function handleCancel() {
  visible.value = false
  resetState()
}

function resetState() {
  formData.recoveryKey = ''
  loading.value = false
  restoreProgress.value = null
  restoreResult.value = null
}

async function handleRestore() {
  if (!formData.recoveryKey.trim()) {
    message.warning('请输入恢复密钥')
    return
  }

  loading.value = true
  restoreProgress.value = 0
  restoreResult.value = null
  let progressInterval: number | null = null

  try {
    progressInterval = timerManager.setInterval(() => {
      if (restoreProgress.value !== null && restoreProgress.value < 90) {
        restoreProgress.value += 10
      }
    }, 200)

    const result = await matrixEncryptionService.restoreFromBackup(formData.recoveryKey.trim())

    timerManager.clearInterval(progressInterval)
    restoreProgress.value = 100

    restoreResult.value = {
      success: true,
      message: `成功恢复 ${result.imported} 个密钥`
    }

    message.success('密钥恢复成功')

    timerManager.setTimeout(() => {
      visible.value = false
      resetState()
      emit('success')
    }, 1500)
  } catch (error) {
    logger.error('恢复失败:', error)
    restoreProgress.value = null
    restoreResult.value = {
      success: false,
      message: '恢复失败，请检查密钥是否正确'
    }
    message.error('恢复失败')
  } finally {
    if (progressInterval !== null) {
      timerManager.clearInterval(progressInterval)
    }
    loading.value = false
  }
}
</script>

<style scoped>
.restore-content {
  padding: 8px 0;
}

.intro-text {
  margin-bottom: 20px;
}

.intro-text p {
  margin: 4px 0;
}

.hint-text {
  color: var(--color-text-quaternary);
  font-size: 13px;
}

.progress-section {
  margin-top: 16px;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .progress-section {
  background-color: rgba(255, 255, 255, 0.05);
}

.progress-text {
  text-align: center;
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-text-quaternary);
}

.result-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
}

.result-section.success {
  background-color: var(--color-success-light);
  color: var(--color-success);
}

.result-section.error {
  background-color: var(--color-danger-hover);
  color: var(--color-danger);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
