<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.encryption.dehydrated_device_section') }}</h3>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.encryption.dehydrated_device_label') }}</span>
        <span class="setting-desc">
          {{
            supported ? t('setting.encryption.dehydrated_device_desc') : t('encryption.dehydrated_device.unsupported')
          }}
        </span>
      </div>
      <n-button v-if="supported" size="small" @click="showManager = true">
        {{ t('setting.encryption.manage') }}
      </n-button>
    </div>

    <!-- 仅在 SDK/加密后端确实提供 dehydrated device 管理接口时挂载，
         否则入口点击后才会抛 TypeError。 -->
    <DehydratedDeviceManager v-if="supported" v-model:show="showManager" />
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
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DehydratedDeviceManager from '@/components/encryption/DehydratedDeviceManager.vue'
import { matrixDehydratedDeviceService } from '@/services/matrix/crypto/MatrixDehydratedDeviceService'

defineOptions({
  name: 'DehydratedDeviceSection'
})

const { t } = useI18n()
const showManager = ref(false)
const supported = ref(false)

// 设置页可能在 crypto 初始化完成前挂载，故在 mounted 时再探测一次。
onMounted(() => {
  supported.value = matrixDehydratedDeviceService.isSupported()
})
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
