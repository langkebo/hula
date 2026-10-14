<template>
  <div class="admin-server-logs">
    <n-page-header :title="t('admin.logs.title')" :subtitle="t('admin.logs.subtitle')">
      <template #extra>
        <n-button @click="loadPanel" :loading="loading">
          {{ t('common.refresh') }}
        </n-button>
      </template>
    </n-page-header>

    <n-alert type="info" class="my-12px">
      {{ t('admin.logs.panel_notice') }}
    </n-alert>

    <n-spin :show="loading">
      <div class="panel-grid">
        <n-card :title="t('admin.logs.runtime_status')" size="small">
          <n-descriptions bordered :column="1" label-placement="left">
            <n-descriptions-item :label="t('admin.logs.status')">
              <n-tag :type="statusTagType">{{ statusLabel }}</n-tag>
            </n-descriptions-item>
          </n-descriptions>
        </n-card>

        <n-card :title="t('admin.logs.health_check')" size="small">
          <n-descriptions bordered :column="1" label-placement="left">
            <n-descriptions-item :label="t('admin.logs.health_status')">
              <n-tag :type="health?.healthy ? 'success' : 'error'">
                {{ health?.healthy ? 'Healthy' : 'Unhealthy' }}
              </n-tag>
            </n-descriptions-item>
            <n-descriptions-item :label="t('admin.logs.checks')">
              <pre class="panel-pre">{{ JSON.stringify(health?.checks ?? {}, null, 2) }}</pre>
            </n-descriptions-item>
          </n-descriptions>
        </n-card>

        <n-card :title="t('admin.logs.version_info')" size="small">
          <n-descriptions bordered :column="1" label-placement="left">
            <n-descriptions-item label="Server">
              {{ version?.serverVersion || '-' }}
            </n-descriptions-item>
            <n-descriptions-item label="Python">
              {{ version?.pythonVersion || '-' }}
            </n-descriptions-item>
          </n-descriptions>
        </n-card>

        <n-card :title="t('admin.logs.stats_info')" size="small">
          <n-descriptions bordered :column="1" label-placement="left">
            <n-descriptions-item :label="t('admin.total_users')">
              {{ stats?.userCount ?? '-' }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('admin.total_rooms')">
              {{ stats?.roomCount ?? '-' }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('admin.active_users')">
              {{ stats?.dailyActiveUsers ?? '-' }}
            </n-descriptions-item>
          </n-descriptions>
        </n-card>
      </div>
    </n-spin>

    <EmptyState
      v-if="!loading && !status && !health && !version && !stats"
      icon="mdi:alert-circle-outline"
      :description="t('admin.load_failed')" />
  </div>
</template>

<script setup lang="ts">
import { NAlert, NButton, NCard, NDescriptions, NDescriptionsItem, NPageHeader, NSpin, NTag } from 'naive-ui'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import { useAdminServerLogs } from '@/composables/admin'

const { t } = useI18n()
const { loading, status, health, version, stats, loadPanel } = useAdminServerLogs()

const statusLabel = computed(() => {
  switch (status.value?.status) {
    case 'online':
      return 'Online'
    case 'degraded':
      return 'Degraded'
    case 'offline':
      return 'Offline'
    default:
      return '-'
  }
})

const statusTagType = computed(() => {
  switch (status.value?.status) {
    case 'online':
      return 'success'
    case 'degraded':
      return 'warning'
    case 'offline':
      return 'error'
    default:
      return 'default'
  }
})

onMounted(() => loadPanel())
</script>

<style scoped>
.admin-server-logs {
  padding: 16px 24px;
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.panel-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
