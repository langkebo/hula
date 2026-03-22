/**
 * TrendRadar MCP 服务
 *
 * 提供趋势雷达 API 的 MCP 协议封装
 * API 文档: https://github.com/TendCode/TrendRadar
 */

import { ref, readonly } from 'vue'

// ============ 类型定义 ============

export interface TrendRadarConfig {
  apiUrl: string
  apiKey: string
}

export interface NewsItem {
  id: string
  title: string
  summary: string
  url: string
  source: string
  publishedAt: string
  sentiment?: 'positive' | 'neutral' | 'negative'
  tags?: string[]
}

export interface TrendingTopic {
  topic: string
  trendScore: number
  relatedKeywords: string[]
  newsCount: number
  sentiment: 'positive' | 'neutral' | 'negative'
}

export interface TrendAnalysis {
  topic: string
  trend: 'rising' | 'stable' | 'declining'
  changePercent: number
  forecast: {
    direction: 'up' | 'down' | 'stable'
    confidence: number
  }
  dataPoints: { date: string; value: number }[]
}

export interface SentimentAnalysis {
  overall: 'positive' | 'neutral' | 'negative'
  score: number
  breakdown: {
    positive: number
    neutral: number
    negative: number
  }
  keywords: { word: string; sentiment: string; weight: number }[]
}

export interface RSSFeed {
  title: string
  url: string
  lastUpdated: string
  items: NewsItem[]
}

export interface Article {
  id: string
  title: string
  content: string
  url: string
  source: string
  publishedAt: string
  author?: string
  images?: string[]
  tags?: string[]
}

export interface PeriodComparison {
  period1: { start: string; end: string; newsCount: number; topTopics: string[] }
  period2: { start: string; end: string; newsCount: number; topTopics: string[] }
  comparison: {
    newsChangePercent: number
    emergingTopics: string[]
    fadingTopics: string[]
    sentimentShift: 'positive' | 'neutral' | 'negative'
  }
}

// ============ 常量 ============

const DEFAULT_API_URL = 'https://api.trendradar.io/v1'

// ============ MCP 协议类型 ============

export interface MCPRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

export interface MCPResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

// ============ 核心类 ============

class TrendRadarClient {
  private config: TrendRadarConfig = {
    apiUrl: DEFAULT_API_URL,
    apiKey: ''
  }

  private requestId = 0

  /**
   * 生成唯一请求 ID
   */
  private generateId(): string | number {
    return ++this.requestId
  }

  /**
   * 配置客户端
   */
  configure(config: Partial<TrendRadarConfig>) {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): TrendRadarConfig {
    return { ...this.config }
  }

  /**
   * 发送 MCP 请求
   */
  private async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method,
      params
    }

    const response = await fetch(`${this.config.apiUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status} - ${response.statusText}`)
    }

    const mcpResponse: MCPResponse = await response.json()

    if (mcpResponse.error) {
      throw new Error(`MCP 错误: ${mcpResponse.error.message}`)
    }

    return mcpResponse.result as T
  }

  // ============ 工具方法 ============

  /**
   * 1. 获取最新新闻
   * @param limit 返回数量限制
   * @param category 可选分类
   */
  async getLatestNews(limit = 10, category?: string): Promise<NewsItem[]> {
    return this.request<NewsItem[]>('news.latest', { limit, category })
  }

  /**
   * 2. 搜索新闻
   * @param query 搜索关键词
   * @param limit 返回数量限制
   * @param startDate 可选开始日期
   * @param endDate 可选结束日期
   */
  async searchNews(query: string, limit = 10, startDate?: string, endDate?: string): Promise<NewsItem[]> {
    return this.request<NewsItem[]>('news.search', { query, limit, startDate, endDate })
  }

  /**
   * 3. 获取热门话题
   * @param limit 返回数量限制
   * @param category 可选分类
   */
  async getTrendingTopics(limit = 10, category?: string): Promise<TrendingTopic[]> {
    return this.request<TrendingTopic[]>('trending.topics', { limit, category })
  }

  /**
   * 4. 分析话题趋势
   * @param topic 话题关键词
   * @param period 分析周期 (7d, 30d, 90d)
   */
  async analyzeTopicTrend(topic: string, period = '30d'): Promise<TrendAnalysis> {
    return this.request<TrendAnalysis>('trending.analyze', { topic, period })
  }

  /**
   * 5. 分析情感
   * @param text 要分析的文本
   * @param context 可选上下文
   */
  async analyzeSentiment(text: string, context?: string): Promise<SentimentAnalysis> {
    return this.request<SentimentAnalysis>('sentiment.analyze', { text, context })
  }

  /**
   * 6. 聚合新闻
   * @param keywords 关键词列表
   * @param startDate 开始日期
   * @param endDate 结束日期
   */
  async aggregateNews(keywords: string[], startDate?: string, endDate?: string): Promise<NewsItem[]> {
    return this.request<NewsItem[]>('news.aggregate', { keywords, startDate, endDate })
  }

  /**
   * 7. 对比时间段
   * @param period1Start 第一个周期开始
   * @param period1End 第一个周期结束
   * @param period2Start 第二个周期开始
   * @param period2End 第二个周期结束
   */
  async comparePeriods(
    period1Start: string,
    period1End: string,
    period2Start: string,
    period2End: string
  ): Promise<PeriodComparison> {
    return this.request<PeriodComparison>('analysis.compare', {
      period1: { start: period1Start, end: period1End },
      period2: { start: period2Start, end: period2End }
    })
  }

  /**
   * 8. 获取最新 RSS 订阅
   * @param source RSS 源名称
   * @param limit 返回数量限制
   */
  async getLatestRss(source: string, limit = 10): Promise<RSSFeed> {
    return this.request<RSSFeed>('rss.latest', { source, limit })
  }

  /**
   * 9. 读取文章
   * @param articleId 文章 ID
   */
  async readArticle(articleId: string): Promise<Article> {
    return this.request<Article>('article.read', { articleId })
  }

  /**
   * 10. 批量读取文章
   * @param articleIds 文章 ID 列表
   */
  async readArticlesBatch(articleIds: string[]): Promise<Article[]> {
    return this.request<Article[]>('article.readBatch', { articleIds })
  }

  /**
   * 11. 获取分类新闻
   * @param category 分类名称
   * @param limit 返回数量限制
   */
  async getNewsByCategory(category: string, limit = 10): Promise<NewsItem[]> {
    return this.request<NewsItem[]>('news.category', { category, limit })
  }

  /**
   * 12. 获取新闻来源列表
   */
  async getNewsSources(): Promise<string[]> {
    return this.request<string[]>('news.sources')
  }

  /**
   * 13. 获取话题关联新闻
   * @param topic 话题关键词
   * @param limit 返回数量限制
   */
  async getTopicNews(topic: string, limit = 10): Promise<NewsItem[]> {
    return this.request<NewsItem[]>('news.topic', { topic, limit })
  }

  /**
   * 14. 获取实时热点
   * @param limit 返回数量限制
   */
  async getRealtimeHot(limit = 20): Promise<TrendingTopic[]> {
    return this.request<TrendingTopic[]>('trending.realtime', { limit })
  }

  /**
   * 15. 分析新闻趋势
   * @param topic 话题关键词
   * @param metric 分析指标 (volume, sentiment, engagement)
   */
  async analyzeNewsTrend(topic: string, metric = 'volume'): Promise<TrendAnalysis> {
    return this.request<TrendAnalysis>('trend.analyze', { topic, metric })
  }

  /**
   * 16. 获取情感趋势
   * @param topic 话题关键词
   * @param period 时间周期
   */
  async getSentimentTrend(topic: string, period = '30d'): Promise<TrendAnalysis> {
    return this.request<TrendAnalysis>('sentiment.trend', { topic, period })
  }

  /**
   * 17. 提取关键词
   * @param text 要分析的文本
   * @param limit 返回数量限制
   */
  async extractKeywords(text: string, limit = 10): Promise<string[]> {
    return this.request<string[]>('nlp.keywords', { text, limit })
  }

  /**
   * 18. 提取实体
   * @param text 要分析的文本
   * @param types 实体类型 (person, org, location, etc.)
   */
  async extractEntities(
    text: string,
    types?: string[]
  ): Promise<{ type: string; value: string; confidence: number }[]> {
    return this.request<{ type: string; value: string; confidence: number }[]>('nlp.entities', { text, types })
  }

  /**
   * 19. 订阅话题更新
   * @param topic 话题关键词
   * @param callbackUrl 回调 URL
   */
  async subscribeTopic(topic: string, callbackUrl: string): Promise<{ subscriptionId: string }> {
    return this.request<{ subscriptionId: string }>('subscribe.topic', { topic, callbackUrl })
  }

  /**
   * 20. 取消订阅
   * @param subscriptionId 订阅 ID
   */
  async unsubscribe(subscriptionId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('subscribe.cancel', { subscriptionId })
  }
}

// ============ 导出单例 ============

export const trendRadarClient = new TrendRadarClient()

// ============ Vue Composable ============

/**
 * Vue Composable: 使用 TrendRadar
 */
export function useTrendRadar() {
  // 响应式状态
  const isConnected = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 配置
  const config = ref<TrendRadarConfig>({
    apiUrl: DEFAULT_API_URL,
    apiKey: ''
  })

  /**
   * 配置客户端
   */
  function setupTrendRadar(newConfig: Partial<TrendRadarConfig>) {
    config.value = { ...config.value, ...newConfig }
    trendRadarClient.configure(config.value)
    isConnected.value = true
  }

  /**
   * 获取最新新闻
   */
  async function fetchLatestNews(limit?: number, category?: string) {
    isLoading.value = true
    error.value = null
    try {
      return await trendRadarClient.getLatestNews(limit, category)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '获取新闻失败'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 搜索新闻
   */
  async function searchNews(query: string, limit?: number, startDate?: string, endDate?: string) {
    isLoading.value = true
    error.value = null
    try {
      return await trendRadarClient.searchNews(query, limit, startDate, endDate)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '搜索失败'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 获取热门话题
   */
  async function fetchTrendingTopics(limit?: number, category?: string) {
    isLoading.value = true
    error.value = null
    try {
      return await trendRadarClient.getTrendingTopics(limit, category)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '获取热门话题失败'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 分析话题趋势
   */
  async function analyzeTopicTrend(topic: string, period?: string) {
    isLoading.value = true
    error.value = null
    try {
      return await trendRadarClient.analyzeTopicTrend(topic, period)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '分析失败'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 分析情感
   */
  async function analyzeSentiment(text: string, context?: string) {
    isLoading.value = true
    error.value = null
    try {
      return await trendRadarClient.analyzeSentiment(text, context)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '情感分析失败'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  return {
    // 状态 (只读)
    isConnected: readonly(isConnected),
    isLoading: readonly(isLoading),
    error: readonly(error),
    config: readonly(config),

    // 方法
    setupTrendRadar,
    fetchLatestNews,
    searchNews,
    fetchTrendingTopics,
    analyzeTopicTrend,
    analyzeSentiment,

    // 直接访问客户端方法
    client: trendRadarClient
  }
}

// 导出所有工具方法作为独立函数
export {
  trendRadarClient as client,
  type TrendRadarConfig,
  type NewsItem,
  type TrendingTopic,
  type TrendAnalysis,
  type SentimentAnalysis,
  type RSSFeed,
  type Article,
  type PeriodComparison,
  type MCPRequest,
  type MCPResponse
}
