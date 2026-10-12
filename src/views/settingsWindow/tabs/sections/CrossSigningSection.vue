<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.encryption.cross_signing_section') }}</h3>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.encryption.cross_signing_status_label') }}</span>
        <span class="setting-desc">
          {{ established ? t('setting.encryption.setup_complete') : t('setting.encryption.setup_incomplete') }}
        </span>
      </div>
      <n-button size="small" @click="emit('manage')">
        {{ established ? t('setting.encryption.manage') : t('setting.encryption.setup_action') }}
      </n-button>
    </div>

    <!-- R-2（2026-10-12）：「私钥是否已入 4S」与上面「交叉签名状态」是**两件事**。
         此前适配层只取 `privateKeysInSecretStorage` 并把它当成「私钥已缓存」，
         于是「建了交叉签名但没配密钥存储」与「从未建过交叉签名」在界面上完全同形，
         用户换设备后才发现私钥无法恢复。 -->
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.encryption.cross_signing_storage_label') }}</span>
        <span class="setting-desc">
          {{
            keysInSecretStorage
              ? t('setting.encryption.cross_signing_storage_ok')
              : t('setting.encryption.cross_signing_storage_missing')
          }}
        </span>
      </div>
      <n-button v-if="keysLocalOnly" size="small" type="warning" :loading="storing" @click="handleStoreKeys">
        {{ t('setting.encryption.cross_signing_store_action') }}
      </n-button>
    </div>
    <p v-if="keysLocalOnly" class="cross-signing-hint">
      {{ t('setting.encryption.cross_signing_local_only_hint') }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * 交叉签名区（含 R-2 的「私钥存储（4S）」缺口提示）。
 *
 * 为什么独立成组件：`EncryptionSettings.vue` 属于 `check:file-size` 的超限文件
 * （baseline 720 行，棘轮只许缩不许增），R-2 的 UI 内联进去会直接顶红棘轮。
 * 按本仓既有约定（`tabs/sections/*.vue`）把整段抽出，并把异步动作一并搬进来，
 * 使父组件只剩一行 tag。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useEncryptionStore } from '@/stores/domains/settings/encryption'

const emit = defineEmits<{
  /** 打开「交叉签名」管理弹窗 */
  manage: []
  /** 4S 尚未配置：需要父组件打开「安全密钥」流程（不在此处新建 4S） */
  'needs-setup': []
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const encryptionStore = useEncryptionStore()

const established = computed(() => encryptionStore.crossSigningSetup)
const keysInSecretStorage = computed(() => encryptionStore.crossSigningKeysInSecretStorage)
const keysLocalOnly = computed(() => encryptionStore.crossSigningKeysLocalOnly)
const storing = ref(false)

/**
 * 把「私钥只在本机」的缺口补上 —— 存进**既有**的 4S。
 *
 * 4S 尚未配置时**不能**在这里直接调 `bootstrapSecretStorage`：SDK 会顺手新建一个
 * 4S 密钥，而那把密钥用户从未见过（无法抄下来/无法用于新设备恢复）。
 * 故该分支交给父组件打开「安全密钥」流程，由它把新密钥展示给用户。
 */
async function handleStoreKeys() {
  storing.value = true
  try {
    const result = await encryptionStore.storeCrossSigningKeysInSecretStorage()
    if (result === 'needs-setup') {
      emit('needs-setup')
      showFeedback(t('setting.encryption.cross_signing_store_needs_setup'), 'warning')
      return
    }
    if (result === 'failed') {
      showFeedback(t('setting.encryption.cross_signing_store_failed'), 'error')
      return
    }
    showFeedback(t('setting.encryption.cross_signing_store_success'), 'success')
  } finally {
    storing.value = false
  }
}
</script>

<style scoped>
/* 与父页（EncryptionSettings）保持同一套 token 与类名：
   本仓约定每个设置页/section 自带这些布局类（见 tabs/sections/EncryptionStatusSection.vue）。 */
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

/* R-2：交叉签名私钥只在本机时的警示文案（与 .e2ee-onboarding-hint 同一套 token） */
.cross-signing-hint {
  margin-top: var(--tjg-space-3);
  padding: var(--tjg-space-3);
  background-color: var(--tjg-color-warning-100);
  border-radius: var(--tjg-radius-sm);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
}
</style>
