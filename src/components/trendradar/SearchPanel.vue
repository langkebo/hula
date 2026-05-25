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
          <svg class="search-panel__search-icon"><use href="#search"></use></svg>
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
      <div v-else-if="results.length === 0 && hasSearched" class="search-panel__empty">
        <svg class="search-panel__empty-icon"><use href="#search"></use></svg>
        <span>{{ t('trendradar.no_results') }}</span>
      </div>
      <div v-else class="search-panel__list">
        <NewsCard v-for="(news, index) in results" :key="index" :news="news" @click="handleNewsClick" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TrendRadarNews } from '@/services/trendradar'
import NewsCard from './NewsCard.vue'

const { t } = useI18n()

defineProps<{
  results: TrendRadarNews[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (event: 'search', keyword: string): void
  (event: 'newsClick', news: TrendRadarNews): void
}>()

const keyword = ref('')
const hasSearched = ref(false)

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
  color: var(--hula-text-secondary);
}

.search-panel__results {
  min-height: 200px;
}

.search-panel__loading,
.search-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--hula-text-secondary);
  font-size: 13px;
}

.search-panel__empty-icon {
  width: 32px;
  height: 32px;
  opacity: 0.5;
}

.search-panel__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
