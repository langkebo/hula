import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend'
import { warn, error as logError } from '@tauri-apps/plugin-log'
import { formatMatrixError } from '@/common/matrixErrorTranslator'

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: Record<string, unknown>
  params?: Record<string, string | number>
  headers?: Record<string, string>
}

export interface Result<T> {
  ok: boolean
  data?: T
  error?: string
}

export class AIExtensionDisabledError extends Error {
  constructor(endpoint: string) {
    super(`AI extension endpoint disabled: ${endpoint}`)
    this.name = 'AIExtensionDisabledError'
  }
}

const AI_EXTENSION_ENABLED = import.meta.env.VITE_AI_EXTENSION_ENABLED === 'true'

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

/**
 * HTTP 请求工具
 * 面向 Matrix 后端的通用 HTTP 请求封装
 */
class HttpClient {
  private baseUrl: string = ''
  private hasWarnedAiDisabled = false

  constructor() {
    const { homeserverUrl } = resolveMatrixRuntimeEndpointConfig()
    this.baseUrl = homeserverUrl
  }

  private isAiExtensionEndpoint(url: string): boolean {
    const trimmed = url.replace(/^\/+/, '').split(/[?#]/)[0]
    return AI_EXTENSION_ENDPOINTS.has(trimmed)
  }

  /**
   * 发送 HTTP 请求
   * @param options 请求选项
   * @returns 响应数据
   */
  async request<T = unknown>(options: RequestOptions): Promise<T> {
    const { url, method = 'GET', body, params, headers = {} } = options

    if (!AI_EXTENSION_ENABLED && this.isAiExtensionEndpoint(url)) {
      if (!this.hasWarnedAiDisabled) {
        this.hasWarnedAiDisabled = true
        warn(`[HttpClient] AI 扩展接口已禁用 (VITE_AI_EXTENSION_ENABLED=false)，跳过请求: ${url}`)
      }
      throw new AIExtensionDisabledError(url)
    }

    const normalizedPath =
      url.startsWith('http://') || url.startsWith('https://')
        ? url
        : `${this.baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`

    let fullUrl = normalizedPath
    if (params && method === 'GET') {
      const queryString = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
      fullUrl = `${fullUrl}?${queryString}`
    }

    try {
      const response = await fetch(fullUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: body || (params && method !== 'GET') ? JSON.stringify(body || params) : undefined
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (err) {
      logError(`[HttpClient] 请求失败: ${url} | ${formatMatrixError(err)}`)
      throw err
    }
  }

  /**
   * 发送 HTTP 请求并返回 Result 格式
   * @param options 请求选项
   * @returns Result 格式的响应
   */
  async requestResult<T = unknown>(options: RequestOptions): Promise<Result<T>> {
    try {
      const data = await this.request<T>(options)
      return {
        ok: true,
        data
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }
}

export const httpClient = new HttpClient()
export default httpClient
