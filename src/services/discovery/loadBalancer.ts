import type { LoadBalancer, ServiceInstance } from './types'

export class RoundRobinLoadBalancer implements LoadBalancer {
  private currentIndex = 0

  select(instances: ServiceInstance[]): ServiceInstance | null {
    if (instances.length === 0) return null
    const instance = instances[this.currentIndex % instances.length]
    this.currentIndex = (this.currentIndex + 1) % instances.length
    return instance
  }
}
