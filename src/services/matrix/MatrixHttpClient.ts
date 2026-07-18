import type { MatrixClient } from 'matrix-js-sdk'
import { type AppError, toAppError } from '@/common/errors'
import { err, ok, type Result } from '@/common/result'
import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend'
import { createLogger } from '@/utils/Logger'
import { getMatrixAccessToken, getMatrixClient, getMatrixHomeserverUrl } from './matrixClientAccessor'
import { getRuntimeAwareFetch } from './network/runtimeFetch'

export interface MatrixHttpRequestOptions {
  queryParams?: Record<string, string | number>
  body?: Record<string, unknown>
  headers?: Record<string, string>
  throwOnError?: boolean
  logPrefix?: string
  defaultValue?: unknown
  quiet?: boolean
  retries?: number
  retryDelay?: number
  showLoading?: boolean
  showErrorToast?: boolean
}

type MatrixHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

interface MatrixAuthedRequestInvoker {
  authedRequest(
    method: MatrixHttpMethod,
    path: string,
    queryParams?: Record<string, string>,
    body?: Record<string, unknown>,
    options?: { headers?: Record<string, string>; prefix?: string }
  ): Promise<unknown>
}

/**
 * 已知的 Matrix SDK 前缀列表（长前缀优先匹配，避免短前缀误匹配）。
 * SDK authedRequest 默认使用 ClientPrefix.V3 (/_matrix/client/v3)，会自动拼接到 path 前。
 * 若调用方传入的 path 已含完整前缀，会导致 URL 翻倍（如 /_matrix/client/v3/_matrix/client/v3/...）。
 * 此函数检测并剥离已知前缀，返回短路径和需要显式设置的 prefix（仅非默认前缀需要）。
 */
const MATRIX_PREFIXES = [
  '/_matrix/client/v3',
  '/_matrix/client/v1',
  '/_matrix/client/r0',
  '/_matrix/client/unstable',
  '/_matrix/media/v3',
  '/_matrix/media/v1',
  '/_matrix/media/r0',
  '/_synapse/admin/v1',
  '/_synapse/admin/v2',
  '/_matrix/admin/v1'
] as const

const SDK_DEFAULT_PREFIX = '/_matrix/client/v3'

/**
 * 剥离 path 中的已知 Matrix 前缀，避免 SDK authedRequest 再次拼接导致 URL 翻倍。
 * @returns { path: 短路径, prefix: 需显式设置的 prefix（undefined 表示用 SDK 默认） }
 */
export function stripMatrixPrefix(requestPath: string): { path: string; prefix?: string } {
  for (const prefix of MATRIX_PREFIXES) {
    if (requestPath === prefix || requestPath.startsWith(`${prefix}/`)) {
      const stripped = requestPath.slice(prefix.length) || '/'
      // SDK 默认前缀无需显式传递
      if (prefix === SDK_DEFAULT_PREFIX) {
        return { path: stripped }
      }
      return { path: stripped, prefix }
    }
  }
  return { path: requestPath }
}

/**
 * 使用 stripMatrixPrefix 包装 client.http.authedRequest。
 *
 * 用于 path 含完整前缀（如 MATRIX_PATHS.SPACE.HIERARCHY，含 PREFIX_V1）的场景：
 * 剥离已知前缀后以 { prefix } 选项传递，避免 SDK 再次拼接默认 client 前缀
 * 导致 URL 翻倍（双前缀 → 404）。
 *
 * 对于短路径（不含前缀），stripMatrixPrefix 原样返回，行为等价于直接调用 authedRequest。
 */
export async function authedRequestWithPath<T>(
  client: MatrixClient,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  fullPath: string,
  queryParams?: Record<string, string>,
  body?: object
): Promise<T> {
  const { path, prefix } = stripMatrixPrefix(fullPath)
  const opts = prefix ? { prefix } : undefined
  return (await client.http.authedRequest(method, path, queryParams, body, opts)) as T
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

export class AIExtensionDisabledError extends Error {
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

    const showLoading = requestOptions.showLoading ?? false
    const showErrorToast = requestOptions.showErrorToast ?? false

    if (showLoading && window.$loadingBar) {
      window.$loadingBar.start()
    }

    let retries = requestOptions.retries ?? 0
    const retryDelay = requestOptions.retryDelay ?? 1000

    while (true) {
      try {
        const result = await this._doRequest<T>(method, requestPath, requestOptions)
        if (showLoading && window.$loadingBar) {
          window.$loadingBar.finish()
        }
        return result
      } catch (err: unknown) {
        const error = err as Error & { message?: string }
        // Retry only on network errors or 5xx server errors
        const isRetryable = err instanceof TypeError || error.message?.includes('HTTP 5')
        if (!isRetryable || retries <= 0) {
          if (showLoading && window.$loadingBar) {
            window.$loadingBar.error()
          }
          if (showErrorToast && window.$message) {
            window.$message.error(error.message || String(err))
          }
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
      // client.http.authedRequest 内部会自动处理 accessToken 和 baseUrl
      // stripMatrixPrefix 剥离已知前缀，避免 SDK 再次拼接导致 URL 翻倍
      const { path: strippedPath, prefix: strippedPrefix } = stripMatrixPrefix(requestPath)
      const http = client.http as unknown as MatrixAuthedRequestInvoker
      const opts: { headers?: Record<string, string>; prefix?: string } = {}
      if (requestOptions.headers) opts.headers = requestOptions.headers
      if (strippedPrefix) opts.prefix = strippedPrefix

      if (Object.keys(opts).length > 0) {
        return (await http.authedRequest(method, strippedPath, queryParams, requestOptions.body, opts)) as T
      }
      if (requestOptions.body !== undefined) {
        return (await http.authedRequest(method, strippedPath, queryParams, requestOptions.body)) as T
      }
      return (await http.authedRequest(method, strippedPath, queryParams)) as T
    }

    // 回退到手动 fetch (用于 client 尚未初始化或非 authed 请求)
    const homeserverUrl = getMatrixHomeserverUrl() || resolveMatrixRuntimeEndpointConfig().homeserverUrl
    const baseUrl = homeserverUrl.replace(/\/$/, '')
    const fullUrl = requestPath.startsWith('http') ? requestPath : `${baseUrl}/${requestPath.replace(/^\//, '')}`

    let urlWithParams = fullUrl
    if (queryParams) {
      const searchParams = new URLSearchParams(queryParams)
      urlWithParams = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${searchParams.toString()}`
    }

    const accessToken = getMatrixAccessToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...requestOptions.headers
    }
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const runtimeFetch = getRuntimeAwareFetch()
    const response = await runtimeFetch(urlWithParams, {
      method,
      headers,
      body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`)
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

    const mergedOptions = {
      showErrorToast: !quiet,
      ...options
    }

    try {
      const result = await this.request<T>(method, path, mergedOptions)
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
   * 发送请求并返回 Result<T, AppError> 格式
   */
  async requestAppResult<T>(
    method: MatrixHttpMethod,
    path: string,
    options: MatrixHttpRequestOptions = {}
  ): Promise<Result<T, AppError>> {
    try {
      const data = await this.request<T>(method, path, options)
      return ok(data)
    } catch (e) {
      return err(toAppError(e))
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

  buildRoomPath(roomId: string, suffix: string): string {
    return `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/${suffix}`
  }

  buildUserPath(userId: string, suffix: string): string {
    return `/_matrix/client/v3/user/${encodeURIComponent(userId)}/${suffix}`
  }
}

export const matrixHttpClient = new MatrixHttpClient()
