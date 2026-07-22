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
    const url = `${this.baseUrl}/v1/health/service/${options.serviceName}?passing=${options.passingOnly !== false}`

    try {
      const data = await HttpClient.get<ConsulServiceEntry[]>(url)
      return data.map((entry: ConsulServiceEntry) => ({
        id: entry.Service.ID,
        serviceName: entry.Service.Service,
        address: entry.Service.Address || entry.Node.Address,
        port: entry.Service.Port,
        weight: entry.Service.Weights?.Passing ?? 1,
        metadata: entry.Service.Meta
      }))
    } catch (error) {
      logger.error(`Failed to discover service ${options.serviceName} from Consul:`, error)
      return []
    }
  }
}
