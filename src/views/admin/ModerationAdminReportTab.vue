<template>
  <n-space vertical size="large">
    <n-alert type="info" :show-icon="false">{{ t('moderation.admin_reports.hint') }}</n-alert>

    <n-space>
      <n-input
        v-model:value="roomId"
        data-testid="admin-report-room-input"
        :placeholder="t('moderation.admin_reports.room_id_placeholder')"
        clearable
        class="w-[320px]" />
      <n-button data-testid="admin-report-refresh" @click="loadReports">
        <template #icon>
          <Icon icon="ion:refresh-outline" />
        </template>
        {{ t('common.refresh') }}
      </n-button>
    </n-space>

    <n-alert v-if="error" data-testid="admin-report-error" type="error">
      {{ error }}
      <n-button data-testid="admin-report-retry" text type="primary" class="ml-8px" @click="loadReports">
        {{ t('common.retry') }}
      </n-button>
    </n-alert>

    <n-data-table
      v-else
      data-testid="admin-report-table"
      :columns="columns"
      :data="reports"
      :loading="loading"
      :row-key="(row: AdminReport) => row.id" />

    <EmptyState
      v-if="isEmptyReports"
      data-testid="admin-report-empty"
      :description="t('moderation.admin_reports.empty')" />
  </n-space>

  <n-drawer v-model:show="detailVisible" placement="right" :width="460">
    <n-drawer-content :title="t('moderation.admin_reports.detail.title')" closable>
      <div v-if="detail" class="mb-12px flex gap-8px">
        <n-button
          size="small"
          data-testid="admin-report-detail-refresh"
          :loading="detailLoading"
          @click="refreshDetail">
          <template #icon>
            <Icon icon="ion:refresh-outline" />
          </template>
          {{ t('moderation.admin_reports.detail.refresh') }}
        </n-button>
        <n-button size="small" data-testid="admin-report-view-scanner" @click="loadScannerInfo">
          <template #icon>
            <Icon icon="ion:scan-outline" />
          </template>
          {{ t('moderation.admin_reports.scanner.view') }}
        </n-button>
      </div>
      <n-spin :show="detailLoading">
        <n-descriptions v-if="detail" :column="1" bordered size="small">
          <n-descriptions-item :label="t('moderation.admin_reports.table.id')">{{ detail.id }}</n-descriptions-item>
          <n-descriptions-item :label="t('moderation.admin_reports.table.room_id')">
            {{ detail.room_id }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('moderation.admin_reports.table.event_id')">
            {{ detail.event_id }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('moderation.admin_reports.table.reported_user')">
            {{ detail.reported_user_id ?? t('moderation.admin_reports.detail.none') }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('moderation.admin_reports.table.reason')">
            {{ detail.reason || t('moderation.admin_reports.detail.none') }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('moderation.admin_reports.table.status')">
            {{ detail.status }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('moderation.admin_reports.table.score')">
            {{ detail.score }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('moderation.admin_reports.table.received_at')">
            {{ new Date(detail.received_ts).toLocaleString() }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('moderation.admin_reports.detail.content')">
            {{ detail.content || t('moderation.admin_reports.detail.none') }}
          </n-descriptions-item>
        </n-descriptions>
      </n-spin>
      <ReportScannerInfo
        v-if="scannerVisible"
        :info="scannerInfo"
        :loading="scannerLoading"
        :error="scannerError"
        @retry="loadScannerInfo" />
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  type DataTableColumns,
  NAlert,
  NButton,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NInput,
  NPopconfirm,
  NSpace,
  NSpin
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ReportScannerInfo from '@/components/admin/moderation/ReportScannerInfo.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { adminService } from '@/services/matrix/admin'
import type { AdminReport, ScannerInfo } from '@/services/matrix/admin/AdminTypes'

defineOptions({
  name: 'ModerationAdminReportTab'
})

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const reports = ref<AdminReport[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const roomId = ref('')

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<AdminReport | null>(null)

const scannerVisible = ref(false)
const scannerLoading = ref(false)
const scannerError = ref<string | null>(null)
const scannerInfo = ref<ScannerInfo | null>(null)

const isEmptyReports = computed(() => !loading.value && !error.value && reports.value.length === 0)

const columns = computed<DataTableColumns<AdminReport>>(() => [
  { title: 'ID', key: 'id', width: 80 },
  { title: t('moderation.admin_reports.table.room_id'), key: 'room_id', width: 200, ellipsis: { tooltip: true } },
  { title: t('moderation.admin_reports.table.event_id'), key: 'event_id', width: 200, ellipsis: { tooltip: true } },
  {
    title: t('moderation.admin_reports.table.reported_user'),
    key: 'reported_user_id',
    width: 160,
    render: (row) => row.reported_user_id ?? '-'
  },
  { title: t('moderation.admin_reports.table.reason'), key: 'reason', render: (row) => row.reason ?? '-' },
  { title: t('moderation.admin_reports.table.status'), key: 'status', width: 100 },
  {
    title: t('moderation.admin_reports.table.received_at'),
    key: 'received_ts',
    width: 170,
    render: (row) => new Date(row.received_ts).toLocaleString()
  },
  {
    title: t('moderation.admin_reports.table.actions'),
    key: 'actions',
    width: 160,
    render: (row) =>
      h(NSpace, null, {
        default: () => [
          h(
            NButton,
            { size: 'small', 'data-testid': `admin-report-detail-${row.id}`, onClick: () => openDetail(row.id) },
            { default: () => t('moderation.admin_reports.actions.detail') }
          ),
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDismiss(row.id) },
            {
              trigger: () =>
                h(
                  NButton,
                  { size: 'small', type: 'error', 'data-testid': `admin-report-dismiss-${row.id}` },
                  { default: () => t('moderation.admin_reports.actions.dismiss') }
                ),
              default: () => t('moderation.admin_reports.dismiss_confirm', { id: row.id })
            }
          )
        ]
      })
  }
])

async function loadReports() {
  loading.value = true
  error.value = null
  try {
    const page = await adminService.reports.getAdminReports(roomId.value.trim() || undefined, 100, undefined, true)
    reports.value = page.reports
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('moderation.admin_reports.load_failed')
    reports.value = []
  } finally {
    loading.value = false
  }
}

async function openDetail(reportId: number) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  scannerVisible.value = false
  scannerInfo.value = null
  scannerError.value = null
  try {
    detail.value = await adminService.reports.getAdminReport(String(reportId), true)
  } catch {
    showFeedback(t('moderation.admin_reports.detail_failed'), 'error')
  } finally {
    detailLoading.value = false
  }
}

/**
 * 「摘要辅助读取」：SDK 管理端仅提供举报详情读取（AdminManager.getReport / getRoomReport），
 * 没有独立的举报摘要端点（已核对 matrix-js-sdk admin 的 listReports / getReport / deleteReport），
 * 因此这里重读详情，不臆造 summary 端点。
 */
async function refreshDetail() {
  if (!detail.value) return
  detailLoading.value = true
  try {
    detail.value = await adminService.reports.getAdminReport(String(detail.value.id), true)
  } catch {
    showFeedback(t('moderation.admin_reports.detail_failed'), 'error')
  } finally {
    detailLoading.value = false
  }
}

async function loadScannerInfo() {
  if (!detail.value) return
  scannerVisible.value = true
  scannerLoading.value = true
  scannerError.value = null
  try {
    scannerInfo.value = await adminService.reports.getScannerInfo(detail.value.room_id, detail.value.event_id, true)
  } catch (err) {
    scannerInfo.value = null
    scannerError.value = err instanceof Error ? err.message : t('moderation.admin_reports.scanner.load_failed')
  } finally {
    scannerLoading.value = false
  }
}

async function handleDismiss(reportId: number) {
  try {
    const ok = await adminService.reports.dismissReport(String(reportId), true)
    if (ok) {
      showFeedback(t('moderation.admin_reports.dismiss_success'), 'success')
      await loadReports()
      return
    }
  } catch {
    // 失败统一走下方提示，避免重复 toast
  }
  showFeedback(t('moderation.admin_reports.dismiss_failed'), 'error')
}

onMounted(() => {
  loadReports()
})
</script>
