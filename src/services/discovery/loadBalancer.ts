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

export class RandomLoadBalancer implements LoadBalancer {
  select(instances: ServiceInstance[]): ServiceInstance | null {
    if (instances.length === 0) return null
    const index = Math.floor(Math.random() * instances.length)
    return instances[index]
  }
}

export class WeightedLoadBalancer implements LoadBalancer {
  select(instances: ServiceInstance[]): ServiceInstance | null {
    if (instances.length === 0) return null
    const totalWeight = instances.reduce((sum, inst) => sum + (inst.weight ?? 1), 0)
    let random = Math.random() * totalWeight
    for (const instance of instances) {
      random -= instance.weight ?? 1
      if (random <= 0) return instance
    }
    return instances[0]
  }
}
