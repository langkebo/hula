<template>
  <div class="news-card" @click="handleClick">
    <div class="news-card__header">
      <n-tag size="small" :type="platformType" class="news-card__platform">
        {{ news.platform }}
      </n-tag>
      <span class="news-card__time">{{ formattedTime }}</span>
    </div>
    <h4 class="news-card__title">{{ news.title }}</h4>
    <p v-if="news.summary" class="news-card__summary">{{ news.summary }}</p>
    <div class="news-card__footer">
      <n-tag v-for="tag in tags" :key="tag" size="tiny" class="news-card__tag">
        {{ tag }}
      </n-tag>
      <div class="news-card__action">
        <span class="news-card__link">查看详情</span>
        <svg class="news-card__arrow"><use href="#right-arrow"></use></svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TrendRadarNews } from '@/services/trendradar'

const props = defineProps<{
  news: TrendRadarNews
}>()

const emit = defineEmits<(event: 'click', news: TrendRadarNews) => void>()

const platformType = computed(() => {
  const platform = props.news.platform?.toLowerCase() || ''
  if (platform.includes('知乎')) return 'info'
  if (platform.includes('头条') || platform.includes('微博')) return 'warning'
  if (platform.includes('百度')) return 'success'
  return 'default'
})

const formattedTime = computed(() => {
  if (!props.news.publishTime) return ''
  const date = new Date(props.news.publishTime)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN')
})

const tags = computed(() => {
  if (!props.news.title) return []
  const title = props.news.title
  const tagList: string[] = []
  if (title.includes('AI') || title.includes('人工智能')) tagList.push('AI')
  if (title.includes('科技')) tagList.push('科技')
  if (title.includes('财经') || title.includes('金融')) tagList.push('财经')
  if (title.includes('娱乐')) tagList.push('娱乐')
  return tagList.slice(0, 3)
})

const handleClick = () => {
  emit('click', props.news)
  if (props.news.url) {
    window.open(props.news.url, '_blank')
  }
}
</script>

<style scoped>
.news-card {
  background: var(--bg-popover);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid var(--line-color);
}

.news-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--primary-color);
}

.news-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.news-card__platform {
  flex-shrink: 0;
}

.news-card__time {
  font-size: 11px;
  color: var(--text-color-tertiary);
}

.news-card__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--chat-text-color);
  margin: 0 0 8px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-card__summary {
  font-size: 12px;
  color: var(--text-color-secondary);
  margin: 0 0 8px 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-card__footer {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.news-card__tag {
  flex-shrink: 0;
}

.news-card__action {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  color: var(--primary-color);
  font-size: 12px;
}

.news-card__arrow {
  width: 12px;
  height: 12px;
}
</style>
