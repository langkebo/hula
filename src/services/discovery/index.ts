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

    // 客户端 tags 二次过滤：ConsulRegistry 已用第一个 tag 做服务端过滤，
    // 但 Registry 实现可能不支持服务端过滤（如 StaticRegistry），所以这里
    // 再做一次客户端过滤，确保返回的实例包含所有请求的 tags。
    // 实例必须包含所有请求的 tags 才算匹配（AND 语义）。
    const filtered = filterByTags(instances, options.tags)

    return this.loadBalancer.select(filtered)
  }

  async resolveUrl(serviceName: string, options: Partial<DiscoveryOptions> = {}): Promise<string | null> {
    const instance = await this.resolve(serviceName, options)
    if (!instance) return null

    const protocol = instance.metadata?.protocol || 'http'
    return `${protocol}://${instance.address}:${instance.port}`
  }
}

/**
 * 客户端 tags 过滤：只保留包含所有请求 tags 的实例。
 * 如果请求 tags 为空或未定义，返回全部实例（无过滤）。
 */
function filterByTags(instances: ServiceInstance[], tags?: string[]): ServiceInstance[] {
  if (!tags || tags.length === 0) return instances
  return instances.filter((instance) => {
    const instanceTags = instance.tags ?? []
    return tags.every((tag) => instanceTags.includes(tag))
  })
}

// 导出单例或工厂
let instance: ServiceDiscoverySDK | null = null

function _initServiceDiscovery(registry: Registry) {
  instance = new ServiceDiscoverySDK(registry)
}

function _getServiceDiscovery(): ServiceDiscoverySDK {
  if (!instance) {
    throw new Error('Service Discovery SDK not initialized')
  }
  return instance
}
