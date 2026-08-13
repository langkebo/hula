import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixClientService } from '../MatrixClientService'
import { getRuntimeAwareFetch } from '../network/runtimeFetch'

const logger = createLogger('SynapseExtensionHttpBase')

/**
 * synapse-rust 私有扩展端点的共享 HTTP 基础设施。
 *
 * 历史背景：这些方法原先全部堆在 SynapseRustExtensionsService（1069 行"杂物抽屉"），
 * 2026-08 按域拆分为 extensions/ 下的多个专职服务，本基类承载它们共用的
 * 初始化 / 鉴权请求 / 响应解包 / 端点探测逻辑。
 *
 * 每个子服务实例独立持有 baseUrl/accessToken，ensureInitialized 每次调用都会
 * 从 matrixClientService 读取最新 token，因此 token 刷新对各实例天然生效。
 */
export abstract class SynapseExtensionHttpBase extends BaseMatrixService {
  private baseUrl: string = ''
  private accessToken: string = ''
  private endpointAvailability: Map<string, boolean> = new Map()

  /** 初始化扩展 HTTP 客户端
   */
  async initialize(): Promise<void> {
    const baseUrlFromConfig = matrixClientService.getHomeserverUrl?.() || ''
    const accessTokenFromConfig = matrixClientService.getAccessToken?.() || ''

    if (baseUrlFromConfig && accessTokenFromConfig) {
      this.baseUrl = baseUrlFromConfig
      this.accessToken = accessTokenFromConfig
      return
    }

    const client = await matrixClientService.waitForClientReady({
      timeoutMs: 5000
    })

    const baseUrl = client.getHomeserverUrl()
    const accessToken = client.getAccessToken() || ''
    if (!baseUrl || !accessToken) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    this.baseUrl = baseUrl
    this.accessToken = accessToken
  }

  /** 清理扩展状态
   */
  clear(): void {
    this.baseUrl = ''
    this.accessToken = ''
    this.endpointAvailability.clear()
  }

  /** 停止扩展服务
   */
  stop(): void {
    this.accessToken = ''
  }

  protected async ensureInitialized(): Promise<void> {
    // 每次都从 matrixClientService 获取最新 token，确保 Token 刷新后不会使用旧 token
    const latestToken = matrixClientService.getAccessToken?.() || ''
    if (!this.baseUrl || !this.accessToken || this.accessToken !== latestToken) {
      if (latestToken) {
        this.accessToken = latestToken
      }
      if (!this.baseUrl) {
        await this.initialize()
      }
    }

    if (!this.baseUrl || !this.accessToken) {
      throw new Error(this.t('matrix_error.extensions.not_initialized'))
    }
  }

  protected async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    await this.ensureInitialized()
    const url = `${this.baseUrl}${endpoint}`
    const runtimeFetch = getRuntimeAwareFetch()

    // GET/HEAD 请求不应设置 Content-Type，避免服务端尝试解析空的请求体
    const isBodylessMethod = !options.method || options.method === 'GET' || options.method === 'HEAD'
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      ...(options.headers as Record<string, string>)
    }
    if (!isBodylessMethod) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await runtimeFetch(url, {
      ...options,
      headers
    })

    const text = await response.text()

    if (!response.ok) {
      // 429 限流是正常行为，降级为 WARN 避免日志噪音
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        logger.warn(`[SynapseRust] ${endpoint} 请求被限流${retryAfter ? `，建议 ${retryAfter}s 后重试` : ''}`)
        throw new Error(this.t('matrix_error.extensions.rate_limited'))
      }

      let parsed: Record<string, unknown> = {}
      try {
        parsed = text ? JSON.parse(text) : {}
      } catch {
        parsed = { error: text || `HTTP ${response.status}` }
      }
      logger.error(`[SynapseRust] API 请求失败: ${endpoint}`, parsed)
      throw new Error(
        (parsed.message as string) ||
          (parsed.error as string) ||
          this.t('matrix_error.extensions.api_request_failed_with_status', { status: response.status })
      )
    }

    if (!text || text.trim() === '') {
      logger.warn(`[SynapseRust] ${endpoint} 返回空响应体`)
      return {} as T
    }

    try {
      return JSON.parse(text) as T
    } catch {
      logger.warn(`[SynapseRust] ${endpoint} 返回非 JSON 响应: ${text.substring(0, 200)}`)
      return {} as T
    }
  }

  protected unwrapMaybeWrappedData<T>(
    response: T | { data?: T; status?: string; code?: string; message?: string }
  ): T | undefined {
    if (response && typeof response === 'object' && 'status' in response && response.status === 'error') {
      const errorResponse = response as { message?: string }
      throw new Error(errorResponse.message || this.t('matrix_error.common.request_failed'))
    }

    if (response && typeof response === 'object' && 'data' in response) {
      const wrapped = response as { data?: T; status?: string }
      if (wrapped.data !== undefined) {
        return wrapped.data
      }
      if (wrapped.status === 'ok' && wrapped.data === undefined) {
        logger.warn('[SynapseRust] 响应 status=ok 但缺少 data 字段，尝试将整个响应作为数据返回')
        const { data: _, status: __, code: ___, message: ____, ...rest } = wrapped as Record<string, unknown>
        if (Object.keys(rest).length > 0) {
          return rest as unknown as T
        }
        return undefined
      }
    }

    return response as T
  }

  /** 检查扩展端点可用性
   */
  async checkEndpointAvailability(endpoint: string): Promise<boolean> {
    const cached = this.endpointAvailability.get(endpoint)
    if (cached !== undefined) return cached

    try {
      await this.ensureInitialized()
      const url = `${this.baseUrl}${endpoint}`
      const runtimeFetch = getRuntimeAwareFetch()
      const response = await runtimeFetch(url, {
        method: 'HEAD',
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      })
      const available = response.ok || response.status === 405
      this.endpointAvailability.set(endpoint, available)
      return available
    } catch {
      this.endpointAvailability.set(endpoint, false)
      return false
    }
  }
}
