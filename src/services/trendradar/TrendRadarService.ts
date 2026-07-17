import { ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('TrendRadarService')

export interface TrendRadarTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface TrendRadarNews {
  title: string
  url: string
  platform: string
  publishTime?: string
  summary?: string
}

export interface TrendRadarSearchResult {
  news: TrendRadarNews[]
  total: number
}

export interface TrendRadarTopic {
  name?: string
  topic?: string
  title?: string
  hotValue?: number | string
  category?: string
  trend?: 'up' | 'down' | 'stable'
  [key: string]: unknown
}

export type TrendRadarRssArticle = TrendRadarNews & Record<string, unknown>

export type TrendRadarAnalysisResult = string | Record<string, unknown> | unknown[]

export interface McpRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: {
    name?: string
    arguments?: Record<string, unknown>
  }
  id: number | string
}

export interface McpRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  result?: T
  error?: {
    code: number
    message: string
  }
  id: number | string
}

const DEFAULT_MCP_ENDPOINT = 'http://127.0.0.1:3333/mcp'
const DEFAULT_TIMEOUT = 30000

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const getArrayField = <T>(value: unknown, key: string): T[] | null => {
  if (!isRecord(value)) return null
  const field = value[key]
  return Array.isArray(field) ? (field as T[]) : null
}

const getNumberField = (value: unknown, key: string): number | undefined => {
  if (!isRecord(value)) return undefined
  const field = value[key]
  return typeof field === 'number' ? field : undefined
}

class TrendRadarService {
  private mcpEndpoint: string = DEFAULT_MCP_ENDPOINT
  private requestId: number = 0

  setEndpoint(endpoint: string): void {
    this.mcpEndpoint = endpoint
    logger.info(`[TrendRadar] MCP endpoint set to: ${endpoint}`)
  }

  getEndpoint(): string {
    return this.mcpEndpoint
  }

  private async callMcp<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = ++this.requestId

    const request: McpRpcRequest = {
      jsonrpc: '2.0',
      method,
      params: params ? { arguments: params } : undefined,
      id
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)

    try {
      const response = await fetch(this.mcpEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = (await response.json()) as McpRpcResponse<T>

      if (data.error) {
        throw new Error(`MCP Error ${data.error.code}: ${data.error.message}`)
      }

      return data.result as T
    } catch (err) {
      clearTimeout(timeoutId)

      if (err instanceof Error && err.name === 'AbortError') {
        logger.warn('[TrendRadar] MCP request timeout')
        throw new Error('请求超时，请检查 TrendRadar 服务是否正常运行')
      }

      logger.error(`[TrendRadar] MCP call failed: ${err}`)
      throw err
    }
  }

  async listTools(): Promise<TrendRadarTool[]> {
    try {
      const result = await this.callMcp<{ tools: TrendRadarTool[] }>('tools/list')
      logger.info(`[TrendRadar] Listed ${result.tools?.length || 0} tools`)
      return result.tools || []
    } catch (err) {
      logger.error(`[TrendRadar] Failed to list tools: ${err}`)
      throw new Error(`获取工具列表失败: ${err}`)
    }
  }

  async callTool<T = unknown>(toolName: string, args?: Record<string, unknown>): Promise<T> {
    logger.info(`[TrendRadar] Calling tool: ${toolName}`)
    try {
      const result = await this.callMcp<T>('tools/call', {
        name: toolName,
        arguments: args || {}
      })
      logger.info(`[TrendRadar] Tool ${toolName} called successfully`)
      return result
    } catch (err) {
      logger.error(`[TrendRadar] Failed to call tool ${toolName}: ${err}`)
      throw new Error(`调用工具 ${toolName} 失败: ${err}`)
    }
  }

  async getLatestNews(platforms?: string[], limit: number = 10): Promise<TrendRadarSearchResult> {
    try {
      const result = await this.callTool<{ news?: TrendRadarNews[]; total?: number } | TrendRadarNews[]>(
        'get_latest_news',
        {
          platforms: platforms || ['知乎', '今日头条', '百度热搜'],
          limit
        }
      )
      const news = getArrayField<TrendRadarNews>(result, 'news') ?? (Array.isArray(result) ? result : [])
      return {
        news,
        total: getNumberField(result, 'total') ?? news.length
      }
    } catch (err) {
      logger.error(`[TrendRadar] Failed to get latest news: ${err}`)
      throw new Error(`获取最新新闻失败: ${err}`)
    }
  }

  async searchNews(keyword: string, limit: number = 10): Promise<TrendRadarSearchResult> {
    try {
      const result = await this.callTool<{ news?: TrendRadarNews[]; total?: number } | TrendRadarNews[]>(
        'search_news',
        {
          keyword,
          limit
        }
      )
      const news = getArrayField<TrendRadarNews>(result, 'news') ?? (Array.isArray(result) ? result : [])
      return {
        news,
        total: getNumberField(result, 'total') ?? news.length
      }
    } catch (err) {
      logger.error(`[TrendRadar] Failed to search news: ${err}`)
      throw new Error(`搜索新闻失败: ${err}`)
    }
  }

  async getTrendingTopics(limit: number = 10): Promise<TrendRadarTopic[]> {
    try {
      const result = await this.callTool<{ topics?: TrendRadarTopic[] } | TrendRadarTopic[]>('get_trending_topics', {
        limit
      })
      return getArrayField<TrendRadarTopic>(result, 'topics') ?? (Array.isArray(result) ? result : [])
    } catch (err) {
      logger.error(`[TrendRadar] Failed to get trending topics: ${err}`)
      throw new Error(`获取趋势话题失败: ${err}`)
    }
  }

  async getLatestRss(feeds?: string[], limit: number = 10): Promise<TrendRadarRssArticle[]> {
    try {
      const result = await this.callTool<{ articles?: TrendRadarRssArticle[] } | TrendRadarRssArticle[]>(
        'get_latest_rss',
        {
          feeds: feeds || [],
          limit
        }
      )
      return getArrayField<TrendRadarRssArticle>(result, 'articles') ?? (Array.isArray(result) ? result : [])
    } catch (err) {
      logger.error(`[TrendRadar] Failed to get RSS updates: ${err}`)
      throw new Error(`获取 RSS 更新失败: ${err}`)
    }
  }

  async analyzeTopicTrend(topic: string): Promise<TrendRadarAnalysisResult> {
    try {
      const result = await this.callTool<TrendRadarAnalysisResult>('analyze_topic_trend', { topic })
      return result
    } catch (err) {
      logger.error(`[TrendRadar] Failed to analyze topic trend: ${err}`)
      throw new Error(`分析话题趋势失败: ${err}`)
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.listTools()
      return true
    } catch {
      return false
    }
  }
}

const trendRadarClient = new TrendRadarService()

const isConnected = ref(false)

async function setupTrendRadar(endpoint?: string): Promise<void> {
  if (endpoint) {
    trendRadarClient.setEndpoint(endpoint)
  }

  try {
    const connected = await trendRadarClient.healthCheck()
    isConnected.value = connected
    if (connected) {
      logger.info('[TrendRadar] Connected successfully')
    } else {
      logger.warn('[TrendRadar] Connection failed')
    }
  } catch (err) {
    isConnected.value = false
    logger.error(`[TrendRadar] Setup failed: ${err}`)
    throw err
  }
}

export function useTrendRadar() {
  return {
    isConnected,
    setupTrendRadar,
    client: trendRadarClient,
    listTools: trendRadarClient.listTools.bind(trendRadarClient),
    callTool: trendRadarClient.callTool.bind(trendRadarClient),
    getLatestNews: trendRadarClient.getLatestNews.bind(trendRadarClient),
    searchNews: trendRadarClient.searchNews.bind(trendRadarClient),
    getTrendingTopics: trendRadarClient.getTrendingTopics.bind(trendRadarClient),
    getLatestRss: trendRadarClient.getLatestRss.bind(trendRadarClient),
    analyzeTopicTrend: trendRadarClient.analyzeTopicTrend.bind(trendRadarClient),
    healthCheck: trendRadarClient.healthCheck.bind(trendRadarClient),
    setEndpoint: trendRadarClient.setEndpoint.bind(trendRadarClient),
    getEndpoint: trendRadarClient.getEndpoint.bind(trendRadarClient)
  }
}

export { TrendRadarService, trendRadarClient }
export default useTrendRadar
