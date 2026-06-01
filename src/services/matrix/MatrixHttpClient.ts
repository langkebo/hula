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
    options?: { headers?: Record<string, string> }
  ): Promise<unknown>
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
   * 发送底层 HTTP 请求
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
      const http = client.http as unknown as MatrixAuthedRequestInvoker
      if (requestOptions.headers) {
        return (await http.authedRequest(method, requestPath, queryParams, requestOptions.body, {
          headers: requestOptions.headers
        })) as T
      }

      if (requestOptions.body !== undefined) {
        return (await http.authedRequest(method, requestPath, queryParams, requestOptions.body)) as T
      }

      return (await http.authedRequest(method, requestPath, queryParams)) as T
    }

    // 回退到手动 fetch (用于 client 尚未初始化或非 authed 请求)
    const homeserverUrl = getMatrixHomeserverUrl() || resolveMatrixRuntimeEndpointConfig().homeserverUrl
    const baseUrl = homeserverUrl.replace(/\/$/, '')
    const fullUrl = requestPath.startsWith('http') ? requestPath : `${baseUrl}/${requestPath.replace(/^\//, '')}`

    let urlWithParams = fullUrl
    if (queryParams && method === 'GET') {
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
