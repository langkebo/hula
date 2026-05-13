import { info, warn } from '@tauri-apps/plugin-log'
import matrixClientService from './MatrixClientService'

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
      endpointCache.set(key, { available: false, checkedAt: now })
      return false
    }

    try {
      if (method === 'GET') {
        await client.http.authedRequest('HEAD', path)
      } else {
        await client.http.authedRequest('OPTIONS', path)
      }
      info(`[EndpointCapability] ${method} ${path} 可用`)
      endpointCache.set(key, { available: true, checkedAt: now })
      return true
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const error = err as { status?: number; httpStatus?: number }
      const httpStatus = error?.status ?? error?.httpStatus

      if (errMsg.includes('M_NOT_FOUND') || errMsg.includes('404') || errMsg.includes('M_UNRECOGNIZED')) {
        warn(`[EndpointCapability] ${method} ${path} 不可用: ${errMsg}`)
        endpointCache.set(key, { available: false, checkedAt: now })
        return false
      }

      if (httpStatus && httpStatus >= 500 && httpStatus < 600) {
        warn(`[EndpointCapability] ${method} ${path} 服务端错误 ${httpStatus}，不缓存结果`)
        return false
      }

      if (errMsg.includes('405')) {
        warn(`[EndpointCapability] ${method} ${path} 返回 405，标记不可用`)
        endpointCache.set(key, { available: false, checkedAt: now })
        return false
      }

      if (httpStatus === 401 || httpStatus === 403) {
        info(`[EndpointCapability] ${method} ${path} 返回 ${httpStatus}，路径存在但无权限，标记可用`)
        endpointCache.set(key, { available: true, checkedAt: now })
        return true
      }

      if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
        info(`[EndpointCapability] ${method} ${path} 返回 ${httpStatus}，路径存在标记可用`)
        endpointCache.set(key, { available: true, checkedAt: now })
        return true
      }

      endpointCache.set(key, { available: true, checkedAt: now })
      return true
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
