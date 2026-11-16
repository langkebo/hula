<template>
  <div v-show="active" class="flex-1 min-h-0 flex flex-col">
    <!-- 配额统计：数据来自 media 配额接口；取不到就整块隐藏，绝不显示假数字 -->
    <template v-if="quota">
      <n-flex
        align="center"
        justify="space-between"
        class="px-12px py-8px shrink-0 border-b border-[--tjg-border-default]">
        <span class="text-[var(--text-xs)] font-medium color-[--tjg-text-tertiary]">
          {{ t('home.chat_sidebar.quota.title') }}
        </span>
        <span class="text-[var(--text-xs)] color-[--tjg-color-primary-500]" data-test="chat-sidebar-quota-text">
          {{ quotaText }}
        </span>
      </n-flex>
      <!-- 配额进度条 -->
      <div class="px-12px py-8px shrink-0 border-b border-[--tjg-border-default]">
        <n-progress
          type="line"
          :percentage="quotaPercent"
          :height="4"
          :show-indicator="false"
          color="var(--tjg-color-primary-500)" />
      </div>
    </template>
    <!-- 服务端有配额接口但这次没取到：如实说「暂不可用」，不把失败画成用量 0 -->
    <n-flex
      v-else-if="loaded && quotaUnavailable"
      align="center"
      justify="space-between"
      class="px-12px py-8px shrink-0 border-b border-[--tjg-border-default]">
      <span class="text-[var(--text-xs)] font-medium color-[--tjg-text-tertiary]">
        {{ t('home.chat_sidebar.quota.title') }}
      </span>
      <span class="text-[var(--text-xs)] color-[--tjg-text-secondary]" data-test="chat-sidebar-quota-unavailable">
        {{ t('home.chat_sidebar.quota.unavailable') }}
      </span>
    </n-flex>

    <div class="flex-1 flex items-center justify-center">
      <!-- 文件列表尚未接入数据源：只给空态，不伪造条目 -->
      <n-empty v-if="loaded" :description="t('home.chat_sidebar.empty.files')" data-test="chat-sidebar-files-empty">
        <template #icon>
          <svg class="size-48px opacity-50 color-[--tjg-text-quaternary]" aria-hidden="true">
            <use href="#folder"></use>
          </svg>
        </template>
      </n-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import type { MediaQuotaStats } from '@/services/matrix/media/mediaConfigOps'
import { onMediaQuotaChanged } from '@/services/matrix/media/mediaQuotaEvents'
import { formatBytes } from '@/utils/Formatting'

const props = defineProps<{ active: boolean }>()

const { t } = useI18n()

const quota = ref<MediaQuotaStats | null>(null)
/** 接口存在但本次取不到（鉴权 / 网络 / 5xx）：显示「暂不可用」；服务端无此接口时为 false（整块隐藏） */
const quotaUnavailable = ref(false)
const loading = ref(false)
/** 首次探测结束（成功或失败）—— 避免「还没请求」时就把空态当成结果 */
const loaded = ref(false)
/** 上次取数时刻：配额变化不频繁，60s 内重复切面板不再打接口；取数失败则不缓存，下次可见即可重试 */
const QUOTA_TTL_MS = 60_000
let lastFetchedAt = 0
/** 取数期间又收到「配额已变化」通知：等本次结束后补一次，避免上传后仍显示旧值 */
let reloadQueued = false

/**
 * 取数结果分三态：
 * - 成功 → 展示真实用量；
 * - `unsupported`（服务端没有配额接口）→ 整块隐藏，因为「配额」这个概念不存在；
 * - `unavailable`（接口在但本次失败）→ 显示「暂不可用」，绝不显示 0 或占位数字。
 */
const loadQuota = async (): Promise<void> => {
  if (loading.value) {
    reloadQueued = true
    return
  }
  loading.value = true
  // `getQuotaStats()` 内部已吞错并返回 `{ ok, reason }`，这里不需要 try/catch。
  const result = await matrixMediaService.getQuotaStats()
  if (result.ok) {
    quota.value = result.stats
    quotaUnavailable.value = false
    lastFetchedAt = Date.now()
  } else {
    quota.value = null
    quotaUnavailable.value = result.reason === 'unavailable'
    // 本次失败不写缓存：下次面板可见时立刻重试
    lastFetchedAt = result.reason === 'unsupported' ? Date.now() : 0
  }
  loading.value = false
  loaded.value = true
  if (reloadQueued) {
    reloadQueued = false
    void loadQuota()
  }
}

const quotaText = computed(() => {
  const stats = quota.value
  if (!stats) return ''
  const used = formatBytes(stats.storageBytes)
  // 服务端没给上限（limitBytes=0）时只报用量，不编造分母
  return stats.limitBytes > 0 ? `${used} / ${formatBytes(stats.limitBytes)}` : used
})

const quotaPercent = computed(() => {
  const stats = quota.value
  if (!stats || stats.limitBytes <= 0) return 0
  return Math.min(100, Math.round((stats.storageBytes / stats.limitBytes) * 100))
})

// 只在面板首次可见时拉一次，避免隐藏状态下白打接口
watch(
  () => props.active,
  (active) => {
    if (!active) return
    const stale = Date.now() - lastFetchedAt > QUOTA_TTL_MS
    if (!loaded.value || stale) void loadQuota()
  },
  { immediate: true }
)

// 上传 / 删除成功会让服务端配额变化：可见时立即重取；隐藏时清掉缓存，下次可见即重取。
let unsubscribeQuota = (): void => {}
onMounted(() => {
  unsubscribeQuota = onMediaQuotaChanged(() => {
    if (!props.active) {
      lastFetchedAt = 0
      return
    }
    void loadQuota()
  })
})
onBeforeUnmount(() => unsubscribeQuota())
</script>
