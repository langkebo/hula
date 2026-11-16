<template>
  <div class="search-panel">
    <div class="search-panel__header">
      <n-input
        v-model:value="keyword"
        :placeholder="t('trendradar.search_news_placeholder')"
        size="small"
        clearable
        @keyup.enter="handleSearch">
        <template #prefix>
          <svg class="search-panel__search-icon" aria-hidden="true"><use href="#search"></use></svg>
        </template>
      </n-input>
      <n-button size="small" type="primary" :loading="loading" @click="handleSearch">
        {{ t('trendradar.search') }}
      </n-button>
    </div>
    <div class="search-panel__results">
      <div v-if="loading" class="search-panel__loading">
        <n-spin size="small" />
        <span>{{ t('trendradar.searching') }}</span>
      </div>
      <EmptyState v-else-if="isEmptyResults" illustration="no-results" :description="t('trendradar.no_results')" />
      <div v-else class="search-panel__list">
        <NewsCard v-for="news in results" :key="news.url" :news="news" @click="handleNewsClick" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import type { TrendRadarNews } from '@/services/trendradar'
import NewsCard from './NewsCard.vue'

const { t } = useI18n()

const props = defineProps<{
  results: TrendRadarNews[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (event: 'search', keyword: string): void
  (event: 'newsClick', news: TrendRadarNews): void
}>()

const keyword = ref('')
const hasSearched = ref(false)

const isEmptyResults = computed(() => hasSearched.value && props.results.length === 0)

const handleSearch = () => {
  if (keyword.value.trim()) {
    hasSearched.value = true
    emit('search', keyword.value.trim())
  }
}

const handleNewsClick = (news: TrendRadarNews) => {
  emit('newsClick', news)
}
</script>

<style scoped>
.search-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-panel__header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-panel__search-icon {
  width: 14px;
  height: 14px;
  color: var(--tjg-text-secondary);
}

.search-panel__results {
  min-height: 200px;
}

.search-panel__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--tjg-text-secondary);
  font-size: 13px;
}

.search-panel__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
