<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.encryption.info_section') }}</h3>
    <div class="encryption-info">
      <div class="info-item">
        <span class="info-label">{{ t('setting.encryption.algorithm_label') }}</span>
        <span class="info-value">{{ algorithm }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">{{ t('setting.encryption.verified_devices_label') }}</span>
        <span class="info-value">{{ t('setting.encryption.device_count', { count: String(verifiedCount) }) }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">{{ t('setting.encryption.unverified_devices_label') }}</span>
        <span class="info-value">{{ t('setting.encryption.device_count', { count: String(unverifiedCount) }) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ algorithm: string; verifiedCount: number; unverifiedCount: number }>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-4);
  color: var(--tjg-text-primary);
}

.encryption-info {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-4);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-secondary);
}

.info-value {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}
</style>
