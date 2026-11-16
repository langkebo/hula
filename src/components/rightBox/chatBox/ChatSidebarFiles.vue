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
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { formatBytes } from '@/utils/Formatting'

const props = defineProps<{ active: boolean }>()

const { t } = useI18n()

type QuotaStats = { storageBytes: number; mediaCount: number; limitBytes: number }

const quota = ref<QuotaStats | null>(null)
const loading = ref(false)
/** 首次探测结束（成功或失败）—— 避免「还没请求」时就把空态当成结果 */
const loaded = ref(false)
/** 上次成功取数的时刻：配额变化不频繁，60s 内重复切面板不再打接口；过期则重取（上传文件后不至于整场陈旧） */
const QUOTA_TTL_MS = 60_000
let lastFetchedAt = 0

/**
 * 配额取不到时（接口不支持 / 鉴权失败 / 离线）返回 null：
 * 这里选择**整块隐藏**而不是显示 0 或占位，避免把「不知道」呈现成「用量为 0」。
 */
const loadQuota = async (): Promise<void> => {
  if (loading.value) return
  loading.value = true
  // 注意：`getQuotaStats()` 内部已 try/catch，失败一律返回 null（`fetchQuotaStats`），
  // 所以这里不再包 try/catch —— 那层 catch 永远打不到（变异自证时发现的死代码）。
  quota.value = await matrixMediaService.getQuotaStats()
  lastFetchedAt = Date.now()
  loading.value = false
  loaded.value = true
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
</script>
