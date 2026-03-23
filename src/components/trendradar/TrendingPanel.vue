<template>
  <div class="trending-panel">
    <div class="trending-panel__header">
      <svg class="trending-panel__icon"><use href="#trending-up"></use></svg>
      <span class="trending-panel__title">趋势话题</span>
    </div>
    <div class="trending-panel__list">
      <div v-for="(topic, index) in topics" :key="index" class="trending-panel__item" @click="handleTopicClick(topic)">
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
        <svg v-if="topic.trend === 'up'" class="trending-panel__trend trending-panel__trend--up">
          <use href="#arrow-up"></use>
        </svg>
        <svg v-else-if="topic.trend === 'down'" class="trending-panel__trend trending-panel__trend--down">
          <use href="#arrow-down"></use>
        </svg>
      </div>
    </div>
    <div v-if="loading" class="trending-panel__loading">
      <n-spin size="small" />
      <span>加载中...</span>
    </div>
    <div v-else-if="topics.length === 0" class="trending-panel__empty">
      <svg class="trending-panel__empty-icon"><use href="#trending-up"></use></svg>
      <span>暂无趋势话题</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface TrendingTopic {
  name?: string
  topic?: string
  title?: string
  hotValue?: number | string
  category?: string
  trend?: 'up' | 'down' | 'stable'
}

defineProps<{
  topics: TrendingTopic[]
  loading?: boolean
}>()

const emit = defineEmits<(event: 'topicClick', topic: TrendingTopic) => void>()

const formatHotValue = (value: number | string) => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return String(value)
  if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿'
  if (num >= 10000) return (num / 10000).toFixed(1) + '万'
  return String(num)
}

const handleTopicClick = (topic: TrendingTopic) => {
  emit('topicClick', topic)
}
</script>

<style scoped>
.trending-panel {
  background: var(--bg-popover);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid var(--line-color);
}

.trending-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line-color);
}

.trending-panel__icon {
  width: 18px;
  height: 18px;
  color: var(--primary-color);
}

.trending-panel__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--chat-text-color);
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
  transition: background-color 0.2s ease;
}

.trending-panel__item:hover {
  background: var(--bg-hover);
}

.trending-panel__rank {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-color-secondary);
  background: var(--bg-hover);
  border-radius: 4px;
  flex-shrink: 0;
}

.trending-panel__rank--hot {
  background: linear-gradient(135deg, #ff6b6b, #ff4757);
  color: white;
}

.trending-panel__content {
  flex: 1;
  min-width: 0;
}

.trending-panel__topic-name {
  font-size: 13px;
  color: var(--chat-text-color);
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
  color: var(--text-color-tertiary);
}

.trending-panel__category {
  font-size: 11px;
  color: var(--primary-color);
  background: var(--primary-color-alpha);
  padding: 1px 6px;
  border-radius: 4px;
}

.trending-panel__trend {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.trending-panel__trend--up {
  color: #ff4757;
}

.trending-panel__trend--down {
  color: #2ed573;
}

.trending-panel__loading,
.trending-panel__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: var(--text-color-secondary);
  font-size: 12px;
}

.trending-panel__empty-icon {
  width: 24px;
  height: 24px;
  opacity: 0.5;
}
</style>
