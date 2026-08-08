<template>
  <n-card :title="t('quota.title')" size="small">
    <n-spin :show="loading">
      <n-space vertical>
        <div class="quota-progress">
          <n-progress type="line" :percentage="quotaPercentage" :status="progressStatus" :show-indicator="true" />
          <div class="quota-info">
            <span>{{ formatBytes(quotaUsed) }} / {{ formatBytes(quotaLimit) }}</span>
          </div>
        </div>

        <n-alert v-if="isExceeded" type="error" :title="t('quota.exceeded')" class="mt-2">
          {{ t('quota.exceededMessage') }}
        </n-alert>
        <n-alert v-else-if="quotaPercentage >= 80" type="warning" :title="t('quota.warning')" class="mt-2">
          {{ t('quota.warningMessage') }}
        </n-alert>

        <div v-if="alerts.length > 0" class="alerts-section mt-4">
          <n-h4>{{ t('quota.alerts') }}</n-h4>
          <n-list size="small">
            <n-list-item v-for="alert in alerts" :key="alert.id">
              <n-thing :title="alert.message" :description="formatDate(alert.createdAt)">
                <template #header-extra>
                  <n-tag :type="alert.type === 'critical' ? 'error' : 'warning'" size="small">
                    {{ alert.type }}
                  </n-tag>
                </template>
              </n-thing>
            </n-list-item>
          </n-list>
        </div>
      </n-space>
    </n-spin>
  </n-card>
</template>

<script setup lang="ts">
import { NAlert, NCard, NH4, NList, NListItem, NProgress, NSpace, NSpin, NTag, NThing } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuotaStore } from '@/stores/domains/admin/quota'
import { formatBytes } from '@/utils/Formatting'

const { t } = useI18n()

const quotaStore = useQuotaStore()
const { quotaUsed, quotaLimit, quotaPercentage, isExceeded, alerts, loading } = storeToRefs(quotaStore)

const progressStatus = computed(() => {
  if (isExceeded.value) return 'error'
  if (quotaPercentage.value >= 80) return 'warning'
  return 'success'
})

// 统一使用 @/utils/Formatting 的 formatBytes

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

onMounted(() => {
  quotaStore.fetchQuotaStatus()
  quotaStore.fetchAlerts()
})
</script>

<style scoped lang="scss">
.quota-progress {
  margin-bottom: 16px;
}

.quota-info {
  text-align: right;
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 4px;
}

.alerts-section {
  border-top: 1px solid var(--n-border-color);
  padding-top: 16px;
}
</style>
