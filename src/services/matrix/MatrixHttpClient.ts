import type { MatrixClient } from 'matrix-js-sdk'
import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend'
import { createLogger } from '@/utils/Logger'
import { createMatrixTransportError } from './MatrixRequestHelper'
import { getMatrixAccessToken, getMatrixClient, getMatrixHomeserverUrl } from './matrixClientAccessor'
import { getRuntimeAwareFetch } from './network/runtimeFetch'
import { PREFIX_V3 } from './paths/prefixes'

interface MatrixHttpRequestOptions {
  queryParams?: Record<string, string | number>
  body?: Record<string, unknown>
  headers?: Record<string, string>
  throwOnError?: boolean
  logPrefix?: string
  defaultValue?: unknown
  quiet?: boolean
  retries?: number
  retryDelay?: number
}

type MatrixHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

/**
 * SDK manager 的前缀感知请求入口。
 *
 * `Method` 是 SDK 字符串枚举，前端以字符串字面量调用，故此处经本地结构类型收敛。
 */
interface MatrixAuthedRequestWithPrefixInvoker {
  authedRequestWithPrefix<T>(
    method: string,
    path: string,
    queryParams?: Record<string, string>,
    body?: Record<string, unknown>
  ): Promise<T>
}

/**
 * 使用 SDK BaseManager.authedRequestWithPrefix 发送带完整前缀的 Matrix 请求。
 *
 * 用于 path 含完整前缀（如 MATRIX_PATHS.SPACE.HIERARCHY，含 PREFIX_V1）的场景：
 * SDK 内部按 `KNOWN_PREFIXES`（21 条，长前缀优先）单遍剥离路径中已有的
 * `/_matrix/...` 完整前缀，并以命中前缀作为请求 `prefix`，避免默认 v3 前缀二次
 * 拼接导致 URL 翻倍（双前缀 → 404）。相比旧的本地 12 条前缀表，SDK 表额外覆盖
 * federation / key / identity / msc3575 / msc4186 等命名空间，是前缀解析的单一权威来源。
 *
 * 短路径（不含前缀）直接用 SDK 默认 v3 前缀，行为等价于直接调用 authedRequest。
 * `getRoomManager()` 在 `createClient()` 返回后即同步可用（SDK 会同步安装核心 manager 扩展）。
 */
export async function authedRequestWithPath<T>(
  client: MatrixClient,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  fullPath: string,
  queryParams?: Record<string, string>,
  body?: object
): Promise<T> {
  const requester = client.getRoomManager() as unknown as MatrixAuthedRequestWithPrefixInvoker
  return await requester.authedRequestWithPrefix<T>(
    method,
    fullPath,
    queryParams,
    body as Record<string, unknown> | undefined
  )
}

const AI_EXTENSION_ENABLED = import.meta.env.VITE_AI_EXTENSION_ENABLED === 'true'
const logger = createLogger('MatrixHttpClient')

const AI_EXTENSION_ENDPOINTS = new Set<string>([
  'getAssistantModelList',
  'mapCoordTranslate',
  'mapReverseGeocode',
  'mapStatic',
  'messageSendStream',
  'messageSaveGeneratedContent',
  'messageListByConversationId',
  'messageDelete',
  'messageDeleteByConversationId',
  'conversationPage',
  'conversationGetMy',
  'conversationCreateMy',
  'conversationUpdateMy',
  'conversationDeleteMy',
  'modelRemainingUsage',
  'modelPage',
  'modelUpdate',
  'modelDelete',
  'imageMyPage',
  'imageMyListByIds',
  'imageDraw',
  'videoMyPage',
  'videoMyListByIds',
  'videoGenerate',
  'audioMyPage',
  'audioMyListByIds',
  'audioGenerate',
  'audioVoices',
  'apiKeyPage',
  'apiKeySimpleList',
  'apiKeyCreate',
  'apiKeyUpdate',
  'apiKeyDelete',
  'apiKeyBalance',
  'platformList',
  'platformAddModel',
  'chatRolePage',
  'chatRoleCategoryList',
  'chatRoleCreate',
  'chatRoleUpdate',
  'chatRoleDelete'
])

class AIExtensionDisabledError extends Error {
  constructor(endpoint: string) {
    super(`AI extension endpoint disabled: ${endpoint}`)
    this.name = 'AIExtensionDisabledError'
  }
}

/**
 * 统一的 Matrix HTTP 客户端
 *
 * 相比通用的 HttpClient，它会自动处理 Matrix 认证、Homeserver URL 解析，
 * 并与 Matrix SDK 的请求逻辑保持一致。
 */
class MatrixHttpClient {
  private hasWarnedAiDisabled = false

  private isAiExtensionEndpoint(url: string): boolean {
    const trimmed = url.replace(/^\/+/, '').split(/[?#]/)[0]
    return AI_EXTENSION_ENDPOINTS.has(trimmed)
  }

  /**
   * Issue an HTTP request through the Matrix SDK client.
   *
   * @throws {MatrixError} with errcode M_UNKNOWN_TOKEN if the access token is invalid.
   * @throws {MatrixError} with errcode M_LIMIT_EXCEEDED if rate-limited.
   * @throws {MatrixError} with httpStatus 5xx for server errors (retried internally).
   */
  async request<T>(
    methodOrOptions:
      | MatrixHttpMethod
      | {
          url: string
          method?: MatrixHttpMethod
          body?: Record<string, unknown>
          params?: Record<string, string | number>
          headers?: Record<string, string>
          retries?: number
          retryDelay?: number
        },
    path?: string,
    options: Omit<MatrixHttpRequestOptions, 'throwOnError' | 'defaultValue'> = {}
  ): Promise<T> {
    let method: MatrixHttpMethod
    let requestPath: string
    let requestOptions: Omit<MatrixHttpRequestOptions, 'throwOnError' | 'defaultValue'>

    if (typeof methodOrOptions === 'object') {
      method = methodOrOptions.method || 'GET'
      requestPath = methodOrOptions.url
      requestOptions = {
        ...options,
        body: methodOrOptions.body,
        queryParams: methodOrOptions.params,
        headers: methodOrOptions.headers,
        retries: methodOrOptions.retries,
        retryDelay: methodOrOptions.retryDelay
      }
    } else {
      method = methodOrOptions
      requestPath = path!
      requestOptions = options
    }

    let retries = requestOptions.retries ?? 0
    const retryDelay = requestOptions.retryDelay ?? 1000

    while (true) {
      try {
        const result = await this._doRequest<T>(method, requestPath, requestOptions)
        return result
      } catch (err: unknown) {
        const status = (err as { httpStatus?: unknown }).httpStatus
        // Retry only on network errors or 5xx server errors
        const isRetryable = err instanceof TypeError || (typeof status === 'number' && status >= 500)
        if (!isRetryable || retries <= 0) {
          throw err
        }
        retries--
        logger.warn(`请求失败，准备重试 (${retries} 次剩余): ${requestPath}`, err)
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
      }
    }
  }

  private async _doRequest<T>(
    method: MatrixHttpMethod,
    requestPath: string,
    requestOptions: Omit<MatrixHttpRequestOptions, 'throwOnError' | 'defaultValue'>
  ): Promise<T> {
    if (!AI_EXTENSION_ENABLED && this.isAiExtensionEndpoint(requestPath)) {
      if (!this.hasWarnedAiDisabled) {
        this.hasWarnedAiDisabled = true
        logger.warn(`AI 扩展接口已禁用 (VITE_AI_EXTENSION_ENABLED=false)，跳过请求: ${requestPath}`)
      }
      throw new AIExtensionDisabledError(requestPath)
    }

    const client = getMatrixClient()
    const queryParams = requestOptions.queryParams
      ? Object.fromEntries(Object.entries(requestOptions.queryParams).map(([k, v]) => [k, String(v)]))
      : undefined

    if (client) {
      // 经 SDK manager 统一入口：内部自动处理 accessToken / baseUrl，
      // 并按 KNOWN_PREFIXES 剥离路径中已有的完整前缀，避免二次拼接默认 v3 前缀。
      const requester = client.getRoomManager() as unknown as MatrixAuthedRequestWithPrefixInvoker
      return await requester.authedRequestWithPrefix<T>(method, requestPath, queryParams, requestOptions.body)
    }

    // 未鉴权回退传输（client 尚未初始化时进入）。
    //
    // 仅承载**登录前**的未认证请求（如新设备扫码登录的 `/_matrix/client/v3/login`
    // 令牌交换，见 auth/qrLoginHelpers.postJson）。此路径不持有、也不注入 access token：
    // accessor 的 token 与 client 同源（MatrixConnectionManager 注册
    // `getAccessToken: () => this.client?.getAccessToken()`），client 为 null 时 token
    // 必为 null，故显式标注为「未鉴权」语义；错误仍经 MatrixRequestHelper 的
    // createMatrixTransportError 统一归一。
    const homeserverUrl = getMatrixHomeserverUrl() || resolveMatrixRuntimeEndpointConfig().homeserverUrl
    const baseUrl = homeserverUrl.replace(/\/$/, '')
    const fullUrl = requestPath.startsWith('http') ? requestPath : `${baseUrl}/${requestPath.replace(/^\//, '')}`

    let urlWithParams = fullUrl
    if (queryParams) {
      const searchParams = new URLSearchParams(queryParams)
      urlWithParams = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${searchParams.toString()}`
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...requestOptions.headers
    }

    const runtimeFetch = getRuntimeAwareFetch()
    const response = await runtimeFetch(urlWithParams, {
      method,
      headers,
      body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw createMatrixTransportError({
        status: response.status,
        statusText: response.statusText,
        bodyText: errorText,
        headers: response.headers,
        method,
        url: urlWithParams
      })
    }

    const responseText = await response.text()
    return (responseText ? JSON.parse(responseText) : {}) as T
  }

  /**
   * 发送带错误处理的 HTTP 请求
   *
   * @throws {Error} Re-throws the underlying error when throwOnError is true.
   * @throws {MatrixError} See {@link request} for error details.
   */
  async safeRequest<T>(
    method: MatrixHttpMethod,
    path: string,
    options: MatrixHttpRequestOptions = {}
  ): Promise<T | null> {
    const { logPrefix = 'MatrixHttpClient', defaultValue = null, quiet = false, throwOnError = false } = options

    try {
      const result = await this.request<T>(method, path, options)
      if (!quiet && method !== 'GET') {
        logger.info(`[${logPrefix}] ${method} ${path} 成功`)
      }
      return result
    } catch (err) {
      if (!quiet) {
        logger.error(`[${logPrefix}] ${method} ${path} 失败`, err)
      }
      if (throwOnError) {
        throw err
      }
      return defaultValue as T | null
    }
  }

  /**
   * 兼容旧版 HttpClient 的 requestResult
   */
  async requestResult<T = unknown>(options: {
    url: string
    method?: MatrixHttpMethod
    body?: Record<string, unknown>
    params?: Record<string, string | number>
    headers?: Record<string, string>
  }): Promise<{ ok: boolean; data?: T; error?: string }> {
    try {
      const data = await this.request<T>(options.method || 'GET', options.url, {
        body: options.body,
        queryParams: options.params,
        headers: options.headers
      })
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async get<T>(path: string, options: MatrixHttpRequestOptions = {}): Promise<T | null> {
    return this.safeRequest<T>('GET', path, options)
  }

  async post<T>(
    path: string,
    body?: Record<string, unknown>,
    options: MatrixHttpRequestOptions = {}
  ): Promise<T | null> {
    return this.safeRequest<T>('POST', path, {
      ...options,
      body
    })
  }

  async put<T>(
    path: string,
    body?: Record<string, unknown>,
    options: MatrixHttpRequestOptions = {}
  ): Promise<T | null> {
    return this.safeRequest<T>('PUT', path, {
      ...options,
      body
    })
  }

  async patch<T>(
    path: string,
    body?: Record<string, unknown>,
    options: MatrixHttpRequestOptions = {}
  ): Promise<T | null> {
    return this.safeRequest<T>('PATCH', path, {
      ...options,
      body
    })
  }

  async delete(path: string, options: MatrixHttpRequestOptions = {}): Promise<boolean> {
    const result = await this.safeRequest<unknown>('DELETE', path, {
      ...options,
      defaultValue: false
    })
    return Boolean(result !== false)
  }

  /**
   * 获取当前 Access Token
   */
  getAccessToken(): string | null {
    return getMatrixAccessToken()
  }

  /**
   * 获取当前 Homeserver URL
   */
  getHomeserverUrl(): string | null {
    return getMatrixHomeserverUrl()
  }

  encodeMatrixId(id: string): string {
    return encodeURIComponent(id)
  }

  /**
   * 房间短路径构造。
   *
   * `prefix` 缺省为 SDK 默认的 v3 前缀（`PREFIX_V3`）；room-scoped **私有**端点
   * （unread_count / capabilities 等，后端 2026-10-08 M3 迁走）必须显式传
   * `PREFIX_VENDOR_V1`，否则会 404。
   */
  buildRoomPath(roomId: string, suffix: string, prefix = PREFIX_V3): string {
    return `${prefix}/rooms/${encodeURIComponent(roomId)}/${suffix}`
  }

  buildUserPath(userId: string, suffix: string): string {
    return `${PREFIX_V3}/user/${encodeURIComponent(userId)}/${suffix}`
  }
}

export const matrixHttpClient = new MatrixHttpClient()
