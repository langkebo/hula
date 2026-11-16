<template>
  <div class="trending-panel">
    <div class="trending-panel__header">
      <svg class="trending-panel__icon" aria-hidden="true"><use href="#trending-up"></use></svg>
      <span class="trending-panel__title">{{ t('trendradar.trending_topics') }}</span>
    </div>
    <div class="trending-panel__list">
      <div
        v-for="(topic, index) in topics"
        :key="topic.name || topic.topic || topic.title || index"
        class="trending-panel__item"
        @click="handleTopicClick(topic)">
        <div class="trending-panel__rank" :class="{ 'trending-panel__rank--hot': index < 3 }">
          {{ index + 1 }}
        </div>
        <div class="trending-panel__content">
          <div class="trending-panel__topic-name">{{ topic.name || topic.topic || topic.title }}</div>
          <div class="trending-panel__meta">
            <span v-if="topic.hotValue" class="trending-panel__hot-value">
              {{ formatHotValue(topic.hotValue) }}
            </span>
            <span v-if="topic.category" class="trending-panel__category">
              {{ topic.category }}
            </span>
          </div>
        </div>
        <svg v-if="topic.trend === 'up'" class="trending-panel__trend trending-panel__trend--up" aria-hidden="true">
          <use href="#arrow-up"></use>
        </svg>
        <svg
          v-else-if="topic.trend === 'down'"
          class="trending-panel__trend trending-panel__trend--down"
          aria-hidden="true">
          <use href="#arrow-down"></use>
        </svg>
      </div>
    </div>
    <div v-if="loading" class="trending-panel__loading">
      <n-spin size="small" />
      <span>{{ t('trendradar.loading') }}</span>
    </div>
    <EmptyState
      v-else-if="isEmptyTopics"
      compact
      icon="mdi:trending-up"
      :description="t('trendradar.no_trending_topics')" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import type { TrendRadarTopic } from '@/services/trendradar'

const { t } = useI18n()

const props = defineProps<{
  topics: TrendRadarTopic[]
  loading?: boolean
}>()

const isEmptyTopics = computed(() => props.topics.length === 0)

const emit = defineEmits<(event: 'topicClick', topic: TrendRadarTopic) => void>()

const formatHotValue = (value: number | string) => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return String(value)
  if (num >= 100000000) return (num / 100000000).toFixed(1) + t('trendradar.billion')
  if (num >= 10000) return (num / 10000).toFixed(1) + t('trendradar.ten_thousand')
  return String(num)
}

const handleTopicClick = (topic: TrendRadarTopic) => {
  emit('topicClick', topic)
}
</script>

<style scoped>
.trending-panel {
  background: var(--tjg-surface-elevated);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid var(--tjg-border-default);
}

.trending-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--tjg-border-default);
}

.trending-panel__icon {
  width: 18px;
  height: 18px;
  color: var(--tjg-color-primary-500);
}

.trending-panel__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--tjg-text-secondary);
}

.trending-panel__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trending-panel__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-normal) ease;
}

.trending-panel__item:hover {
  background: var(--tjg-surface-list-hover);
}

.trending-panel__rank {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--tjg-text-secondary);
  background: var(--tjg-surface-list-hover);
  border-radius: 4px;
  flex-shrink: 0;
}

.trending-panel__rank--hot {
  background: linear-gradient(135deg, var(--tjg-color-danger-400), var(--tjg-color-danger-500));
  color: var(--tjg-text-inverse);
}

.trending-panel__content {
  flex: 1;
  min-width: 0;
}

.trending-panel__topic-name {
  font-size: 13px;
  color: var(--tjg-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trending-panel__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.trending-panel__hot-value {
  font-size: 11px;
  color: var(--tjg-text-tertiary);
}

.trending-panel__category {
  font-size: 11px;
  color: var(--tjg-color-primary-500);
  background: var(--tjg-color-primary-300-alpha);
  padding: 1px 6px;
  border-radius: 4px;
}

.trending-panel__trend {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.trending-panel__trend--up {
  color: var(--tjg-color-danger-500);
}

.trending-panel__trend--down {
  color: var(--tjg-color-success-500);
}

.trending-panel__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: var(--tjg-text-secondary);
  font-size: 12px;
}
</style>
