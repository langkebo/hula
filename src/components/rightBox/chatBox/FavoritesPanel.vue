<template>
  <div class="favorites-panel flex flex-col flex-1 min-h-0">
    <!-- 头部：统计 + 导出 -->
    <n-flex
      align="center"
      justify="space-between"
      class="px-12px py-8px shrink-0 border-b border-[--tjg-border-default]">
      <span class="text-[var(--text-xs)] font-medium color-[--tjg-text-tertiary]">
        {{ t('home.chat_sidebar.favorites.total', { count: totalCount }) }}
      </span>
      <n-flex :size="4" align="center">
        <n-button
          size="tiny"
          quaternary
          :disabled="totalCount === 0"
          :title="t('home.chat_sidebar.favorites.export_md', '导出 Markdown')"
          @click="handleExport('md')">
          <template #icon>
            <svg class="size-14px color-[--tjg-text-secondary]">
              <use href="#download"></use>
            </svg>
          </template>
          MD
        </n-button>
        <n-button
          size="tiny"
          quaternary
          :disabled="totalCount === 0"
          :title="t('home.chat_sidebar.favorites.export_txt', '导出文本')"
          @click="handleExport('txt')">
          <template #icon>
            <svg class="size-14px color-[--tjg-text-secondary]">
              <use href="#download"></use>
            </svg>
          </template>
          TXT
        </n-button>
      </n-flex>
    </n-flex>

    <!-- 搜索框 -->
    <n-flex align="center" class="px-12px py-8px shrink-0 border-b border-[--tjg-border-default]">
      <n-input
        v-model:value="searchRef"
        clearable
        :placeholder="t('home.chat_sidebar.favorites.search_placeholder', '搜索收藏消息')"
        type="text"
        size="small"
        spellCheck="false"
        autoComplete="off"
        class="flex-1 bg-[--tjg-surface-search] border-none rounded-6px text-[var(--text-xs)]">
        <template #prefix>
          <svg class="size-12px color-[--tjg-text-tertiary]">
            <use href="#search"></use>
          </svg>
        </template>
      </n-input>
    </n-flex>

    <!-- 收藏列表 -->
    <div class="flex-1 min-h-0 overflow-y-auto px-6px py-4px">
      <template v-if="filteredFavorites.length > 0">
        <div
          v-for="item in filteredFavorites"
          :key="item.eventId"
          class="favorites-panel__item flex flex-col gap-2px px-8px py-6px mb-4px rounded-8px bg-[--tjg-surface-search] cursor-pointer hover:bg-[color-mix(in_srgb,var(--tjg-color-primary-500)_8%,var(--tjg-surface-panel))] transition-colors">
          <n-flex align="center" :size="6">
            <span class="text-[var(--text-xs)] font-medium color-[--tjg-color-primary-500] truncate max-w-120px">
              {{ item.sender }}
            </span>
            <span class="text-[10px] color-[--tjg-text-tertiary]">{{ formatTime(item.timestamp) }}</span>
          </n-flex>
          <p class="text-[var(--text-xs)] color-[--tjg-text-primary] line-clamp-2 break-all">{{ item.body }}</p>
        </div>
      </template>
      <div v-else class="flex-1 flex items-center justify-center h-full">
        <n-empty :description="t('home.chat_sidebar.favorites.empty', '暂无收藏消息')">
          <template #icon>
            <svg class="size-48px opacity-50 color-[--tjg-text-quaternary]">
              <use href="#star"></use>
            </svg>
          </template>
        </n-empty>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFavorites } from '@/composables/room/useFavorites'
import { formatChatTime } from '@/utils/ComputedTime'

defineOptions({ name: 'FavoritesPanel' })

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()
const { favorites, totalCount, load, exportFavorites } = useFavorites({ roomId: () => props.roomId })

const searchRef = ref('')

const filteredFavorites = computed(() => {
  const keyword = searchRef.value.trim().toLowerCase()
  if (!keyword) return favorites.value
  return favorites.value.filter(
    (f) => f.body?.toLowerCase().includes(keyword) || f.sender?.toLowerCase().includes(keyword)
  )
})

const formatTime = (timestamp: number): string => {
  try {
    return formatChatTime(timestamp)
  } catch {
    return ''
  }
}

const handleExport = (format: 'md' | 'txt'): void => {
  const content = exportFavorites(format)
  if (!content) return
  const mime = format === 'md' ? 'text/markdown' : 'text/plain'
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `favorites-${props.roomId}.${format}`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

watch(
  () => props.roomId,
  () => {
    void load()
  }
)

onMounted(() => {
  void load()
})
</script>

<style scoped lang="scss">
.favorites-panel__item {
  transition: background var(--tjg-motion-duration-fast, 150ms) ease;
}

@media (prefers-reduced-motion: reduce) {
  .favorites-panel__item {
    transition: none;
  }
}
</style>
