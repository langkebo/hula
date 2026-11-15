<template>
  <div v-if="supported" class="settings-section" data-testid="dehydrated-device-section">
    <h3 class="section-title">{{ t('setting.encryption.dehydrated_device_section') }}</h3>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.encryption.dehydrated_device_label') }}</span>
        <span class="setting-desc">{{ t('setting.encryption.dehydrated_device_desc') }}</span>
      </div>
      <n-button size="small" @click="showManager = true">
        {{ t('setting.encryption.manage') }}
      </n-button>
    </div>

    <!-- 仅在 SDK/加密后端确实提供 dehydrated device 管理接口时挂载，
         否则入口点击后才会抛 TypeError。 -->
    <DehydratedDeviceManager v-model:show="showManager" />
  </div>
</template>

<script setup lang="ts">
/**
 * 脱水设备区（MSC3814）。
 *
 * 独立成组件的原因同 `CrossSigningSection.vue`：`EncryptionSettings.vue` 属
 * `check:file-size` 超限文件（baseline 712 行，棘轮只许缩不许增），内联会顶红棘轮。
 */
import { NButton } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DehydratedDeviceManager from '@/components/encryption/DehydratedDeviceManager.vue'
import { matrixDehydratedDeviceService } from '@/services/matrix/crypto/MatrixDehydratedDeviceService'
import { useServerCapability } from '@/services/matrix/MatrixCapabilityService'

defineOptions({
  name: 'DehydratedDeviceSection'
})

const { t } = useI18n()
const showManager = ref(false)
const capability = useServerCapability()

/**
 * 能力门控（CAP-02）：服务端未声明 `dehydrated-device`（MSC3814，含 unknown 三态）
 * 或加密后端未提供管理接口时整块不渲染，避免只读占位与点击后才抛错的入口。
 *
 * `getCapabilityStatus` 内部读取能力快照的响应式状态，快照异步到达后会自动重算，
 * 因此不再需要在 mounted 里手工探测一次。
 */
const supported = computed(
  () =>
    capability.getCapabilityStatus('dehydrated-device') === 'supported' && matrixDehydratedDeviceService.isSupported()
)
</script>

<style scoped>
.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-4);
  color: var(--tjg-text-primary);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-3) 0;
  border-bottom: 1px solid var(--tjg-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.setting-label {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}

.setting-desc {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}
</style>
