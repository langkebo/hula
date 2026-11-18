<template>
  <div class="tab-content">
    <div class="intro-text">
      <p>{{ t('encryption.secure_backup.restore_intro') }}</p>
    </div>
    <n-input
      :value="restoreRecoveryKey"
      type="textarea"
      :placeholder="t('setting.encryption.recovery_key_placeholder')"
      :rows="4"
      :disabled="restoreLoading"
      @update:value="(value: string) => emit('update:restoreRecoveryKey', value)" />

    <!-- Restore result -->
    <n-alert
      v-if="restoreResult"
      :type="restoreResult.success ? 'success' : 'error'"
      :title="
        restoreResult.success
          ? t('encryption.secure_backup.restore_success')
          : t('encryption.secure_backup.restore_failed')
      "
      closable
      @close="emit('clear-result')"
      class="mt-12px">
      <template v-if="restoreResult.success">
        {{ t('encryption.secure_backup.restore_success_desc', { imported: restoreResult.imported }) }}
      </template>
      <template v-else>
        {{ t('encryption.secure_backup.restore_failed_desc') }}
      </template>
    </n-alert>

    <div class="step-actions mt-16px">
      <n-button @click="emit('back-to-status')">{{ t('common.back') }}</n-button>
      <n-button
        type="primary"
        :loading="restoreLoading"
        :disabled="!restoreRecoveryKey.trim()"
        @click="emit('restore')">
        {{ t('setting.encryption.restore') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NAlert, NButton, NInput } from 'naive-ui'
import { useI18n } from 'vue-i18n'

defineProps<{
  restoreRecoveryKey: string
  restoreLoading: boolean
  restoreResult: { success: boolean; imported: number } | null
}>()

const emit = defineEmits<{
  (e: 'update:restoreRecoveryKey', value: string): void
  (e: 'restore'): void
  (e: 'back-to-status'): void
  (e: 'clear-result'): void
}>()

const { t } = useI18n()

defineOptions({
  name: 'SecureBackupRestoreTab'
})
</script>

<style scoped>
.tab-content {
  padding: 8px 0;
}

.intro-text {
  text-align: center;
  margin-bottom: 24px;
}

.intro-text p {
  margin: 8px 0;
  color: var(--tjg-text-primary);
}

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
