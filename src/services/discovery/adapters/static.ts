import type { DiscoveryOptions, Registry, ServiceInstance } from '../types'

interface StaticConfig {
  [serviceName: string]: ServiceInstance[]
}

export class StaticRegistry implements Registry {
  readonly name = 'static'

  constructor(private config: StaticConfig) {}

  async discover(options: DiscoveryOptions): Promise<ServiceInstance[]> {
    return this.config[options.serviceName] || []
  }
}
