<template>
  <mobile-layout :title="t('admin.maintenance')" show-back>
    <div class="mobile-admin-maintenance">
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-cell-group :title="t('admin.media_stats')">
          <van-cell
            v-for="(value, key) in admin.mediaStats.value ?? {}"
            :key="key"
            :title="String(key)"
            :value="String(value)" />
          <div class="purge-btn">
            <van-button type="warning" block :loading="admin.purging.value" @click="handlePurge">
              {{ t('admin.purge_media_cache') }}
            </van-button>
          </div>
        </van-cell-group>

        <van-cell-group :title="t('admin.experimental_features')">
          <van-cell v-for="(enabled, key) in admin.experimentalFeatures.value" :key="key" :title="String(key)">
            <template #value>
              <van-switch
                :model-value="Boolean(enabled)"
                :loading="admin.featureMutating.value"
                @update:model-value="(v: boolean) => handleToggleFeature(String(key), v)" />
            </template>
          </van-cell>
        </van-cell-group>

        <van-cell-group :title="t('admin.backups')">
          <van-cell
            v-for="(backup, idx) in admin.backups.value"
            :key="idx"
            :title="String(backup.version ?? `#${idx + 1}`)"
            :label="String(backup.algorithm ?? '-')" />
        </van-cell-group>
      </van-pull-refresh>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { showConfirmDialog, showToast } from 'vant'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminMaintenance } from '@/composables/admin'
import MobileLayout from '@/mobile/layout/index.vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileAdminMaintenance')
const { t } = useI18n()

const admin = useAdminMaintenance()
const refreshing = ref(false)

const onRefresh = async () => {
  refreshing.value = true
  try {
    await admin.loadAll()
  } catch (error) {
    logger.error('[MobileAdminMaintenance] 加载失败:', error)
    showToast(t('admin.load_failed'))
  } finally {
    refreshing.value = false
  }
}

const handlePurge = async () => {
  try {
    await showConfirmDialog({ title: t('admin.confirm'), message: t('admin.purge_media_cache_confirm') })
    const result = await admin.purgeMediaCache()
    showToast(t('admin.purge_success', { n: result.deleted }))
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('[MobileAdminMaintenance] 清理失败:', error)
      showToast(t('admin.load_failed'))
    }
  }
}

const handleToggleFeature = async (feature: string, enabled: boolean) => {
  try {
    await admin.setExperimentalFeature(feature, enabled)
    showToast(t('admin.operation_success'))
  } catch (error) {
    logger.error('[MobileAdminMaintenance] 切换失败:', error)
    showToast(t('admin.load_failed'))
  }
}

onRefresh()
</script>

<style scoped lang="scss">
.mobile-admin-maintenance {
  .purge-btn {
    padding: 12px 16px;
  }
}
</style>
