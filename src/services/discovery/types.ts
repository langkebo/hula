export interface ServiceInstance {
  id: string
  serviceName: string
  address: string
  port: number
  weight?: number
  metadata?: Record<string, string>
}

export interface DiscoveryOptions {
  serviceName: string
  tags?: string[]
  passingOnly?: boolean
}

export interface Registry {
  name: string
  discover(options: DiscoveryOptions): Promise<ServiceInstance[]>
  // 未来扩展: register, deregister, watch
}

export interface LoadBalancer {
  select(instances: ServiceInstance[], key?: string): ServiceInstance | null
}
