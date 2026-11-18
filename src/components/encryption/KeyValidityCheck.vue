<template>
  <div class="action-item">
    <div class="action-info">
      <Icon icon="mdi:key-check" :width="24" />
      <div class="action-text">
        <span class="action-label">{{ t('encryption.key_rotation.validate_key') }}</span>
        <span class="action-desc">{{ t('encryption.key_rotation.validate_desc') }}</span>
      </div>
    </div>
    <div class="validate-controls">
      <n-input
        v-model:value="keyId"
        data-testid="key-rotation-validate-key-id"
        :placeholder="t('encryption.key_rotation.validate_key_id_placeholder')"
        class="w-[200px]" />
      <n-button data-testid="key-rotation-validate" :loading="validating" @click="handleValidate">
        {{ validating ? t('encryption.key_rotation.validating') : t('encryption.key_rotation.validate') }}
      </n-button>
    </div>
  </div>

  <div v-if="validityResult !== null" class="validate-result">
    <n-alert
      data-testid="key-rotation-validate-result"
      :type="validityResult.needsRotation ? 'warning' : 'success'"
      :title="
        validityResult.needsRotation
          ? t('encryption.key_rotation.validate_result_needs_rotation')
          : t('encryption.key_rotation.validate_result_ok')
      ">
      <div class="validate-detail">
        <span>
          {{ t('encryption.key_rotation.check_last_rotation') }}: {{ formatDate(validityResult.lastRotation) }}
        </span>
      </div>
      <div v-if="validityResult.intervalMs > 0" class="validate-detail">
        <span>
          {{ t('encryption.key_rotation.check_interval') }}:
          {{ Math.round(validityResult.intervalMs / (24 * 60 * 60 * 1000)) }} {{ t('common.days') }}
        </span>
      </div>
    </n-alert>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NAlert, NButton, NInput } from 'naive-ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type KeyValidityResult, useEncryption } from '@/composables/encryption'
import { createLogger } from '@/utils/Logger'

defineOptions({
  name: 'KeyValidityCheck'
})

const props = defineProps<{
  /** 服务端当前密钥 ID，用于预填输入框 */
  defaultKeyId?: string | undefined
}>()

const logger = createLogger('KeyValidityCheck')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const encryption = useEncryption()

const keyId = ref('')
const validating = ref(false)
const validityResult = ref<KeyValidityResult | null>(null)

const formatDate = (timestamp?: number | null): string => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString()
}

watch(
  () => props.defaultKeyId,
  (value) => {
    if (!keyId.value && value) {
      keyId.value = value
    }
  },
  { immediate: true }
)

async function handleValidate() {
  const target = keyId.value.trim()
  if (!target) {
    showFeedback(t('encryption.key_rotation.validate_key_id_required'), 'warning')
    return
  }
  validating.value = true
  validityResult.value = null
  try {
    const result = await encryption.checkKeyValidity(target)
    if (result === null) {
      showFeedback(t('encryption.key_rotation.validate_failed'), 'error')
      return
    }
    validityResult.value = result
    showFeedback(
      result.needsRotation
        ? t('encryption.key_rotation.validate_result_needs_rotation')
        : t('encryption.key_rotation.validate_result_ok'),
      result.needsRotation ? 'warning' : 'success'
    )
  } catch (err) {
    logger.error('Failed to validate key:', err)
    showFeedback(t('encryption.key_rotation.validate_failed'), 'error')
  } finally {
    validating.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/responsive.scss' as responsive;

.action-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
  margin-bottom: 8px;
}

.action-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.action-text {
  display: flex;
  flex-direction: column;
}

.action-label {
  font-size: 14px;
}

.action-desc {
  font-size: 12px;
  color: var(--tjg-text-secondary);
}

.validate-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

@include responsive.down('sm') {
  .validate-controls {
    flex-direction: column;
    align-items: stretch;
  }
}

.validate-result {
  margin-top: 8px;
}

.validate-detail {
  font-size: 12px;
  margin-top: 4px;
}
</style>
