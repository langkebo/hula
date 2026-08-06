import { describe, expect, it } from 'vitest'
import { ServiceDiscoverySDK } from '../index'
import { RoundRobinLoadBalancer } from '../loadBalancer'
import type { Registry, ServiceInstance } from '../types'

/** 构造内存 Registry，便于控制返回的实例集合 */
class FakeRegistry implements Registry {
  readonly name = 'fake'
  constructor(private instances: ServiceInstance[]) {}
  async discover(): Promise<ServiceInstance[]> {
    return this.instances
  }
}

const instances: ServiceInstance[] = [
  { id: 'a', serviceName: 'matrix-homeserver', address: '10.0.0.1', port: 8008, tags: ['matrix.example.com'] },
  { id: 'b', serviceName: 'matrix-homeserver', address: '10.0.0.2', port: 8008, tags: ['matrix.other.com'] },
  { id: 'c', serviceName: 'matrix-homeserver', address: '10.0.0.3', port: 8008, tags: ['matrix.example.com', 'v2'] }
]

describe('ServiceDiscoverySDK tags filtering', () => {
  it('returns null when no instances match the requested tag', async () => {
    const sdk = new ServiceDiscoverySDK(new FakeRegistry(instances), new RoundRobinLoadBalancer())
    const result = await sdk.resolve('matrix-homeserver', { tags: ['nonexistent.com'] })
    expect(result).toBeNull()
  })

  it('filters instances by tag and selects via load balancer', async () => {
    const sdk = new ServiceDiscoverySDK(new FakeRegistry(instances), new RoundRobinLoadBalancer())
    const result = await sdk.resolve('matrix-homeserver', { tags: ['matrix.other.com'] })
    expect(result?.id).toBe('b')
  })

  it('uses AND semantics: instance must contain all requested tags', async () => {
    const sdk = new ServiceDiscoverySDK(new FakeRegistry(instances), new RoundRobinLoadBalancer())
    const result = await sdk.resolve('matrix-homeserver', { tags: ['matrix.example.com', 'v2'] })
    expect(result?.id).toBe('c')
  })

  it('returns any matching instance when multiple match (round-robin)', async () => {
    const sdk = new ServiceDiscoverySDK(new FakeRegistry(instances), new RoundRobinLoadBalancer())
    // matrix.example.com matches instances a and c — round-robin should cycle
    const first = await sdk.resolve('matrix-homeserver', { tags: ['matrix.example.com'] })
    const second = await sdk.resolve('matrix-homeserver', { tags: ['matrix.example.com'] })
    const ids = new Set([first?.id, second?.id])
    expect(ids.has('a')).toBe(true)
    expect(ids.has('c')).toBe(true)
  })

  it('skips SDK filtering when no tags are provided', async () => {
    const sdk = new ServiceDiscoverySDK(new FakeRegistry(instances), new RoundRobinLoadBalancer())
    const result = await sdk.resolve('matrix-homeserver')
    expect(result).not.toBeNull()
  })

  it('treats instances without tags field as non-matching when tags are requested', async () => {
    const noTagInstances: ServiceInstance[] = [
      { id: 'x', serviceName: 'matrix-homeserver', address: '10.0.0.9', port: 8008 }
    ]
    const sdk = new ServiceDiscoverySDK(new FakeRegistry(noTagInstances), new RoundRobinLoadBalancer())
    const result = await sdk.resolve('matrix-homeserver', { tags: ['anything'] })
    expect(result).toBeNull()
  })
})
