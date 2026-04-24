<template>
  <div class="admin-security">
    <n-page-header :title="t('admin.security.title')" :subtitle="t('admin.security.subtitle')">
      <template #extra>
        <n-space>
          <n-button @click="refresh" :loading="loading">
            <template #icon><n-icon><RefreshIcon /></n-icon></template>
            {{ t('common.refresh') }}
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-alert type="warning" title="功能尚未就绪 / Feature not available" class="my-12px">
      后端 `/security/*` 端点尚未实现，此页面为占位视图。Backend `/security/*` endpoints are not implemented; this page is a placeholder.
    </n-alert>

    <n-tabs type="line" animated>
      <n-tab-pane name="events" :tab="t('admin.security.events_tab')">
        <n-data-table
          :columns="eventColumns"
          :data="securityEvents"
          :loading="loading"
          :pagination="pagination"
          :row-key="(row: SecurityEvent) => row.id"
          striped
        />
      </n-tab-pane>

      <n-tab-pane name="ip-blocks" :tab="t('admin.security.ip_blocks_tab')">
        <n-space vertical :size="16">
          <n-space>
            <n-input v-model:value="newBlockIp" :placeholder="t('admin.security.ip_placeholder')" />
            <n-input v-model:value="newBlockReason" :placeholder="t('admin.security.reason_placeholder')" />
            <n-button type="warning" @click="blockIp" :loading="blockLoading">
              {{ t('admin.security.block_ip') }}
            </n-button>
          </n-space>
          <n-data-table
            :columns="ipBlockColumns"
            :data="ipBlocks"
            :loading="loading"
            :row-key="(row: IpBlock) => row.ip"
            striped
          />
        </n-space>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import {
  NPageHeader,
  NTabs,
  NTabPane,
  NDataTable,
  NSpace,
  NButton,
  NAlert,
  NIcon,
  NInput,
  NTag,
  useMessage,
  type DataTableColumns
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { adminService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminSecurity')
const { t } = useI18n()
const message = useMessage()

interface SecurityEvent {
  id: string
  type: string
  user_id?: string
  ip_address?: string
  timestamp: number
  details?: string
}

interface IpBlock {
  ip: string
  reason?: string
  blocked_at: number
  blocked_by?: string
}

const RefreshIcon = {
  render: () =>
    h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('polyline', { points: '23 4 23 10 17 10' }),
      h('path', { d: 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10' })
    ])
}

const loading = ref(false)
const blockLoading = ref(false)
const securityEvents = ref<SecurityEvent[]>([])
const ipBlocks = ref<IpBlock[]>([])
const newBlockIp = ref('')
const newBlockReason = ref('')

const pagination = {
  pageSize: 20
}

const eventColumns: DataTableColumns<SecurityEvent> = [
  {
    title: t('admin.security.col_type'),
    key: 'type',
    width: 150,
    render: (row) => h(NTag, { size: 'small', type: row.type.includes('fail') ? 'error' : 'info' }, () => row.type)
  },
  { title: t('admin.security.col_user'), key: 'user_id', width: 200 },
  { title: t('admin.security.col_ip'), key: 'ip_address', width: 140 },
  {
    title: t('admin.security.col_time'),
    key: 'timestamp',
    width: 180,
    render: (row) => new Date(row.timestamp).toLocaleString()
  },
  { title: t('admin.security.col_details'), key: 'details', ellipsis: { tooltip: true } }
]

const ipBlockColumns: DataTableColumns<IpBlock> = [
  { title: 'IP', key: 'ip', width: 160 },
  { title: t('admin.security.col_reason'), key: 'reason', width: 200 },
  {
    title: t('admin.security.col_blocked_at'),
    key: 'blocked_at',
    width: 180,
    render: (row) => new Date(row.blocked_at).toLocaleString()
  },
  { title: t('admin.security.col_blocked_by'), key: 'blocked_by', width: 180 },
  {
    title: t('admin.security.col_actions'),
    key: 'actions',
    width: 100,
    render: (row) =>
      h(NButton, { size: 'small', type: 'error', onClick: () => unblockIp(row.ip) }, () => t('admin.security.unblock'))
  }
]

async function loadData() {
  loading.value = true
  try {
    const [eventsResult, blocksResult] = await Promise.all([
      adminService.getSecurityEvents(),
      adminService.getIpBlocks()
    ])
    securityEvents.value = (eventsResult?.events ?? []) as unknown as SecurityEvent[]
    ipBlocks.value = (blocksResult ?? []) as unknown as IpBlock[]
  } catch (err) {
    logger.error('加载安全数据失败:', err)
  } finally {
    loading.value = false
  }
}

async function blockIp() {
  if (!newBlockIp.value.trim()) {
    message.warning(t('admin.security.ip_required'))
    return
  }
  blockLoading.value = true
  try {
    await adminService.blockIp(newBlockIp.value.trim(), { reason: newBlockReason.value.trim() })
    message.success(t('admin.security.ip_blocked'))
    newBlockIp.value = ''
    newBlockReason.value = ''
    await loadData()
  } catch (err) {
    logger.error('封禁IP失败:', err)
    message.error(t('admin.security.block_failed'))
  } finally {
    blockLoading.value = false
  }
}

async function unblockIp(ip: string) {
  try {
    await adminService.unblockIp(ip)
    message.success(t('admin.security.ip_unblocked'))
    await loadData()
  } catch (err) {
    logger.error('解封IP失败:', err)
    message.error(t('admin.security.unblock_failed'))
  }
}

function refresh() {
  loadData()
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.admin-security {
  padding: 16px 24px;
}
</style>
