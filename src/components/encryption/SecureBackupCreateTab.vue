<template>
  <div class="tab-content">
    <!-- Step 1: Intro -->
    <div v-if="createStep === 0" class="step-content">
      <div class="intro-icon">
        <Icon icon="mdi:shield-key" :width="64" />
      </div>
      <div class="intro-text">
        <p>{{ t('encryption.secure_backup.create_intro_primary') }}</p>
        <p class="warning-text">{{ t('encryption.secure_backup.create_intro_warning') }}</p>
      </div>
      <div class="step-actions">
        <n-button @click="emit('back-to-status')">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" @click="emit('update:createStep', 1)">
          {{ t('encryption.secure_backup.create_next') }}
        </n-button>
      </div>
    </div>

    <!-- Step 2: Show Recovery Key -->
    <div v-else-if="createStep === 1" class="step-content">
      <div class="key-display">
        <div class="key-label">{{ t('encryption.secure_backup.recovery_key_label') }}</div>
        <div class="key-value">{{ recoveryKey }}</div>
        <div class="key-actions">
          <n-button size="small" @click="emit('copy-key')">
            <template #icon><Icon icon="mdi:content-copy" :width="16" /></template>
            {{ t('encryption.backup.copy_key') }}
          </n-button>
          <n-button size="small" @click="emit('download-key')">
            <template #icon><Icon icon="mdi:download" :width="16" /></template>
            {{ t('encryption.backup.download_key') }}
          </n-button>
        </div>
      </div>
      <div class="key-warning">
        <Icon icon="mdi:alert-circle" :width="20" />
        <span>{{ t('encryption.secure_backup.key_warning') }}</span>
      </div>
      <n-checkbox
        :checked="keySaved"
        class="key-checkbox"
        @update:checked="(value: boolean) => emit('update:keySaved', value)">
        {{ t('encryption.secure_backup.key_saved_confirm') }}
      </n-checkbox>
      <div class="password-field my-16px">
        <div class="password-label text-14px mb-8px">
          {{ t('setting.account.current_password') }}
        </div>
        <n-input
          :value="currentPassword"
          type="password"
          show-password-on="click"
          :placeholder="t('setting.account.current_password_placeholder')"
          @update:value="(value: string) => emit('update:currentPassword', value)" />
      </div>

      <div class="step-actions">
        <n-button @click="emit('update:createStep', 0)">{{ t('common.back') }}</n-button>
        <n-button type="primary" :disabled="!keySaved || !currentPassword.trim()" @click="emit('create')">
          {{ t('encryption.secure_backup.create_confirm') }}
        </n-button>
      </div>
    </div>

    <!-- Step 3: Success -->
    <div v-else-if="createStep === 2" class="step-content">
      <div class="success-icon">
        <Icon icon="mdi:check-circle" :width="64" class="success-color" />
      </div>
      <div class="success-text">
        <h3>{{ t('encryption.secure_backup.create_success_title') }}</h3>
        <p>{{ t('encryption.secure_backup.create_success_desc') }}</p>
      </div>
      <div class="step-actions">
        <n-button type="primary" @click="emit('done')">
          {{ t('common.close') }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NCheckbox, NInput } from 'naive-ui'
import { useI18n } from 'vue-i18n'

defineProps<{
  createStep: number
  recoveryKey: string
  keySaved: boolean
  currentPassword: string
}>()

const emit = defineEmits<{
  (e: 'update:createStep', value: number): void
  (e: 'update:keySaved', value: boolean): void
  (e: 'update:currentPassword', value: string): void
  (e: 'create'): void
  (e: 'done'): void
  (e: 'back-to-status'): void
  (e: 'copy-key'): void
  (e: 'download-key'): void
}>()

const { t } = useI18n()

defineOptions({
  name: 'SecureBackupCreateTab'
})
</script>

<style scoped>
.tab-content {
  padding: 8px 0;
}

.step-content {
  padding: 16px 0;
}

.intro-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
  color: var(--tjg-color-primary-500);
}

.intro-text {
  text-align: center;
  margin-bottom: 24px;
}

.intro-text p {
  margin: 8px 0;
  color: var(--tjg-text-primary);
}

/* 需 !important：覆盖 naive-ui 文本组件对该色值的默认前景色 */
.warning-text {
  color: var(--tjg-color-warning-500) !important;
  font-weight: 500;
}

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.key-display {
  background-color: var(--tjg-encryption-surface-subtle);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

:deep(.dark) .key-display {
  background-color: var(--tjg-encryption-surface-dark);
}

.key-label {
  font-size: 14px;
  color: var(--tjg-text-tertiary);
  margin-bottom: 8px;
}

.key-value {
  font-family: monospace;
  font-size: 14px;
  word-break: break-all;
  line-height: 1.6;
  padding: 12px;
  background-color: var(--tjg-encryption-surface-subtle);
  border-radius: 4px;
  margin-bottom: 12px;
}

:deep(.dark) .key-value {
  background-color: var(--tjg-encryption-surface-dark);
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
  background-color: var(--tjg-color-warning-400);
  border-radius: 8px;
  margin-bottom: 16px;
  color: var(--tjg-color-warning-500);
}

.key-checkbox {
  margin-bottom: 16px;
}

.success-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.success-color {
  color: var(--tjg-color-success-500);
}

.success-text {
  text-align: center;
}

.success-text h3 {
  margin: 0 0 8px 0;
}

.success-text p {
  margin: 0;
  color: var(--tjg-text-tertiary);
}
</style>
