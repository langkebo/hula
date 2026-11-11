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

          <!-- 明细：哪些数据占了多少。此前只有总量，用户无法判断「能不能清」 -->
          <van-cell-group :title="t('mobile_storage.detail_section')" inset>
            <van-cell
              :title="t('mobile_storage.search_index')"
              :value="searchIndexText"
              :label="t('mobile_storage.search_index_desc')"
              data-testid="search-index-cell" />
            <van-cell
              :title="t('mobile_storage.local_storage')"
              :value="formatBytes(local.totalBytes)"
              :label="t('mobile_storage.local_storage_keys', { count: local.keyCount })"
              data-testid="local-storage-cell" />
            <van-cell
              :title="t('mobile_storage.other_data')"
              :label="t('mobile_storage.other_data_desc')"
              data-testid="other-data-cell" />
          </van-cell-group>

          <!-- 清理：只做真实可清的一项。旧的「清理缓存」是 no-op 却弹成功，已移除 -->
          <van-cell-group :title="t('mobile_storage.clear_section')" inset>
            <van-cell data-testid="clear-search-index-cell">
              <template #title>
                <div class="flex flex-col gap-4px">
                  <span>{{ t('mobile_storage.clear_action') }}</span>
                  <span class="text-12px text-[--tjg-text-tertiary]">
                    {{ hasClearableIndex ? t('mobile_storage.clear_hint') : t('mobile_storage.nothing_to_clear') }}
                  </span>
                </div>
              </template>
              <template #right-icon>
                <van-button
                  size="small"
                  type="danger"
                  plain
                  :loading="clearing"
                  :disabled="!hasClearableIndex"
                  data-testid="clear-search-index-button"
                  @click="handleClear">
                  {{ t('mobile_storage.clear_action') }}
                </van-button>
              </template>
            </van-cell>
          </van-cell-group>
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
import { formatBytes } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'
import { measureLocalStorageUsage } from '@/utils/localStorageUsage'
import { clearAllSearchData, countSearchIndexRecords } from '@/workers/searchIndexDb'

const logger = createLogger('MobileStorageSettings')

const { t } = useI18n()

const loading = ref(false)
const clearing = ref(false)
const usage = ref(0)
const quota = ref(0)
const local = ref(measureLocalStorageUsage())
const searchRooms = ref(0)
const searchEvents = ref(0)
/** IndexedDB / worker 都拿不到统计时为 false（此时不谎报 0 条） */
const searchStatsAvailable = ref(true)

const usageText = computed(() => formatBytes(usage.value))
const quotaText = computed(() => formatBytes(quota.value))

/** 用量占比，封顶 100（配额未知时为 0） */
const usagePercent = computed(() => {
  if (!quota.value) return 0
  return Math.min(100, Math.round((usage.value / quota.value) * 100))
})

const searchIndexText = computed(() =>
  searchStatsAvailable.value
    ? t('mobile_storage.search_index_records', { events: searchEvents.value, rooms: searchRooms.value })
    : t('mobile_storage.unavailable')
)

const hasClearableIndex = computed(() => searchStatsAvailable.value && searchEvents.value + searchRooms.value > 0)

/** worker 内存统计带 1.5s 上限：worker 卡死时不能把设置页拖到 15s（Host 默认超时） */
async function loadSearchIndexStats(): Promise<void> {
  try {
    // 只看**磁盘**：这一页讲的是「本机占用」，worker 的内存索引不算占用；
    // 且磁盘统计不依赖 worker 存活，任何时候都能给出真数字。
    const onDisk = await countSearchIndexRecords()
    searchRooms.value = onDisk.rooms
    searchEvents.value = onDisk.events
  } catch (error) {
    logger.error('Failed to read search index stats', error)
    searchStatsAvailable.value = false
  }
}

async function loadStats(): Promise<void> {
  // ⚠️ 这里曾展示「缓存命中率 / 内存占用 / 缓存条目」并调用矩阵 worker 的 getStats()。
  // Batch 3.2 取证确认该消息在 worker 侧恒返回 null（worker 从不持有 client）⇒ 三项永远为
  // 0 / `-`；同时「清理缓存」按钮调用的 clearStores() 是 no-op 却会弹「清理成功」。
  // 两者已一并移除，不再用假数据与假成功欺骗用户。
  // 浏览器存储用量与本地明细是真实数据，保留。
  loading.value = true
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      usage.value = estimate.usage ?? 0
      quota.value = estimate.quota ?? 0
    }
    local.value = measureLocalStorageUsage()
    await loadSearchIndexStats()
  } catch (error) {
    logger.error('Failed to load storage stats', error)
  } finally {
    loading.value = false
  }
}

/**
 * 清空搜索索引。
 *
 * 两条路径都**真的删数据**：worker 存活时让它清内存索引 + 落盘库（否则内存里还有命中的文档，
 * 会出现「清完了还能搜到」）；worker 未启动时直接清 IndexedDB（此时没有内存索引可清）。
 * 任一步失败都弹失败提示，绝不静默当成功。
 */
async function clearSearchIndex(): Promise<void> {
  if (matrixWorkerHost.isStarted) {
    try {
      await matrixWorkerHost.resetSearchIndex()
      return
    } catch (error) {
      logger.warn('worker clear failed, falling back to clearing IndexedDB directly', error)
    }
  }
  await clearAllSearchData()
}

async function handleClear(): Promise<void> {
  if (!hasClearableIndex.value || clearing.value) return

  try {
    await showConfirmDialog({
      title: t('mobile_storage.clear_confirm_title'),
      message: t('mobile_storage.clear_confirm_message', {
        events: searchEvents.value,
        rooms: searchRooms.value
      }),
      confirmButtonText: t('mobile_storage.clear_action'),
      cancelButtonText: t('common.cancel')
    })
  } catch {
    return // 用户取消
  }

  clearing.value = true
  try {
    await clearSearchIndex()
    searchRooms.value = 0
    searchEvents.value = 0
    await loadStats()
    showToast({ type: 'success', message: t('mobile_storage.clear_success') })
  } catch (error) {
    logger.error('Failed to clear search index', error)
    showToast({ type: 'fail', message: t('mobile_storage.clear_failed') })
  } finally {
    clearing.value = false
  }
}

onMounted(loadStats)
</script>
