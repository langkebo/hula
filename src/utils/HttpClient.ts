import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend'
import { error as logError } from '@tauri-apps/plugin-log'

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

/**
 * HTTP 请求工具
 * 面向 Matrix 后端的通用 HTTP 请求封装
 */
class HttpClient {
  private baseUrl: string = ''

  constructor() {
    const { homeserverUrl } = resolveMatrixRuntimeEndpointConfig()
    this.baseUrl = homeserverUrl
  }

  /**
   * 发送 HTTP 请求
   * @param options 请求选项
   * @returns 响应数据
   */
  async request<T = unknown>(options: RequestOptions): Promise<T> {
    const { url, method = 'GET', body, params, headers = {} } = options

    // 构建 URL（如果有 params）
    let fullUrl = `${this.baseUrl}${url}`
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
      logError(`[HttpClient] 请求失败: ${url}, ${err}`)
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
