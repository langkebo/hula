<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :is-official="false" :hidden-right="true" :room-name="t('mobile_storage.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full p-16px gap-12px">
        <div v-if="loading" class="flex justify-center items-center py-40px">
          <van-loading size="24px">{{ t('mobile_storage.loading') }}</van-loading>
        </div>

        <template v-else>
          <!-- 缓存统计 -->
          <van-cell-group :title="t('mobile_storage.cache_section')" inset>
            <van-cell :title="t('mobile_storage.hit_rate')" :value="hitRateText" />
            <van-cell :title="t('mobile_storage.memory_usage')" :value="formatBytes(stats?.memoryUsageBytes)" />
            <van-cell :title="t('mobile_storage.cached_items')" :value="String(stats?.totalEntries ?? 0)" />
          </van-cell-group>

          <!-- 浏览器存储用量 -->
          <van-cell-group :title="t('mobile_storage.usage_section')" inset>
            <van-cell :title="t('mobile_storage.used')" :value="usageText" />
            <van-cell :title="t('mobile_storage.quota')" :value="quotaText" />
          </van-cell-group>

          <div v-if="quota > 0" class="px-4px">
            <van-progress
              :percentage="usagePercent"
              :aria-label="t('mobile_storage.used')"
              :pivot-text="`${usagePercent}%`" />
          </div>

          <!-- 清理：破坏性操作独立分区 + 二次确认 -->
          <div class="mt-16px flex flex-col gap-8px px-4px">
            <div class="text-14px text-[--tjg-text-secondary]">{{ t('mobile_storage.danger_section') }}</div>
            <div class="text-12px text-[--tjg-text-tertiary]">{{ t('mobile_storage.clear_desc') }}</div>
            <van-button type="danger" block plain :loading="clearing" @click="handleClear">
              {{ t('mobile_storage.clear') }}
            </van-button>
          </div>
        </template>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showConfirmDialog, showToast } from 'vant'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import type { StoreStats } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileStorageSettings')

const { t } = useI18n()

const loading = ref(false)
const clearing = ref(false)
const stats = ref<StoreStats | null>(null)
const usage = ref(0)
const quota = ref(0)

const hitRateText = computed(() => {
  if (!stats.value) return '-'
  return `${(stats.value.hitRate * 100).toFixed(1)}%`
})

const usageText = computed(() => formatBytes(usage.value))
const quotaText = computed(() => formatBytes(quota.value))

/** 用量占比，封顶 100（配额未知时为 0） */
const usagePercent = computed(() => {
  if (!quota.value) return 0
  return Math.min(100, Math.round((usage.value / quota.value) * 100))
})

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function loadStats(): Promise<void> {
  loading.value = true
  try {
    stats.value = await matrixWorkerHost.getStats()
    // 浏览器存储用量：非所有环境都提供，缺失时降级为 0 而不是抛错
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      usage.value = estimate.usage ?? 0
      quota.value = estimate.quota ?? 0
    }
  } catch (error) {
    logger.error('Failed to load storage stats', error)
    showToast({ type: 'fail', message: t('mobile_storage.load_failed') })
  } finally {
    loading.value = false
  }
}

async function handleClear(): Promise<void> {
  try {
    await showConfirmDialog({
      title: t('mobile_storage.clear'),
      message: t('mobile_storage.clear_confirm'),
      confirmButtonText: t('mobile_storage.clear'),
      cancelButtonText: t('common.cancel')
    })
  } catch {
    return
  }

  clearing.value = true
  try {
    await matrixWorkerHost.clearStores()
    showToast(t('mobile_storage.clear_success'))
    await loadStats()
  } catch (error) {
    logger.error('Failed to clear stores', error)
    showToast({ type: 'fail', message: t('mobile_storage.clear_failed') })
  } finally {
    clearing.value = false
  }
}

onMounted(loadStats)
</script>
