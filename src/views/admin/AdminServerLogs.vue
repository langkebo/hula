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
      此页已切换为服务器状态面板，直接消费后端已实现的状态、健康、版本与统计接口。
    </n-alert>

    <n-spin :show="loading">
      <div class="panel-grid">
        <n-card title="运行状态" size="small">
          <n-descriptions bordered :column="1" label-placement="left">
            <n-descriptions-item label="状态">
              <n-tag :type="statusTagType">{{ statusLabel }}</n-tag>
            </n-descriptions-item>
            <n-descriptions-item label="运行时长">
              {{ formatDuration(status?.uptime) }}
            </n-descriptions-item>
          </n-descriptions>
        </n-card>

        <n-card title="健康检查" size="small">
          <n-descriptions bordered :column="1" label-placement="left">
            <n-descriptions-item label="健康状态">
              <n-tag :type="health?.healthy ? 'success' : 'error'">
                {{ health?.healthy ? 'Healthy' : 'Unhealthy' }}
              </n-tag>
            </n-descriptions-item>
            <n-descriptions-item label="检查项">
              <pre class="panel-pre">{{ JSON.stringify(health?.checks ?? {}, null, 2) }}</pre>
            </n-descriptions-item>
          </n-descriptions>
        </n-card>

        <n-card title="版本信息" size="small">
          <n-descriptions bordered :column="1" label-placement="left">
            <n-descriptions-item label="Server">
              {{ version?.serverVersion || '-' }}
            </n-descriptions-item>
            <n-descriptions-item label="Python">
              {{ version?.pythonVersion || '-' }}
            </n-descriptions-item>
          </n-descriptions>
        </n-card>

        <n-card title="统计信息" size="small">
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

    <div v-if="!loading && !status && !health && !version && !stats" class="empty-state">
      {{ t('admin.load_failed') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { NPageHeader, NButton, NTag, NSpin, NAlert, NCard, NDescriptions, NDescriptionsItem } from 'naive-ui'
import { useI18n } from 'vue-i18n'
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

function formatDuration(value?: number): string {
  if (!value) return '-'
  const seconds = value > 1_000_000 ? Math.floor(value / 1000) : Math.floor(value)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${days}d ${hours}h ${minutes}m`
}

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

.empty-state {
  padding: 48px 0;
  text-align: center;
  opacity: 0.6;
}
</style>
