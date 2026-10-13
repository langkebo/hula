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
        </template>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import { formatBytes } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileStorageSettings')

const { t } = useI18n()

const loading = ref(false)
const usage = ref(0)
const quota = ref(0)

const usageText = computed(() => formatBytes(usage.value))
const quotaText = computed(() => formatBytes(quota.value))

/** 用量占比，封顶 100（配额未知时为 0） */
const usagePercent = computed(() => {
  if (!quota.value) return 0
  return Math.min(100, Math.round((usage.value / quota.value) * 100))
})

async function loadStats(): Promise<void> {
  // ⚠️ 这里曾展示「缓存命中率 / 内存占用 / 缓存条目」并调用矩阵 worker 的 getStats()。
  // Batch 3.2 取证确认该消息在 worker 侧恒返回 null（worker 从不持有 client）⇒ 三项永远为
  // 0 / `-`；同时「清理缓存」按钮调用的 clearStores() 是 no-op 却会弹「清理成功」。
  // 两者已一并移除，不再用假数据与假成功欺骗用户。
  // 浏览器存储用量是真实数据，保留。
  loading.value = true
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      usage.value = estimate.usage ?? 0
      quota.value = estimate.quota ?? 0
    }
  } catch (error) {
    logger.error('Failed to load storage stats', error)
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
</script>
