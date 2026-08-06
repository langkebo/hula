import { HttpClient } from '@/utils/HttpClient'
import { createLogger } from '@/utils/Logger'
import type { DiscoveryOptions, Registry, ServiceInstance } from '../types'

interface ConsulServiceEntry {
  Service: {
    ID: string
    Service: string
    Address: string
    Port: number
    Weights?: {
      Passing: number
    }
    Tags?: string[]
    Meta: Record<string, string>
  }
  Node: {
    Address: string
  }
}

const logger = createLogger('ConsulRegistry')

export class ConsulRegistry implements Registry {
  readonly name = 'consul'

  constructor(private baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  async discover(options: DiscoveryOptions): Promise<ServiceInstance[]> {
    // Consul 支持 ?tag= 参数做服务端过滤。当调用方传入 tags 时，使用第一个
    // tag 做 Consul 查询过滤（Consul API 只支持单 tag 过滤）。其余 tags
    // 由 ServiceDiscoverySDK.resolve() 做客户端二次过滤。
    const params = new URLSearchParams()
    params.set('passing', String(options.passingOnly !== false))
    if (options.tags && options.tags.length > 0) {
      params.set('tag', options.tags[0])
    }

    const url = `${this.baseUrl}/v1/health/service/${options.serviceName}?${params.toString()}`

    try {
      const data = await HttpClient.get<ConsulServiceEntry[]>(url)
      return data.map((entry: ConsulServiceEntry) => ({
        id: entry.Service.ID,
        serviceName: entry.Service.Service,
        address: entry.Service.Address || entry.Node.Address,
        port: entry.Service.Port,
        weight: entry.Service.Weights?.Passing ?? 1,
        tags: entry.Service.Tags ?? [],
        metadata: entry.Service.Meta
      }))
    } catch (error) {
      logger.error(`Failed to discover service ${options.serviceName} from Consul:`, error)
      return []
    }
  }
}
