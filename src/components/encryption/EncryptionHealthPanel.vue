<template>
  <div class="encryption-health">
    <n-space vertical :size="12">
      <n-alert v-if="!status.crossSigningReady" type="warning" :show-icon="true">
        {{ t('encryption.health.cross_signing_incomplete') }}
      </n-alert>
      <n-alert v-if="status.hasUnverifiedDevices" type="info" :show-icon="true">
        {{ t('encryption.health.unverified_devices') }}
      </n-alert>
      <n-alert v-if="!status.isKeyBackupSynced" type="warning" :show-icon="true">
        {{ t('encryption.health.backup_not_synced') }}
      </n-alert>
      <n-alert v-if="status.undecryptableMessageCount > 0" type="error" :show-icon="true">
        {{ t('encryption.health.undecryptable', { count: status.undecryptableMessageCount }) }}
      </n-alert>
      <n-alert v-if="allGood" type="success" :show-icon="true">
        {{ t('encryption.health.all_good') }}
      </n-alert>
    </n-space>
    <n-button v-if="!allGood" class="mt-12px" size="small" @click="refresh" :loading="loading">
      {{ t('encryption.health.recheck') }}
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { NAlert, NButton, NSpace } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type CryptoHealthStatus, useEncryption } from '@/composables/encryption'

const { t } = useI18n()
const encryption = useEncryption()
const loading = ref(false)

const status = ref<CryptoHealthStatus>({
  hasUnverifiedDevices: false,
  isKeyBackupSynced: true,
  undecryptableMessageCount: 0,
  crossSigningReady: false,
  lastCheckTime: 0
})

const allGood = computed(
  () =>
    !status.value.hasUnverifiedDevices &&
    status.value.isKeyBackupSynced &&
    status.value.crossSigningReady &&
    status.value.undecryptableMessageCount === 0
)

async function refresh() {
  loading.value = true
  try {
    status.value = await encryption.getHealthStatus()
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  encryption.registerHealthCallbacks({
    onHealthStatusChange: (newStatus) => {
      status.value = newStatus
    }
  })
  status.value = await encryption.getHealthStatus()
})
</script>

<style scoped>
.encryption-health {
  padding: 8px 0;
}
</style>
