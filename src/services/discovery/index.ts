import { RoundRobinLoadBalancer } from './loadBalancer'
import type { DiscoveryOptions, LoadBalancer, Registry, ServiceInstance } from './types'

export class ServiceDiscoverySDK {
  private registry: Registry
  private loadBalancer: LoadBalancer

  constructor(registry: Registry, loadBalancer: LoadBalancer = new RoundRobinLoadBalancer()) {
    this.registry = registry
    this.loadBalancer = loadBalancer
  }

  async resolve(serviceName: string, options: Partial<DiscoveryOptions> = {}): Promise<ServiceInstance | null> {
    const instances = await this.registry.discover({
      serviceName,
      ...options
    })

    return this.loadBalancer.select(instances)
  }

  async resolveUrl(serviceName: string, options: Partial<DiscoveryOptions> = {}): Promise<string | null> {
    const instance = await this.resolve(serviceName, options)
    if (!instance) return null

    const protocol = instance.metadata?.protocol || 'http'
    return `${protocol}://${instance.address}:${instance.port}`
  }
}

// 导出单例或工厂
let instance: ServiceDiscoverySDK | null = null

export function initServiceDiscovery(registry: Registry) {
  instance = new ServiceDiscoverySDK(registry)
}

export function getServiceDiscovery(): ServiceDiscoverySDK {
  if (!instance) {
    throw new Error('Service Discovery SDK not initialized')
  }
  return instance
}
