import { createLogger } from '@/utils/Logger'
import matrixClientService from './MatrixClientService'
import { getRuntimeAwareFetch } from './network/runtimeFetch'

const logger = createLogger('EndpointCapabilityService')

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface EndpointCheckResult {
  available: boolean
  checkedAt: number
}

const endpointCache = new Map<string, EndpointCheckResult>()
const DEFAULT_TTL = 5 * 60 * 1000

function cacheKey(method: HttpMethod, path: string): string {
  return `${method}:${path}`
}

class EndpointCapabilityService {
  private ttl: number

  constructor(ttl: number = DEFAULT_TTL) {
    this.ttl = ttl
  }

  async check(method: HttpMethod, path: string): Promise<boolean> {
    const key = cacheKey(method, path)
    const cached = endpointCache.get(key)
    const now = Date.now()

    if (cached && now - cached.checkedAt < this.ttl) {
      return cached.available
    }

    const client = matrixClientService.getClient()
    if (!client) {
      // 客户端未就绪时不缓存结果，避免后续客户端就绪后仍返回 false
      return false
    }

    try {
      const baseUrl = client.getHomeserverUrl()
      const accessToken = client.getAccessToken()
      const runtimeFetch = getRuntimeAwareFetch()

      // 使用 GET 请求替代 HEAD 请求检测端点可用性
      // HEAD 请求在 Tauri nativeFetch 中不可靠（可能返回空 response 或解析异常）
      // 对好友列表等 GET 端点，直接发 GET 请求并带 limit=0 参数以最小化响应体
      // 对非 GET 端点，使用 OPTIONS 请求
      let response: Response
      if (method === 'GET') {
        const separator = path.includes('?') ? '&' : '?'
        const url = `${baseUrl}${path}${separator}limit=0`
        response = await runtimeFetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        })
      } else {
        const url = `${baseUrl}${path}`
        response = await runtimeFetch(url, {
          method: 'OPTIONS',
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        })
      }

      // 2xx = 可用
      // 405 = 端点存在但方法不允许（仍标记可用）
      // 401/403 = 端点存在但权限问题（仍标记可用）
      // 其他 4xx（如 404）= 端点不存在
      if (response.ok || response.status === 405 || response.status === 401 || response.status === 403) {
        logger.info(`[EndpointCapability] ${method} ${path} 可用 (HTTP ${response.status})`)
        endpointCache.set(key, { available: true, checkedAt: now })
        return true
      }

      if (response.status >= 500) {
        logger.warn(`[EndpointCapability] ${method} ${path} 服务端错误 ${response.status}，不缓存结果`)
        return false
      }

      // 404 和其他 4xx = 端点不可用
      logger.warn(`[EndpointCapability] ${method} ${path} 不可用: Server returned ${response.status} error`)
      endpointCache.set(key, { available: false, checkedAt: now })
      return false
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      logger.warn(`[EndpointCapability] ${method} ${path} 检查失败: ${errMsg}`)
      // 网络错误不缓存，下次重试
      return false
    }
  }

  async checkBatch(endpoints: Array<{ method: HttpMethod; path: string }>): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>()
    await Promise.all(
      endpoints.map(async (ep) => {
        const key = cacheKey(ep.method, ep.path)
        results.set(key, await this.check(ep.method, ep.path))
      })
    )
    return results
  }

  clear(path?: string): void {
    if (path) {
      for (const [key] of endpointCache) {
        if (key.includes(path)) {
          endpointCache.delete(key)
        }
      }
    } else {
      endpointCache.clear()
    }
  }

  getCacheSnapshot(): Map<string, EndpointCheckResult> {
    return new Map(endpointCache)
  }
}

export const endpointCapabilityService = new EndpointCapabilityService()
export default endpointCapabilityService
