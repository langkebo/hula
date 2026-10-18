<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.security.encryption_status') }}</h3>
    <div class="encryption-status">
      <div class="status-icon">
        <Icon
          :icon="encryptionEnabled ? 'mdi:shield-check' : 'mdi:shield-off'"
          :width="48"
          :class="encryptionEnabled ? 'status-secure' : 'status-insecure'" />
      </div>
      <div class="status-info">
        <div class="status-title">
          {{
            encryptionEnabled
              ? t('setting.security.encryption_enabled_title')
              : t('setting.security.encryption_disabled_title')
          }}
        </div>
        <div class="status-desc">
          {{
            encryptionEnabled
              ? t('setting.security.encryption_enabled_desc')
              : t('setting.security.encryption_disabled_desc')
          }}
        </div>
      </div>
    </div>
  </div>

  <!-- F-4：本地密钥库加密状态。三档而非两档 —— degraded 仍然加密，
       不能把「原生密钥库不可用」误报成「明文落盘」（错误告警会训练用户忽略告警）。 -->
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.security.local_store_status') }}</h3>
    <div class="local-store-status" :class="`local-store-status--${localStoreLevelKey}`">
      <span class="local-store-status__dot" aria-hidden="true"></span>
      <div class="local-store-status__body">
        <span class="local-store-status__title">
          {{ t(localStoreTitleKey) }}
        </span>
        <span class="local-store-status__desc">
          {{ t(localStoreDescKey) }}
        </span>
      </div>
    </div>
  </div>

  <n-divider />

  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.security.recovery_key') }}</h3>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.security.security_key_label') }}</span>
        <span class="setting-desc">
          {{
            securityKeyConfigured
              ? t('setting.security.security_key_configured_desc')
              : t('setting.security.security_key_not_configured_desc')
          }}
        </span>
      </div>
      <n-button size="small" @click="emit('manage-security-key')">
        {{ securityKeyConfigured ? t('setting.security.manage') : t('setting.security.setup_action') }}
      </n-button>
    </div>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.security.backup_label') }}</span>
        <span class="setting-desc">{{ backupStatusText }}</span>
      </div>
      <n-button size="small" :loading="backupLoading" @click="emit('setup-backup')">
        {{ hasBackup ? t('setting.security.manage_backup') : t('setting.security.setup_backup') }}
      </n-button>
    </div>
    <div v-if="hasBackup" class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.security.export_recovery_key') }}</span>
        <span class="setting-desc">{{ t('setting.security.export_recovery_key_desc') }}</span>
      </div>
      <n-button size="small" :loading="exportLoading" @click="emit('export-key')">
        {{ t('setting.security.export') }}
      </n-button>
    </div>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.security.secure_backup_label') }}</span>
        <span class="setting-desc">{{ t('setting.security.secure_backup_desc') }}</span>
      </div>
      <n-button size="small" @click="emit('manage-secure-backup')">
        {{ t('setting.security.manage') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NDivider } from 'naive-ui'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEncryptionStore } from '@/stores/domains/settings/encryption'

defineOptions({
  name: 'EncryptionStatusSection'
})

interface BackupInfo {
  version: string | null
  count: number
}

const props = defineProps<{
  encryptionEnabled: boolean
  securityKeyConfigured: boolean
  hasBackup: boolean
  backupInfo: BackupInfo | null
  backupLoading: boolean
  exportLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'setup-backup'): void
  (e: 'export-key'): void
  (e: 'manage-security-key'): void
  (e: 'manage-secure-backup'): void
}>()

const { t } = useI18n()

const encryptionStore = useEncryptionStore()

/**
 * 把 store 的四档等级映射成 i18n key 片段。
 * `unknown` 也要有自己的文案：未登录时不能显示「未加密」（那是误报）。
 */
/**
 * 四档文案的**静态** key 映射。
 *
 * 刻意不用 `t(\`setting.security.local_store_${level}_title\`)`：
 * 动态拼接会让 `check:i18n-dead-keys` 无法静态判活，这些 key 会被归入
 * 「动态族」，每加一档就多一条 delta（还可能顺手把真孤儿洗掉）。
 */
const LOCAL_STORE_KEYS = {
  native: {
    title: 'setting.security.local_store_native_title',
    desc: 'setting.security.local_store_native_desc'
  },
  degraded: {
    title: 'setting.security.local_store_degraded_title',
    desc: 'setting.security.local_store_degraded_desc'
  },
  plaintext: {
    title: 'setting.security.local_store_plaintext_title',
    desc: 'setting.security.local_store_plaintext_desc'
  },
  unknown: {
    title: 'setting.security.local_store_unknown_title',
    desc: 'setting.security.local_store_unknown_desc'
  }
} as const

const localStoreKeySet = computed(() => LOCAL_STORE_KEYS[localStoreLevelKey.value])
const localStoreTitleKey = computed(() => localStoreKeySet.value.title)
const localStoreDescKey = computed(() => localStoreKeySet.value.desc)

const localStoreLevelKey = computed(() => {
  const level = encryptionStore.localStoreEncryption
  if (level === 'encrypted-native') return 'native'
  if (level === 'encrypted-degraded') return 'degraded'
  if (level === 'plaintext') return 'plaintext'
  return 'unknown'
})

onMounted(() => {
  void encryptionStore.loadLocalStoreEncryptionStatus()
})

// 备份状态文案：根据加密开关与备份信息计算
const backupStatusText = computed(() => {
  if (!props.encryptionEnabled) {
    return t('setting.security.backup_not_enabled')
  }
  if (props.hasBackup && props.backupInfo) {
    return t('setting.security.backup_count', { count: String(props.backupInfo.count) })
  }
  return t('setting.security.backup_not_configured')
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

.encryption-status {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-4);
  padding: var(--tjg-space-4);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-secure {
  color: var(--tjg-color-success-500);
}

.status-insecure {
  color: var(--tjg-color-warning-500);
}

.status-info {
  display: flex;
  flex-direction: column;
}

.status-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.status-desc {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-3) 0;
  border-bottom: 1px solid var(--tjg-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
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
