<template>
  <div class="trendradar-view">
    <!-- 顶部导航 -->
    <div class="trendradar-view__header">
      <div class="trendradar-view__header-left">
        <svg class="trendradar-view__back" @click="handleBack">
          <use href="#left-arrow"></use>
        </svg>
        <h2 class="trendradar-view__title">TrendRadar 资讯助手</h2>
      </div>
      <div class="trendradar-view__header-right">
        <n-tag :type="isConnected ? 'success' : 'error'" size="small">
          {{ isConnected ? '已连接' : '未连接' }}
        </n-tag>
        <svg class="trendradar-view__refresh" @click="handleRefresh">
          <use href="#refresh"></use>
        </svg>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="trendradar-view__content">
      <!-- 侧边导航 -->
      <div class="trendradar-view__sidebar">
        <div
          v-for="item in navItems"
          :key="item.key"
          class="trendradar-view__nav-item"
          :class="{ 'trendradar-view__nav-item--active': activeTab === item.key }"
          @click="activeTab = item.key">
          <svg class="trendradar-view__nav-icon">
            <use :href="`#${item.icon}`"></use>
          </svg>
          <span>{{ item.label }}</span>
        </div>
      </div>

      <!-- 内容面板 -->
      <div class="trendradar-view__main">
        <!-- 热点新闻 -->
        <div v-show="activeTab === 'hot'" class="trendradar-view__panel">
          <div class="trendradar-view__panel-header">
            <h3>热点新闻</h3>
            <n-button size="tiny" @click="loadLatestNews" :loading="loading">刷新</n-button>
          </div>
          <div v-if="loading && newsList.length === 0" class="trendradar-view__loading">
            <n-spin size="large" />
            <span>正在获取资讯...</span>
          </div>
          <div v-else-if="!isConnected" class="trendradar-view__error">
            <svg class="trendradar-view__error-icon"><use href="#alert-circle"></use></svg>
            <span>无法连接到 TrendRadar 服务</span>
            <n-button size="small" @click="handleRetry">重试</n-button>
          </div>
          <div v-else-if="newsList.length === 0" class="trendradar-view__empty">
            <svg class="trendradar-view__empty-icon"><use href="#document"></use></svg>
            <span>暂无热点新闻</span>
            <n-button size="small" @click="loadLatestNews">刷新</n-button>
          </div>
          <div v-else class="trendradar-view__news-grid">
            <NewsCard v-for="(news, index) in newsList" :key="index" :news="news" @click="handleNewsClick" />
          </div>
        </div>

        <!-- 搜索面板 -->
        <div v-show="activeTab === 'search'" class="trendradar-view__panel">
          <SearchPanel
            :results="searchResults"
            :loading="searchLoading"
            @search="handleSearch"
            @news-click="handleNewsClick" />
        </div>

        <!-- 趋势话题 -->
        <div v-show="activeTab === 'trending'" class="trendradar-view__panel">
          <div class="trendradar-view__panel-header">
            <h3>趋势话题</h3>
            <n-button size="tiny" @click="loadTrendingTopics" :loading="trendingLoading">刷新</n-button>
          </div>
          <div v-if="trendingLoading" class="trendradar-view__loading">
            <n-spin size="large" />
            <span>加载中...</span>
          </div>
          <div v-else>
            <TrendingPanel :topics="trendingTopics" :loading="trendingLoading" @topic-click="handleTopicClick" />
          </div>
        </div>

        <!-- RSS订阅 -->
        <div v-show="activeTab === 'rss'" class="trendradar-view__panel">
          <div class="trendradar-view__panel-header">
            <h3>RSS 订阅</h3>
            <n-button size="tiny" @click="loadRss" :loading="rssLoading">刷新</n-button>
          </div>
          <div v-if="rssLoading" class="trendradar-view__loading">
            <n-spin size="large" />
            <span>加载中...</span>
          </div>
          <div v-else-if="rssList.length === 0" class="trendradar-view__empty">
            <svg class="trendradar-view__empty-icon"><use href="#rss"></use></svg>
            <span>暂无订阅内容</span>
          </div>
          <div v-else class="trendradar-view__news-grid">
            <NewsCard v-for="(item, index) in rssList" :key="index" :news="item" @click="handleNewsClick" />
          </div>
        </div>

        <!-- 话题分析 -->
        <div v-show="activeTab === 'analyze'" class="trendradar-view__panel">
          <div class="trendradar-view__panel-header">
            <h3>话题分析</h3>
          </div>
          <div class="trendradar-view__analyze-input">
            <n-input
              v-model:value="analyzeKeyword"
              placeholder="输入想要分析的话题..."
              size="large"
              @keyup.enter="handleAnalyze">
              <template #prefix>
                <svg class="trendradar-view__analyze-icon"><use href="#search"></use></svg>
              </template>
            </n-input>
            <n-button type="primary" size="large" :loading="analyzeLoading" @click="handleAnalyze">分析</n-button>
          </div>
          <div v-if="analyzeLoading" class="trendradar-view__loading">
            <n-spin size="large" />
            <span>正在分析话题...</span>
          </div>
          <div v-else-if="analyzeResult" class="trendradar-view__analyze-result">
            <div class="trendradar-view__analyze-content">{{ analyzeResult }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部输入区 -->
    <div class="trendradar-view__footer">
      <n-input v-model:value="inputKeyword" placeholder="搜索关键词..." size="large" @keyup.enter="handleQuickSearch">
        <template #prefix>
          <svg class="trendradar-view__input-icon"><use href="#search"></use></svg>
        </template>
      </n-input>
      <n-button type="primary" size="large" @click="handleQuickSearch">发送</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTrendRadar } from '@/services/trendradar'
import type { TrendRadarNews, TrendRadarTopic, TrendRadarRssArticle } from '@/services/trendradar'
import NewsCard from '@/components/trendradar/NewsCard.vue'
import TrendingPanel from '@/components/trendradar/TrendingPanel.vue'
import SearchPanel from '@/components/trendradar/SearchPanel.vue'

const emit = defineEmits<{
  (event: 'back'): void
  (event: 'error', message: string): void
}>()

const { isConnected, setupTrendRadar, getLatestNews, searchNews, getTrendingTopics, getLatestRss, analyzeTopicTrend } =
  useTrendRadar()

const activeTab = ref('hot')
const loading = ref(false)
const searchLoading = ref(false)
const trendingLoading = ref(false)
const rssLoading = ref(false)
const analyzeLoading = ref(false)

const newsList = ref<TrendRadarNews[]>([])
const searchResults = ref<TrendRadarNews[]>([])
const trendingTopics = ref<TrendRadarTopic[]>([])
const rssList = ref<TrendRadarRssArticle[]>([])

const inputKeyword = ref('')
const analyzeKeyword = ref('')
const analyzeResult = ref('')

const navItems = [
  { key: 'hot', label: '热点', icon: 'fire' },
  { key: 'search', label: '搜索', icon: 'search' },
  { key: 'trending', label: '趋势', icon: 'trending-up' },
  { key: 'rss', label: '订阅', icon: 'rss' },
  { key: 'analyze', label: '分析', icon: 'chart' }
]

const handleBack = () => {
  emit('back')
}

const handleRefresh = async () => {
  await initializeData()
}

const handleRetry = async () => {
  await initializeData()
}

const handleNewsClick = (news: TrendRadarNews) => {
  if (news.url) {
    window.open(news.url, '_blank')
  }
}

const handleTopicClick = (topic: TrendRadarTopic) => {
  analyzeKeyword.value = topic.name || topic.topic || topic.title || ''
  activeTab.value = 'analyze'
}

const handleSearch = async (keyword: string) => {
  searchLoading.value = true
  try {
    const result = await searchNews(keyword)
    searchResults.value = result.news || []
  } catch (err) {
    emit('error', `搜索失败: ${err}`)
  } finally {
    searchLoading.value = false
  }
}

const handleQuickSearch = async () => {
  if (inputKeyword.value.trim()) {
    activeTab.value = 'search'
    await handleSearch(inputKeyword.value)
  }
}

const handleAnalyze = async () => {
  if (!analyzeKeyword.value.trim()) return
  analyzeLoading.value = true
  analyzeResult.value = ''
  try {
    const result = await analyzeTopicTrend(analyzeKeyword.value)
    analyzeResult.value = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
  } catch (err) {
    emit('error', `分析失败: ${err}`)
  } finally {
    analyzeLoading.value = false
  }
}

const loadLatestNews = async () => {
  loading.value = true
  try {
    const result = await getLatestNews()
    newsList.value = result.news || []
  } catch (err) {
    emit('error', `获取新闻失败: ${err}`)
  } finally {
    loading.value = false
  }
}

const loadTrendingTopics = async () => {
  trendingLoading.value = true
  try {
    trendingTopics.value = await getTrendingTopics()
  } catch (err) {
    emit('error', `获取趋势失败: ${err}`)
  } finally {
    trendingLoading.value = false
  }
}

const loadRss = async () => {
  rssLoading.value = true
  try {
    rssList.value = await getLatestRss()
  } catch (err) {
    emit('error', `获取订阅失败: ${err}`)
  } finally {
    rssLoading.value = false
  }
}

const initializeData = async () => {
  try {
    await setupTrendRadar()
    if (isConnected.value) {
      await Promise.all([loadLatestNews(), loadTrendingTopics()])
    }
  } catch (err) {
    emit('error', `初始化失败: ${err}`)
  }
}

onMounted(() => {
  initializeData()
})
</script>

<style scoped>
.trendradar-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-main);
}

.trendradar-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--hula-border-default);
  background: var(--hula-surface-elevated);
}

.trendradar-view__header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.trendradar-view__back {
  width: 20px;
  height: 20px;
  cursor: pointer;
  color: var(--hula-text-primary);
}

.trendradar-view__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--hula-text-secondary);
  margin: 0;
}

.trendradar-view__header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.trendradar-view__refresh {
  width: 18px;
  height: 18px;
  cursor: pointer;
  color: var(--hula-text-secondary);
  transition: transform 0.3s ease;
}

.trendradar-view__refresh:hover {
  transform: rotate(180deg);
}

.trendradar-view__content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.trendradar-view__sidebar {
  width: 100px;
  padding: 12px;
  border-right: 1px solid var(--hula-border-default);
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--hula-surface-elevated);
}

.trendradar-view__nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--hula-text-secondary);
  font-size: 12px;
  transition: all 0.2s ease;
}

.trendradar-view__nav-item:hover {
  background: var(--hula-surface-list-hover);
  color: var(--hula-text-secondary);
}

.trendradar-view__nav-item--active {
  background: var(--primary-color-alpha);
  color: var(--primary-color);
}

.trendradar-view__nav-icon {
  width: 20px;
  height: 20px;
}

.trendradar-view__main {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.trendradar-view__panel {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.trendradar-view__panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.trendradar-view__panel-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--hula-text-secondary);
  margin: 0;
}

.trendradar-view__loading,
.trendradar-view__error,
.trendradar-view__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: var(--hula-text-secondary);
  font-size: 14px;
}

.trendradar-view__error-icon,
.trendradar-view__empty-icon {
  width: 48px;
  height: 48px;
  opacity: 0.5;
}

.trendradar-view__news-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.trendradar-view__analyze-input {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.trendradar-view__analyze-icon {
  width: 16px;
  height: 16px;
  color: var(--hula-text-secondary);
}

.trendradar-view__analyze-result {
  background: var(--hula-surface-elevated);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--hula-border-default);
}

.trendradar-view__analyze-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--hula-text-secondary);
  white-space: pre-wrap;
}

.trendradar-view__footer {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--hula-border-default);
  background: var(--hula-surface-elevated);
}

.trendradar-view__input-icon {
  width: 16px;
  height: 16px;
  color: var(--hula-text-secondary);
}
</style>
