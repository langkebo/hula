<template>
  <section class="public-room-discovery" role="region" :aria-label="t('room.discovery.aria_label')">
    <div class="discovery-search">
      <n-input
        v-model:value="searchQuery"
        :placeholder="t('room.discovery.search_placeholder')"
        clearable
        data-testid="search-input">
        <template #prefix>
          <svg
            class="search-icon"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </template>
      </n-input>
    </div>

    <n-spin :show="loading">
      <div v-if="rooms.length > 0" class="room-list" :style="gridStyle">
        <RoomCard v-for="room in rooms" :key="room.roomId" :item="room" @join="openPreview" @preview="openPreview" />
        <div ref="sentinelEl" class="room-list__sentinel" data-testid="load-more-sentinel" />
      </div>
      <n-empty v-else :description="t('room.discovery.empty')" data-testid="empty-state" />
    </n-spin>

    <RoomPreviewDialog
      :show="previewVisible"
      :room="previewRoom"
      :require-reason="previewRequireReason"
      @update:show="previewVisible = $event"
      @cancel="previewVisible = false"
      @join="handleJoin" />
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import RoomCard, { type RoomCardData } from './RoomCard.vue'
import RoomPreviewDialog from './RoomPreviewDialog.vue'

const props = defineProps<{
  rooms: RoomCardData[]
  loading: boolean
}>()

const emit = defineEmits<{
  search: [query: string]
  join: [roomId: string, reason?: string]
  loadMore: [nextBatch: string | null]
}>()

const { t } = useI18n()
const searchQuery = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const DEBOUNCE_MS = 300

/** 响应式 minmax 网格：窄主窗自动降列 */
const gridStyle = {
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))'
} as const

const nextBatch = ref<string | null>(null)
const sentinelEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

// 预览对话框状态
const previewVisible = ref(false)
const previewRoom = ref<RoomCardData | null>(null)

const previewRequireReason = ref(false)

const openPreview = (roomId: string) => {
  const room = props.rooms.find((r) => r.roomId === roomId) ?? null
  previewRoom.value = room
  previewRequireReason.value = room?.isFederated === true
  previewVisible.value = true
}

const handleJoin = (roomId: string, reason?: string) => {
  emit('join', roomId, reason)
}

const loadMore = () => {
  if (props.loading) {
    return
  }
  emit('loadMore', nextBatch.value)
}

const setupObserver = () => {
  if (typeof IntersectionObserver === 'undefined' || !sentinelEl.value) {
    return
  }
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        loadMore()
      }
    }
  })
  observer.observe(sentinelEl.value)
}

watch(searchQuery, (value) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    emit('search', value)
  }, DEBOUNCE_MS)
})

onMounted(() => {
  setupObserver()
})

onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  observer?.disconnect()
  observer = null
})

defineExpose({ nextBatch, loadMore })
</script>

<style scoped lang="scss">
.public-room-discovery {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-3);
  min-height: 200px;
}

.discovery-search {
  margin-bottom: 4px;
}

.search-icon {
  color: var(--tjg-text-secondary);
}

.room-list {
  display: grid;
  gap: var(--tjg-space-2);
}

.room-list__sentinel {
  height: 1px;
  width: 100%;
  grid-column: 1 / -1;
}
</style>
