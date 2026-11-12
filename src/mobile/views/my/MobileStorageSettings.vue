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
              :title="t('mobile_storage.thumbnail_cache')"
              :value="mediaCacheTextFor('thumbnails')"
              :label="t('mobile_storage.thumbnail_cache_desc')"
              data-testid="thumbnail-cache-cell" />
            <van-cell
              :title="t('mobile_storage.emoji_cache')"
              :value="mediaCacheTextFor('emojis')"
              :label="t('mobile_storage.emoji_cache_desc')"
              data-testid="emoji-cache-cell" />
            <van-cell
              :title="t('mobile_storage.other_data')"
              :label="t('mobile_storage.other_data_desc')"
              data-testid="other-data-cell" />
          </van-cell-group>

          <!-- 缓存策略：开关真实生效，关闭后缩略图不再写入本地磁盘 -->
          <van-cell-group :title="t('mobile_storage.strategy_section')" inset>
            <van-cell
              :title="t('mobile_storage.auto_cache')"
              :label="t('mobile_storage.auto_cache_desc')"
              data-testid="auto-cache-cell">
              <template #right-icon>
                <van-switch
                  size="20px"
                  :model-value="thumbnailStore.autoCacheEnabled"
                  :aria-label="t('mobile_storage.auto_cache')"
                  data-testid="auto-cache-switch"
                  @update:model-value="handleToggleAutoCache" />
              </template>
            </van-cell>
          </van-cell-group>

          <!-- 清理：每一项都真实删除，失败会明确提示 -->
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
            <van-cell data-testid="clear-thumbnail-cell">
              <template #title>
                <div class="flex flex-col gap-4px">
                  <span>{{ t('mobile_storage.clear_thumbnail_action') }}</span>
                  <span class="text-12px text-[--tjg-text-tertiary]">
                    {{
                      hasClearableMedia('thumbnails')
                        ? t('mobile_storage.clear_cache_hint', { files: mediaStats.thumbnails.files })
                        : t('mobile_storage.media_cache_empty')
                    }}
                  </span>
                </div>
              </template>
              <template #right-icon>
                <van-button
                  size="small"
                  type="danger"
                  plain
                  :loading="clearingMedia === 'thumbnails'"
                  :disabled="!hasClearableMedia('thumbnails')"
                  data-testid="clear-thumbnail-button"
                  @click="handleClearMedia('thumbnails')">
                  {{ t('mobile_storage.clear_thumbnail_action') }}
                </van-button>
              </template>
            </van-cell>
            <van-cell data-testid="clear-emoji-cell">
              <template #title>
                <div class="flex flex-col gap-4px">
                  <span>{{ t('mobile_storage.clear_emoji_action') }}</span>
                  <span class="text-12px text-[--tjg-text-tertiary]">
                    {{
                      hasClearableMedia('emojis')
                        ? t('mobile_storage.clear_cache_hint', { files: mediaStats.emojis.files })
                        : t('mobile_storage.media_cache_empty')
                    }}
                  </span>
                </div>
              </template>
              <template #right-icon>
                <van-button
                  size="small"
                  type="danger"
                  plain
                  :loading="clearingMedia === 'emojis'"
                  :disabled="!hasClearableMedia('emojis')"
                  data-testid="clear-emoji-button"
                  @click="handleClearMedia('emojis')">
                  {{ t('mobile_storage.clear_emoji_action') }}
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
import { useThumbnailCacheStore } from '@/stores/domains/widget/thumbnailCache'
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

const thumbnailStore = useThumbnailCacheStore()
type MediaCacheKind = 'thumbnails' | 'emojis'
type MediaCacheUsage = { bytes: number; files: number }
/** 按类别分开统计，用户才能判断该清哪一类 */
const mediaStats = ref<Record<MediaCacheKind, MediaCacheUsage>>({
  thumbnails: { bytes: 0, files: 0 },
  emojis: { bytes: 0, files: 0 }
})
const mediaCacheLoading = ref(false)
/** 读不到媒体缓存目录（如浏览器环境）时为 false，避免谎报「无缓存」 */
const mediaCacheAvailable = ref(true)
/** 正在清理的类别；null 表示空闲 */
const clearingMedia = ref<MediaCacheKind | null>(null)

const hasClearableMedia = (kind: MediaCacheKind): boolean =>
  mediaCacheAvailable.value && mediaStats.value[kind].files > 0

function mediaCacheTextFor(kind: MediaCacheKind): string {
  if (mediaCacheLoading.value) return t('mobile_storage.loading')
  if (!mediaCacheAvailable.value) return t('mobile_storage.unavailable')
  const stat = mediaStats.value[kind]
  if (stat.files === 0) return t('mobile_storage.media_cache_empty')
  return t('mobile_storage.media_cache_size', {
    size: formatBytes(stat.bytes),
    files: stat.files
  })
}

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

/** 分类统计磁盘上的缩略图 / 表情缓存；读不到目录时标记为不可用而不是回 0 */
async function loadMediaCacheStats(): Promise<void> {
  mediaCacheLoading.value = true
  try {
    const [thumbnails, emojis] = await Promise.all([
      thumbnailStore.getMediaCacheStats('thumbnails'),
      thumbnailStore.getMediaCacheStats('emojis')
    ])
    mediaStats.value = { thumbnails, emojis }
    mediaCacheAvailable.value = true
  } catch (error) {
    logger.warn('Failed to read media cache stats', error)
    mediaCacheAvailable.value = false
  } finally {
    mediaCacheLoading.value = false
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
    await loadMediaCacheStats()
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

function handleToggleAutoCache(value: string | number | boolean): void {
  thumbnailStore.setAutoCacheEnabled(Boolean(value))
}

/** 真实删除某一类缓存文件（缩略图 / 表情）；删除失败弹失败提示 */
async function handleClearMedia(kind: MediaCacheKind): Promise<void> {
  if (!hasClearableMedia(kind) || clearingMedia.value) return

  const label =
    kind === 'thumbnails' ? t('mobile_storage.cache_label_thumbnail') : t('mobile_storage.cache_label_emoji')
  try {
    await showConfirmDialog({
      title: t('mobile_storage.clear_cache_confirm_title', { kind: label }),
      message: t('mobile_storage.clear_cache_confirm_message', {
        kind: label,
        files: mediaStats.value[kind].files
      }),
      confirmButtonText:
        kind === 'thumbnails' ? t('mobile_storage.clear_thumbnail_action') : t('mobile_storage.clear_emoji_action'),
      cancelButtonText: t('common.cancel')
    })
  } catch {
    return // 用户取消
  }

  clearingMedia.value = kind
  try {
    await thumbnailStore.clearMediaCache(kind)
    await loadMediaCacheStats()
    showToast({ type: 'success', message: t('mobile_storage.clear_cache_success', { kind: label }) })
  } catch (error) {
    logger.error('Failed to clear media cache', { kind }, error)
    showToast({ type: 'fail', message: t('mobile_storage.clear_cache_failed') })
  } finally {
    clearingMedia.value = null
  }
}

onMounted(loadStats)
</script>
