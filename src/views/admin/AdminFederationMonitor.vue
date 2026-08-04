<template>
  <div class="admin-federation-monitor">
    <n-page-header :title="t('admin.federation_monitor.title')" :subtitle="t('admin.federation_monitor.subtitle')">
      <template #extra>
        <n-button @click="loadData" :loading="loading">
          {{ t('common.refresh') }}
        </n-button>
      </template>
    </n-page-header>

    <n-grid :cols="3" :x-gap="16" :y-gap="16" class="mb-20px">
      <n-gi>
        <n-card size="small">
          <n-statistic :label="t('admin.federation_monitor.total_servers')">
            <template #default>{{ serverList.length }}</template>
          </n-statistic>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card size="small">
          <n-statistic :label="t('admin.federation_monitor.online_servers')">
            <template #default>
              <span class="text-[--tjg-color-success-500]">{{ onlineCount }}</span>
            </template>
          </n-statistic>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card size="small">
          <n-statistic :label="t('admin.federation_monitor.offline_servers')">
            <template #default>
              <span class="text-[--tjg-color-danger-500]">{{ offlineCount }}</span>
            </template>
          </n-statistic>
        </n-card>
      </n-gi>
    </n-grid>

    <n-input
      v-model:value="searchTerm"
      :placeholder="t('admin.federation_monitor.search_placeholder')"
      clearable
      class="mb-16px"
      style="max-width: 320px" />

    <n-data-table
      :columns="columns"
      :data="filteredServers"
      :loading="loading"
      :pagination="pagination"
      :row-key="(row: FederationServer) => row.serverName"
      striped />
  </div>
</template>

<script setup lang="ts">
import {
  type DataTableColumns,
  NButton,
  NCard,
  NDataTable,
  NGi,
  NGrid,
  NInput,
  NPageHeader,
  NSpace,
  NStatistic,
  NTag
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { adminService } from '@/services/matrix/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminFederationMonitor')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

interface FederationServer {
  serverName: string
  status: 'online' | 'offline' | 'unknown'
  lastContact?: number
  retryInterval?: number
  failureCount?: number
}

const loading = ref(false)
const searchTerm = ref('')
const serverList = ref<FederationServer[]>([])

const pagination = { pageSize: 15 }

const onlineCount = computed(() => serverList.value.filter((s) => s.status === 'online').length)
const offlineCount = computed(() => serverList.value.filter((s) => s.status !== 'online').length)

const filteredServers = computed(() => {
  if (!searchTerm.value.trim()) return serverList.value
  const term = searchTerm.value.toLowerCase()
  return serverList.value.filter((s) => s.serverName.toLowerCase().includes(term))
})

const columns: DataTableColumns<FederationServer> = [
  { title: t('admin.federation_monitor.col_server'), key: 'serverName', width: 240, ellipsis: { tooltip: true } },
  {
    title: t('admin.federation_monitor.col_status'),
    key: 'status',
    width: 100,
    render: (row) =>
      h(
        NTag,
        {
          size: 'small',
          type: row.status === 'online' ? 'success' : row.status === 'offline' ? 'error' : 'default'
        },
        () => row.status
      )
  },
  {
    title: t('admin.federation_monitor.col_last_contact'),
    key: 'lastContact',
    width: 180,
    render: (row) => (row.lastContact ? new Date(row.lastContact).toLocaleString() : '-')
  },
  {
    title: t('admin.federation_monitor.col_failures'),
    key: 'failureCount',
    width: 100,
    render: (row) => String(row.failureCount ?? 0)
  },
  {
    title: t('admin.federation_monitor.col_actions'),
    key: 'actions',
    width: 120,
    render: (row) =>
      h(NSpace, { size: 'small' }, () => [
        row.status !== 'online'
          ? h(NButton, { size: 'tiny', type: 'primary', onClick: () => reconnect(row.serverName) }, () =>
              t('admin.federation_monitor.reconnect')
            )
          : null
      ])
  }
]

async function reconnect(serverName: string) {
  try {
    await adminService.reconnectFederation(serverName)
    showFeedback(t('admin.federation_monitor.reconnect_success'), 'success')
    await loadData()
  } catch (err) {
    logger.error('重连联邦服务器失败:', err)
    showFeedback(t('admin.federation_monitor.reconnect_failed'), 'error')
  }
}

async function loadData() {
  loading.value = true
  try {
    const blacklist = await adminService.getFederationBlacklist()
    const blockedServers = Array.isArray(blacklist) ? blacklist : []

    const servers: FederationServer[] = []
    for (const entry of blockedServers) {
      const serverName = entry.domain
      if (!serverName) continue

      const status = await adminService.getFederationServerStatus(serverName)
      servers.push({
        serverName,
        status: status?.reachable ? 'online' : 'offline',
        lastContact: status?.last_successful_stream_ordering as number | undefined,
        failureCount: status?.failure_count as number | undefined,
        retryInterval: status?.retry_interval as number | undefined
      })
    }

    serverList.value = servers
  } catch (err) {
    logger.error('加载联邦服务器列表失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.admin-federation-monitor {
  padding: 16px 24px;
}
</style>
