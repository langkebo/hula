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
            stroke-width="2"
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
      <div v-if="rooms.length > 0" class="room-list">
        <n-card v-for="room in rooms" :key="room.roomId" class="room-card" size="small" data-testid="room-card">
          <div class="room-card__body">
            <div class="room-card__avatar">
              <img v-if="room.avatarUrl" :src="room.avatarUrl" alt="" class="room-card__avatar-img" />
              <span v-else class="room-card__avatar-placeholder">
                {{ room.name?.charAt(0) || '?' }}
              </span>
            </div>
            <div class="room-card__info">
              <div class="room-card__name">{{ room.name }}</div>
              <div class="room-card__meta">
                <span class="room-card__members">
                  <svg
                    viewBox="0 0 24 24"
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  {{ room.numJoinedMembers }}
                </span>
                <span v-if="room.topic" class="room-card__topic">{{ truncateTopic(room.topic) }}</span>
              </div>
            </div>
            <n-button class="room-card__join" size="small" type="primary" secondary @click="handleJoin(room.roomId)">
              {{ t('room.discovery.join') }}
            </n-button>
          </div>
        </n-card>
        <div ref="sentinelEl" class="room-list__sentinel" data-testid="load-more-sentinel" />
      </div>
      <n-empty v-else :description="t('room.discovery.empty')" data-testid="empty-state" />
    </n-spin>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface PublicRoom {
  roomId: string
  name: string
  topic?: string
  numJoinedMembers: number
  avatarUrl?: string
}

const props = defineProps<{
  rooms: PublicRoom[]
  loading: boolean
}>()

const emit = defineEmits<{
  search: [query: string]
  join: [roomId: string]
  loadMore: [nextBatch: string | null]
}>()

const { t } = useI18n()
const searchQuery = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const DEBOUNCE_MS = 300

const truncateTopic = (topic: string, maxLen = 60): string => {
  if (topic.length <= maxLen) return topic
  return `${topic.slice(0, maxLen)}...`
}

const handleJoin = (roomId: string) => {
  emit('join', roomId)
}

const nextBatch = ref<string | null>(null)
const sentinelEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

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
  gap: 12px;
  min-height: 200px;
}

.discovery-search {
  margin-bottom: 4px;
}

.search-icon {
  color: var(--tjg-text-secondary);
}

.room-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.room-list__sentinel {
  height: 1px;
  width: 100%;
}

.room-card {
  border-radius: 8px;

  :deep(.n-card__content) {
    padding: 12px;
  }
}

.room-card__body {
  display: flex;
  align-items: center;
  gap: 12px;
}

.room-card__avatar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--tjg-bg-secondary);
}

.room-card__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.room-card__avatar-placeholder {
  font-size: 16px;
  font-weight: 500;
  color: var(--tjg-text-secondary);
}

.room-card__info {
  flex: 1;
  min-width: 0;
}

.room-card__name {
  font-size: 14px;
  font-weight: 500;
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.room-card__members {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--tjg-text-secondary);
}

.room-card__topic {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-card__join {
  flex-shrink: 0;
}
</style>
