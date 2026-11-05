import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixClientService } from '../MatrixClientService'
import { createMatrixTransportError } from '../MatrixRequestHelper'
import { getRuntimeAwareFetch } from '../network/runtimeFetch'

const logger = createLogger('SynapseExtensionHttpBase')

/** 扩展端点单请求超时（毫秒）。与 `HttpClient` 的 30s 不同：这些是轻量读写接口，15s 足够。 */
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000

/** 能力探测（HEAD）超时：探测失败只影响降级判断，给更短的窗口。 */
const PROBE_TIMEOUT_MS = 5_000

/**
 * synapse-rust 私有扩展端点的共享 HTTP 基础设施。
 *
 * 历史背景：这些方法原先全部堆在 SynapseRustExtensionsService（1069 行"杂物抽屉"），
 * 2026-08 按域拆分为 extensions/ 下的多个专职服务，本基类承载它们共用的
 * 初始化 / 鉴权请求 / 响应解包 / 端点探测逻辑。
 *
 * AR-07b / B1：**不再持有 token 字段**。
 * 此前每个子服务实例各存一份 `accessToken`，靠「每次请求比对 latestToken」兜陈旧 ——
 * 那是副本导致的补丁（7 个 extension ≈ 7 份副本 + 一段比对逻辑）。现在改为
 * 每次请求直接问 `matrixClientService.getAccessToken()`（它一路委托到 SDK client，
 * 是唯一事实源；相比全局 accessor 保留 DI 可注入性，便于单测），副本与补丁同时消失。
 * baseUrl 仍缓存：它不随刷新变化。
 */
export abstract class SynapseExtensionHttpBase extends BaseMatrixService {
  private baseUrl: string = ''
  private endpointAvailability: Map<string, boolean> = new Map()

  /** 初始化扩展 HTTP 客户端（只解析并缓存 baseUrl；token 每次请求现取）
   */
  async initialize(): Promise<void> {
    const baseUrlFromConfig = matrixClientService.getHomeserverUrl?.() || ''

    if (baseUrlFromConfig) {
      this.baseUrl = baseUrlFromConfig
      return
    }

    const client = await matrixClientService.waitForClientReady({
      timeoutMs: 5000
    })

    const baseUrl = client.getHomeserverUrl()
    if (!baseUrl) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    this.baseUrl = baseUrl
  }

  /** 清理扩展状态
   */
  clear(): void {
    this.baseUrl = ''
    this.endpointAvailability.clear()
  }

  /** 停止扩展服务
   */
  stop(): void {
    this.baseUrl = ''
  }

  /** 确保 baseUrl 可用，并返回本次请求要用的 token（现取，不缓存） */
  protected async ensureInitialized(): Promise<string> {
    if (!this.baseUrl) {
      await this.initialize()
    }

    const accessToken = matrixClientService.getAccessToken?.() || ''
    if (!this.baseUrl || !accessToken) {
      throw new Error(this.t('matrix_error.extensions.not_initialized'))
    }

    return accessToken
  }

  protected async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const accessToken = await this.ensureInitialized()
    const url = `${this.baseUrl}${endpoint}`
    const runtimeFetch = getRuntimeAwareFetch()

    // GET/HEAD 请求不应设置 Content-Type，避免服务端尝试解析空的请求体
    const isBodylessMethod = !options.method || options.method === 'GET' || options.method === 'HEAD'
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers as Record<string, string>)
    }
    if (!isBodylessMethod) {
      headers['Content-Type'] = 'application/json'
    }

    // 超时治理（审计 M-2）：此前直接 `runtimeFetch(url, options)`，没有 AbortController，
    // 后端慢查询/挂住时 Promise 永不 settle ⇒ 界面永久 loading 且无法取消。
    // 现在统一 15s 超时，并与调用方传入的 signal 合并（外部取消优先）。
    const externalSignal = options.signal ?? undefined
    const controller = new AbortController()
    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, DEFAULT_REQUEST_TIMEOUT_MS)
    const abortFromExternal = () => controller.abort()
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort()
      else externalSignal.addEventListener('abort', abortFromExternal, { once: true })
    }

    let response: Response
    try {
      response = await runtimeFetch(url, {
        ...options,
        headers,
        signal: controller.signal
      })
    } catch (err) {
      if (timedOut) {
        logger.warn(`[SynapseRust] ${endpoint} 请求超时（${DEFAULT_REQUEST_TIMEOUT_MS}ms）`)
        throw createMatrixTransportError({
          status: 0,
          fallbackErrcode: 'M_UNKNOWN',
          message: this.t('matrix_error.extensions.api_request_failed_with_status', {
            status: `timeout(${DEFAULT_REQUEST_TIMEOUT_MS}ms)`
          }),
          method: options.method ?? 'GET',
          url
        })
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
      externalSignal?.removeEventListener('abort', abortFromExternal)
    }

    const text = await response.text()

    if (!response.ok) {
      const isRateLimited = response.status === 429
      const transportError = createMatrixTransportError({
        status: response.status,
        statusText: response.statusText,
        bodyText: text,
        headers: response.headers,
        message: isRateLimited ? this.t('matrix_error.extensions.rate_limited') : undefined,
        fallbackMessage: isRateLimited
          ? undefined
          : this.t('matrix_error.extensions.api_request_failed_with_status', { status: response.status })
      })

      // 429 限流是正常行为，降级为 WARN 避免日志噪音
      if (isRateLimited) {
        logger.warn(
          `[SynapseRust] ${endpoint} 请求被限流${
            transportError.retryAfterMs !== undefined ? `，建议 ${transportError.retryAfterMs}ms 后重试` : ''
          }`
        )
      } else {
        logger.error(`[SynapseRust] API 请求失败: ${endpoint}`, transportError.data)
      }
      throw transportError
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
          return rest as T
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
      const accessToken = await this.ensureInitialized()
      const url = `${this.baseUrl}${endpoint}`
      const runtimeFetch = getRuntimeAwareFetch()
      // 探测同样需要超时：否则端点黑洞会让能力检测永久挂起，进而卡住整个域的功能。
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
      let response: Response
      try {
        response = await runtimeFetch(url, {
          method: 'HEAD',
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          signal: controller.signal
        })
      } finally {
        clearTimeout(timeoutId)
      }
      const available = response.ok || response.status === 405
      this.endpointAvailability.set(endpoint, available)
      return available
    } catch {
      this.endpointAvailability.set(endpoint, false)
      return false
    }
  }
}
