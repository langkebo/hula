<template>
  <div class="moderation-panel p-4">
    <n-card :title="t('moderation.title')">
      <n-tabs v-model:value="activeTab" type="line">
        <n-tab-pane name="reports" :tab="t('moderation.reports')">
          <n-space vertical size="large">
            <n-space>
              <n-select
                v-model:value="statusFilter"
                :options="statusOptions"
                :placeholder="t('moderation.filterByStatus')"
                style="width: 150px"
                @update:value="handleFilterChange" />
              <n-button @click="fetchReports">
                <template #icon>
                  <Icon icon="ion:refresh-outline" />
                </template>
                {{ t('common.refresh') }}
              </n-button>
            </n-space>

            <n-data-table
              :columns="reportColumns"
              :data="openReports"
              :loading="loading"
              :row-key="(row: Report) => row.id" />
          </n-space>
        </n-tab-pane>

        <n-tab-pane name="filters" :tab="t('moderation.filters')">
          <n-space vertical size="large">
            <n-button type="primary" @click="showAddFilterModal = true">
              {{ t('moderation.addFilter') }}
            </n-button>
            <n-list bordered>
              <n-list-item v-for="filter in enabledFilters" :key="filter.id">
                <n-thing :title="filter.pattern" :description="filter.type">
                  <template #header-extra>
                    <n-space>
                      <n-tag :type="filter.action === 'block' ? 'error' : 'warning'">
                        {{ filter.action }}
                      </n-tag>
                      <n-button text type="error" @click="handleRemoveFilter(filter.id)">
                        <template #icon>
                          <Icon icon="ion:trash-outline" />
                        </template>
                      </n-button>
                    </n-space>
                  </template>
                </n-thing>
              </n-list-item>
            </n-list>
          </n-space>
        </n-tab-pane>
      </n-tabs>
    </n-card>

    <n-modal v-model:show="showAddFilterModal" preset="dialog" :title="t('moderation.addFilter')">
      <n-form ref="formRef" :model="filterForm" label-placement="left">
        <n-form-item :label="t('moderation.filterType')" path="type">
          <n-select v-model:value="filterForm.type" :options="filterTypeOptions" />
        </n-form-item>
        <n-form-item :label="t('moderation.filterPattern')" path="pattern">
          <n-input v-model:value="filterForm.pattern" :placeholder="t('moderation.filterPatternPlaceholder')" />
        </n-form-item>
        <n-form-item :label="t('moderation.filterAction')" path="action">
          <n-select v-model:value="filterForm.action" :options="filterActionOptions" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showAddFilterModal = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" @click="handleAddFilter">{{ t('common.add') }}</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h, onMounted, computed } from 'vue'
import {
  NCard,
  NTabs,
  NTabPane,
  NSpace,
  NSelect,
  NButton,
  NDataTable,
  NList,
  NListItem,
  NThing,
  NTag,
  NModal,
  NForm,
  NFormItem,
  NInput,
  useMessage,
  type DataTableColumns
} from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useModerationStore } from '@/stores/moderation'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { Report } from '@/services/matrix/MatrixModerationService'

defineOptions({
  name: 'ModerationPanel'
})

const { t } = useI18n()
const message = useMessage()
const moderationStore = useModerationStore()
const { openReports, enabledFilters, loading } = storeToRefs(moderationStore)

const activeTab = ref('reports')
const statusFilter = ref<string | null>('open')
const showAddFilterModal = ref(false)
const filterForm = ref({
  type: 'keyword' as 'keyword' | 'regex' | 'image_hash',
  pattern: '',
  action: 'flag' as 'flag' | 'block' | 'quarantine'
})

const statusOptions = computed(() => [
  { label: t('moderation.status.open'), value: 'open' },
  { label: t('moderation.status.resolved'), value: 'resolved' },
  { label: t('moderation.status.dismissed'), value: 'dismissed' }
])

const filterTypeOptions = computed(() => [
  { label: t('moderation.filterTypeOptions.keyword'), value: 'keyword' },
  { label: t('moderation.filterTypeOptions.regex'), value: 'regex' },
  { label: t('moderation.filterTypeOptions.imageHash'), value: 'image_hash' }
])

const filterActionOptions = computed(() => [
  { label: t('moderation.filterActionOptions.flag'), value: 'flag' },
  { label: t('moderation.filterActionOptions.block'), value: 'block' },
  { label: t('moderation.filterActionOptions.quarantine'), value: 'quarantine' }
])

const reportColumns: DataTableColumns<Report> = [
  { title: 'ID', key: 'id', width: 100 },
  { title: t('moderation.table.reporter'), key: 'reporterUserId', width: 150 },
  { title: t('moderation.table.reportedUser'), key: 'reportedUserId', width: 150 },
  { title: t('moderation.table.reason'), key: 'reason', ellipsis: { tooltip: true } },
  {
    title: t('moderation.table.createdAt'),
    key: 'createdAt',
    width: 150,
    render: (row) => new Date(row.createdAt).toLocaleString()
  },
  {
    title: t('moderation.table.actions'),
    key: 'actions',
    width: 200,
    render: (row) =>
      h(NSpace, null, {
        default: () => [
          h(
            NButton,
            { size: 'small', type: 'warning', onClick: () => handleResolveReport(row.id, 'warn') },
            { default: () => t('moderation.actions.warn') }
          ),
          h(
            NButton,
            { size: 'small', type: 'error', onClick: () => handleResolveReport(row.id, 'ban') },
            { default: () => t('moderation.actions.ban') }
          ),
          h(
            NButton,
            { size: 'small', onClick: () => handleResolveReport(row.id, 'dismiss') },
            { default: () => t('moderation.actions.dismiss') }
          )
        ]
      })
  }
]

async function fetchReports() {
  await moderationStore.fetchReports({
    status: statusFilter.value as 'open' | 'resolved' | 'dismissed' | undefined
  })
}

function handleFilterChange() {
  fetchReports()
}

async function handleResolveReport(reportId: string, action: 'dismiss' | 'warn' | 'mute' | 'ban') {
  const success = await moderationStore.resolveReport(reportId, action)
  if (success) {
    message.success(t('moderation.toast.reportResolved', { action }))
    fetchReports()
  }
}

async function handleAddFilter() {
  if (!filterForm.value.pattern) {
    message.error(t('moderation.toast.patternRequired'))
    return
  }
  const result = await moderationStore.addContentFilter(filterForm.value)
  if (result) {
    showAddFilterModal.value = false
    filterForm.value = { type: 'keyword', pattern: '', action: 'flag' }
    message.success(t('moderation.toast.filterAdded'))
  }
}

async function handleRemoveFilter(filterId: string) {
  const success = await moderationStore.removeContentFilter(filterId)
  if (success) {
    message.success(t('moderation.toast.filterRemoved'))
  }
}

onMounted(() => {
  fetchReports()
  moderationStore.fetchContentFilters()
})
</script>

<style scoped>
.moderation-panel {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
