<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('encryption.cross_signing.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="false"
    class="cross-signing-dialog"
    style="width: 500px; max-width: 90vw">
    <n-spin :show="loading">
      <div class="cross-signing-status">
        <div class="status-icon" :class="isSetup ? 'status-active' : 'status-inactive'">
          <Icon :icon="isSetup ? 'mdi:shield-check' : 'mdi:shield-outline'" :width="48" />
        </div>
        <div class="status-info">
          <span class="status-title">
            {{ isSetup ? t('encryption.cross_signing.setup') : t('encryption.cross_signing.not_setup') }}
          </span>
          <span class="status-desc">
            {{ isSetup ? t('encryption.cross_signing.setup_desc') : t('encryption.cross_signing.not_setup_desc') }}
          </span>
        </div>
      </div>

      <n-divider />

      <div class="keys-section">
        <h4 class="section-title">{{ t('encryption.cross_signing.keys') }}</h4>

        <div class="key-item">
          <div class="key-info">
            <Icon icon="mdi:key-variant" :width="20" />
            <div class="key-text">
              <span class="key-label">{{ t('encryption.cross_signing.master_key') }}</span>
              <span class="key-value">{{ masterKeyDisplay }}</span>
            </div>
          </div>
          <n-tag :type="masterKey ? 'success' : 'default'" size="small">
            {{ masterKey ? t('encryption.cross_signing.exists') : t('encryption.cross_signing.missing') }}
          </n-tag>
        </div>

        <div class="key-item">
          <div class="key-info">
            <Icon icon="mdi:key-plus" :width="20" />
            <div class="key-text">
              <span class="key-label">{{ t('encryption.cross_signing.self_signing_key') }}</span>
              <span class="key-value">{{ selfSigningKeyDisplay }}</span>
            </div>
          </div>
          <n-tag :type="selfSigningKey ? 'success' : 'default'" size="small">
            {{ selfSigningKey ? t('encryption.cross_signing.exists') : t('encryption.cross_signing.missing') }}
          </n-tag>
        </div>

        <div class="key-item">
          <div class="key-info">
            <Icon icon="mdi:account-key" :width="20" />
            <div class="key-text">
              <span class="key-label">{{ t('encryption.cross_signing.user_signing_key') }}</span>
              <span class="key-value">{{ userSigningKeyDisplay }}</span>
            </div>
          </div>
          <n-tag :type="userSigningKey ? 'success' : 'default'" size="small">
            {{ userSigningKey ? t('encryption.cross_signing.exists') : t('encryption.cross_signing.missing') }}
          </n-tag>
        </div>
      </div>

      <n-divider />

      <div class="actions-section">
        <h4 class="section-title">{{ t('encryption.cross_signing.actions') }}</h4>

        <div class="action-item" v-if="!isSetup">
          <div class="action-info">
            <Icon icon="mdi:shield-plus" :width="24" />
            <div class="action-text">
              <span class="action-label">{{ t('encryption.cross_signing.setup_cross_signing') }}</span>
              <span class="action-desc">{{ t('encryption.cross_signing.setup_cross_signing_desc') }}</span>
            </div>
          </div>
          <n-button type="primary" :loading="settingUp" @click="handleSetup">
            {{ t('encryption.cross_signing.setup') }}
          </n-button>
        </div>

        <div class="action-item" v-if="isSetup">
          <div class="action-info">
            <Icon icon="mdi:refresh" :width="24" />
            <div class="action-text">
              <span class="action-label">{{ t('encryption.cross_signing.reset_cross_signing') }}</span>
              <span class="action-desc">{{ t('encryption.cross_signing.reset_cross_signing_desc') }}</span>
            </div>
          </div>
          <n-button type="warning" :loading="resetting" @click="handleReset">
            {{ t('encryption.cross_signing.reset') }}
          </n-button>
        </div>

        <div class="action-item">
          <div class="action-info">
            <Icon icon="mdi:content-copy" :width="24" />
            <div class="action-text">
              <span class="action-label">{{ t('encryption.cross_signing.copy_public_keys') }}</span>
              <span class="action-desc">{{ t('encryption.cross_signing.copy_public_keys_desc') }}</span>
            </div>
          </div>
          <n-button @click="handleCopyKeys">
            {{ t('encryption.cross_signing.copy') }}
          </n-button>
        </div>
      </div>
    </n-spin>

    <template #footer>
      <n-flex justify="end">
        <n-button @click="handleClose">{{ t('common.close') }}</n-button>
      </n-flex>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NDivider, NFlex, NModal, NSpin, NTag } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useEncryption } from '@/composables/encryption'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('CrossSigning')

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const encryption = useEncryption()

const visible = defineModel<boolean>('show', { default: false })

const loading = ref(false)
const settingUp = ref(false)
const resetting = ref(false)
const isSetup = ref(false)
const masterKey = ref<string | null>(null)
const selfSigningKey = ref<string | null>(null)
const userSigningKey = ref<string | null>(null)

const masterKeyDisplay = computed(() => formatKey(masterKey.value))
const selfSigningKeyDisplay = computed(() => formatKey(selfSigningKey.value))
const userSigningKeyDisplay = computed(() => formatKey(userSigningKey.value))

function formatKey(key: string | null): string {
  if (!key) return '-'
  if (key.length > 16) {
    return key.substring(0, 8) + '...' + key.substring(key.length - 8)
  }
  return key
}

const loadCrossSigningInfo = async () => {
  loading.value = true
  try {
    const info = await encryption.getCrossSigningInfo()
    isSetup.value = info.isSetup
    masterKey.value = info.masterPublicKey ?? null
    selfSigningKey.value = info.selfSigningPublicKey ?? null
    userSigningKey.value = info.userSigningPublicKey ?? null
  } catch (err) {
    logger.error('Failed to load cross-signing info:', err)
  } finally {
    loading.value = false
  }
}

const handleSetup = async () => {
  settingUp.value = true
  try {
    await encryption.setupCrossSigning()
    showFeedback(t('encryption.cross_signing.setup_success'), 'success')
    await loadCrossSigningInfo()
  } catch (err) {
    logger.error('Failed to set up cross-signing:', err)
    showFeedback(t('encryption.cross_signing.setup_failed'), 'error')
  } finally {
    settingUp.value = false
  }
}

const handleReset = async () => {
  resetting.value = true
  try {
    await encryption.resetCrossSigning()
    showFeedback(t('encryption.cross_signing.reset_success'), 'success')
    await loadCrossSigningInfo()
  } catch (err) {
    logger.error('Failed to reset cross-signing:', err)
    showFeedback(t('encryption.cross_signing.reset_failed'), 'error')
  } finally {
    resetting.value = false
  }
}

const handleCopyKeys = async () => {
  const keysText = [
    `Master Key: ${masterKey.value || '-'}`,
    `Self-Signing Key: ${selfSigningKey.value || '-'}`,
    `User-Signing Key: ${userSigningKey.value || '-'}`
  ].join('\n')

  try {
    await navigator.clipboard.writeText(keysText)
    showFeedback(t('encryption.cross_signing.copied'), 'success')
  } catch (err) {
    logger.error('Failed to copy public keys:', err)
    showFeedback(t('encryption.cross_signing.copy_failed'), 'error')
  }
}

const handleClose = () => {
  visible.value = false
}

watch(
  visible,
  (val) => {
    if (val) {
      loadCrossSigningInfo()
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.cross-signing-dialog {
  :deep(.n-card-header) {
    padding: 16px 20px;
  }

  :deep(.n-card__content) {
    padding: 16px 20px;
  }

  :deep(.n-card__footer) {
    padding: 12px 20px;
    border-top: 1px solid var(--tjg-border-default);
  }
}

.cross-signing-status {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-active {
  color: var(--tjg-color-success-500);
}

.status-inactive {
  color: var(--tjg-color-warning-500);
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
  color: var(--tjg-text-secondary);
  margin-top: 4px;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 12px 0;
}

.keys-section {
  .key-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background: var(--tjg-surface-panel-muted);
    border-radius: 8px;
    margin-bottom: 8px;
  }

  .key-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .key-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .key-label {
    font-size: 13px;
    font-weight: 500;
  }

  .key-value {
    font-size: 11px;
    font-family: monospace;
    color: var(--tjg-text-secondary);
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.actions-section {
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
    font-weight: 500;
  }

  .action-desc {
    font-size: 12px;
    color: var(--tjg-text-secondary);
    margin-top: 2px;
  }
}
</style>
