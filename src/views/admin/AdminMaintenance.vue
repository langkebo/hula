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
                class="w-[220px]" />
              <n-button type="warning" :loading="purging" @click="handlePurge">
                {{ t('admin.maintenance.purge') }}
              </n-button>
            </n-space>
          </template>
        </n-card>
      </n-gi>

      <n-gi span="2 m:1">
        <n-card :title="t('admin.maintenance.server_quota')" size="small">
          <n-descriptions v-if="serverQuota" :column="2" size="small" bordered>
            <n-descriptions-item :label="t('admin.maintenance.server_total_size')">
              {{ formatBytes(serverQuota.totalSize) }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('admin.maintenance.server_total_count')">
              {{ serverQuota.totalCount }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('admin.maintenance.server_size_limit')">
              {{ formatBytes(serverQuota.defaultSizeLimit) }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('admin.maintenance.server_count_limit')">
              {{ serverQuota.defaultCountLimit }}
            </n-descriptions-item>
          </n-descriptions>
          <n-empty v-else :description="t('admin.maintenance.no_stats')" size="small" />
        </n-card>
      </n-gi>

      <n-gi span="2">
        <n-card size="small">
          <n-tabs v-model:value="featureTab" type="line" animated>
            <n-tab-pane :name="'simple'" :tab="t('admin.maintenance.experimental_features')">
              <n-empty v-if="!featureEntries.length" :description="t('admin.maintenance.no_features')" size="small" />
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
            </n-tab-pane>
            <n-tab-pane :name="'advanced'" :tab="t('admin.maintenance.advanced_feature_flags')">
              <FeatureFlagManager />
            </n-tab-pane>
          </n-tabs>
        </n-card>
      </n-gi>
    </n-grid>
  </div>
</template>

<script setup lang="ts">
import {
  NButton,
  NCard,
  NDatePicker,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NFlex,
  NGi,
  NGrid,
  NList,
  NListItem,
  NPageHeader,
  NSpace,
  NSwitch,
  NTabPane,
  NTabs
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import FeatureFlagManager from '@/components/admin/FeatureFlagManager.vue'
import { useAdminMaintenance } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { formatBytes } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminMaintenance')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const maintenance = useAdminMaintenance()
const mediaStats = maintenance.mediaStats
const serverQuota = maintenance.serverQuota
const experimentalFeatures = maintenance.experimentalFeatures
const loading = maintenance.loading
const purging = maintenance.purging
const featureMutating = maintenance.featureMutating

const purgeBeforeTs = ref<number | null>(null)
const featureTab = ref('advanced')

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

async function loadData() {
  try {
    await maintenance.loadAll()
  } catch (err) {
    logger.error('Failed to load maintenance info:', err)
    showFeedback(t('admin.maintenance.load_failed'), 'error')
  }
}

async function handlePurge() {
  try {
    const result = await maintenance.purgeMediaCache(purgeBeforeTs.value ?? undefined)
    showFeedback(t('admin.maintenance.purge_success', { count: result.deleted }), 'success')
  } catch (err) {
    logger.error('Failed to purge media cache:', err)
    showFeedback(t('admin.maintenance.purge_failed'), 'error')
  }
}

async function handleToggleFeature(feature: string, enabled: boolean) {
  try {
    await maintenance.setExperimentalFeature(feature, enabled)
    showFeedback(t('admin.maintenance.feature_updated'), 'success')
  } catch (err) {
    logger.error('Failed to set experimental feature:', err)
    showFeedback(t('admin.maintenance.feature_failed'), 'error')
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.admin-maintenance {
  padding: 16px 24px;
}
</style>
