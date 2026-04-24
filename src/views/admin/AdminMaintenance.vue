<template>
  <div class="admin-maintenance">
    <n-page-header :title="t('admin.maintenance.title')" :subtitle="t('admin.maintenance.subtitle')">
      <template #extra>
        <n-button @click="loadData" :loading="loading">{{ t('common.refresh') }}</n-button>
      </template>
    </n-page-header>

    <n-grid :cols="2" :x-gap="16" :y-gap="16" responsive="screen" item-responsive class="mt-16px">
      <n-gi span="2 m:1">
        <n-card :title="t('admin.maintenance.media_cache')" size="small">
          <n-descriptions v-if="mediaStats" :column="2" size="small" bordered>
            <n-descriptions-item v-for="(value, key) in mediaStats" :key="key" :label="String(key)">
              {{ String(value) }}
            </n-descriptions-item>
          </n-descriptions>
          <n-empty v-else :description="t('admin.maintenance.no_stats')" size="small" />
          <template #action>
            <n-space align="center" :size="8">
              <n-date-picker
                v-model:value="purgeBeforeTs"
                type="datetime"
                clearable
                :placeholder="t('admin.maintenance.purge_before')"
                style="width: 220px" />
              <n-button type="warning" :loading="purging" @click="handlePurge">
                {{ t('admin.maintenance.purge') }}
              </n-button>
            </n-space>
          </template>
        </n-card>
      </n-gi>

      <n-gi span="2 m:1">
        <n-card :title="t('admin.maintenance.backups')" size="small">
          <n-data-table
            :columns="backupColumns"
            :data="backups"
            :pagination="{ pageSize: 10 }"
            :bordered="false"
            size="small" />
        </n-card>
      </n-gi>

      <n-gi span="2">
        <n-card :title="t('admin.maintenance.experimental_features')" size="small">
          <n-empty
            v-if="!featureEntries.length"
            :description="t('admin.maintenance.no_features')"
            size="small" />
          <n-list v-else bordered>
            <n-list-item v-for="entry in featureEntries" :key="entry.key">
              <n-flex align="center" justify="space-between">
                <div>
                  <div class="text-14px font-semibold">{{ entry.key }}</div>
                  <div class="text-12px op-60">{{ entry.description }}</div>
                </div>
                <n-switch
                  :value="entry.enabled"
                  :loading="featureMutating"
                  @update:value="(v: boolean) => handleToggleFeature(entry.key, v)" />
              </n-flex>
            </n-list-item>
          </n-list>
        </n-card>
      </n-gi>
    </n-grid>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import {
  NPageHeader,
  NButton,
  NCard,
  NGrid,
  NGi,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NList,
  NListItem,
  NFlex,
  NSpace,
  NSwitch,
  NDatePicker,
  NTag,
  useMessage,
  type DataTableColumns
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAdminMaintenance } from '@/composables/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminMaintenance')
const { t } = useI18n()
const message = useMessage()

const maintenance = useAdminMaintenance()
const backups = maintenance.backups
const mediaStats = maintenance.mediaStats
const experimentalFeatures = maintenance.experimentalFeatures
const loading = maintenance.loading
const purging = maintenance.purging
const featureMutating = maintenance.featureMutating

const purgeBeforeTs = ref<number | null>(null)

interface FeatureEntry {
  key: string
  enabled: boolean
  description: string
}

const featureEntries = computed<FeatureEntry[]>(() =>
  Object.entries(experimentalFeatures.value).map(([key, value]) => {
    if (typeof value === 'boolean') {
      return { key, enabled: value, description: '' }
    }
    if (value && typeof value === 'object') {
      const v = value as Record<string, unknown>
      return {
        key,
        enabled: Boolean(v.enabled ?? v.status === 'enabled'),
        description: String(v.description ?? '')
      }
    }
    return { key, enabled: false, description: String(value ?? '') }
  })
)

const backupColumns: DataTableColumns<Record<string, unknown>> = [
  { title: t('admin.maintenance.backup_id'), key: 'id', ellipsis: { tooltip: true } },
  { title: t('admin.maintenance.backup_size'), key: 'size', width: 120 },
  {
    title: t('admin.maintenance.backup_created'),
    key: 'created_at',
    width: 180,
    render: (row) => {
      const ts = row.created_at as number | string | undefined
      if (!ts) return '-'
      const n = typeof ts === 'number' ? ts : Date.parse(String(ts))
      return Number.isFinite(n) ? new Date(n).toLocaleString() : String(ts)
    }
  },
  {
    title: t('admin.maintenance.backup_status'),
    key: 'status',
    width: 120,
    render: (row) => {
      const status = String(row.status ?? 'unknown')
      const type = status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'default'
      return h(NTag, { size: 'small', type }, () => status)
    }
  }
]

async function loadData() {
  try {
    await maintenance.loadAll()
  } catch (err) {
    logger.error('加载维护信息失败:', err)
    message.error(t('admin.maintenance.load_failed'))
  }
}

async function handlePurge() {
  try {
    const result = await maintenance.purgeMediaCache(purgeBeforeTs.value ?? undefined)
    message.success(t('admin.maintenance.purge_success', { count: result.deleted }))
  } catch (err) {
    logger.error('清理媒体缓存失败:', err)
    message.error(t('admin.maintenance.purge_failed'))
  }
}

async function handleToggleFeature(feature: string, enabled: boolean) {
  try {
    await maintenance.setExperimentalFeature(feature, enabled)
    message.success(t('admin.maintenance.feature_updated'))
  } catch (err) {
    logger.error('设置实验特性失败:', err)
    message.error(t('admin.maintenance.feature_failed'))
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.admin-maintenance {
  padding: 16px 24px;
}
</style>
