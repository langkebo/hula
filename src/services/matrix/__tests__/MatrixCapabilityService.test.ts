import { warn as logWarn } from '@tauri-apps/plugin-log'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../MatrixClientService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../user/MatrixAccountService', () => ({
  matrixAccountService: { getCapabilities: vi.fn().mockResolvedValue({}) }
}))

vi.mock('../MatrixWorkerHost', () => ({
  matrixWorkerHost: { isStarted: false }
}))

const throwingFetch = vi.fn((): Promise<unknown> => Promise.reject(new Error('network down')))
vi.mock('../network/runtimeFetch', () => ({
  getRuntimeAwareFetch: () => throwingFetch
}))

import { useCapabilityStore } from '@/stores/domains/chat/capability'
import {
  CapabilityUnavailableError,
  matrixCapabilityService,
  registerCapabilityStoreResolver
} from '../MatrixCapabilityService'

describe('MatrixCapabilityService §16.5.3 gates', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    // Register the store resolver so the service can access the store
    // (resets the cached store instance from previous tests)
    registerCapabilityStoreResolver(() => useCapabilityStore())
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
  })

  it('canUseSlidingSync reflects synapse-rust feature flags and compatibility aliases', () => {
    const store = useCapabilityStore()
    expect(matrixCapabilityService.canUseSlidingSync()).toBe(false)

    store.setCapabilities({ unstable_features: { 'org.matrix.msc3886.sliding_sync': true } })
    expect(matrixCapabilityService.canUseSlidingSync()).toBe(true)

    store.setCapabilities({
      unstable_features: { 'org.matrix.msc3575': false, 'org.matrix.simplified_msc3575': true }
    })
    expect(matrixCapabilityService.canUseSlidingSync()).toBe(true)

    store.setCapabilities({
      unstable_features: {},
      capabilities: { 'io.hula.sliding_sync': { enabled: true } }
    })
    expect(matrixCapabilityService.canUseSlidingSync()).toBe(true)
  })

  it('canUseE2EE defaults true and honors explicit disable', () => {
    const store = useCapabilityStore()
    expect(matrixCapabilityService.canUseE2EE()).toBe(true)

    store.setCapabilities({ capabilities: { 'm.room.encryption': { enabled: false } } })
    expect(matrixCapabilityService.canUseE2EE()).toBe(false)
  })

  it('canUseVoip checks synapse-rust voice aliases', () => {
    const store = useCapabilityStore()
    expect(matrixCapabilityService.canUseVoip()).toBe(false)

    store.setCapabilities({ capabilities: { 'm.voice': { enabled: true } } })
    expect(matrixCapabilityService.canUseVoip()).toBe(true)

    store.setCapabilities({
      capabilities: { 'm.voice': { enabled: false }, 'io.hula.voice_extended': { enabled: true } }
    })
    expect(matrixCapabilityService.canUseVoip()).toBe(true)

    store.setCapabilities({
      capabilities: { 'm.voice': { enabled: false }, 'io.hula.voice_extended': { enabled: false } }
    })
    expect(matrixCapabilityService.canUseVoip()).toBe(false)
  })

  it('canUseFriendList / canUseAdminApi recognize hula extensions', () => {
    const store = useCapabilityStore()
    expect(matrixCapabilityService.canUseFriendList()).toBe(false)
    expect(matrixCapabilityService.canUseAdminApi()).toBe(false)

    store.setCapabilities({
      capabilities: { 'io.hula.friends': { enabled: true }, 'io.hula.admin': { enabled: true } }
    })
    expect(matrixCapabilityService.canUseFriendList()).toBe(true)
    expect(matrixCapabilityService.canUseAdminApi()).toBe(true)

    store.setCapabilities({
      capabilities: { 'io.hula.friends': { enabled: false }, 'io.hula.admin': { enabled: false } }
    })
    expect(matrixCapabilityService.canUseFriendList()).toBe(false)
    expect(matrixCapabilityService.canUseAdminApi()).toBe(false)
  })

  it('hasCapability resolves symbolic names', () => {
    const store = useCapabilityStore()
    store.setCapabilities({
      unstable_features: { 'org.matrix.msc3886.sliding_sync': true },
      capabilities: { 'io.hula.admin': true }
    })
    expect(matrixCapabilityService.hasCapability('sliding-sync')).toBe(true)
    expect(matrixCapabilityService.hasCapability('admin-api')).toBe(true)
    expect(matrixCapabilityService.hasCapability('voip')).toBe(false)
    expect(matrixCapabilityService.hasCapability('friend-list')).toBe(false)
  })

  it('canUseThreads recognizes the backend m.thread capability and MSC3983 flags', () => {
    const store = useCapabilityStore()
    expect(matrixCapabilityService.canUseThreads()).toBe(false)

    store.setCapabilities({ capabilities: { 'm.thread': { enabled: true } } })
    expect(matrixCapabilityService.canUseThreads()).toBe(true)

    store.setCapabilities({
      capabilities: { 'm.thread': { enabled: false } },
      unstable_features: { 'org.matrix.msc3983': true }
    })
    expect(matrixCapabilityService.canUseThreads()).toBe(true)
  })

  it('requireCapability throws CapabilityUnavailableError when missing', () => {
    expect(() => matrixCapabilityService.requireCapability('voip')).toThrow(CapabilityUnavailableError)
    try {
      matrixCapabilityService.requireCapability('voip')
    } catch (err) {
      expect(err).toBeInstanceOf(CapabilityUnavailableError)
      if (err instanceof CapabilityUnavailableError) {
        expect(err.capability).toBe('voip')
        expect(err.code).toBe('CAPABILITY_UNAVAILABLE')
      }
    }
  })

  it('requireCapability is a no-op when capability is present', () => {
    const store = useCapabilityStore()
    store.setCapabilities({ capabilities: { 'm.voice': { enabled: true } } })
    expect(() => matrixCapabilityService.requireCapability('voip')).not.toThrow()
  })
})

// FT-131-B: fetchVersions / fetchClientConfig 不能静默吞错，必须记录日志以便排查能力检测失败
describe('FT-131-B: capability fetch error logging', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    registerCapabilityStoreResolver(() => useCapabilityStore())
    vi.clearAllMocks()
    throwingFetch.mockReset()
    throwingFetch.mockImplementation(() => Promise.reject(new Error('network down')))
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
      getHomeserverUrl: () => 'https://matrix.test'
    } as never)
  })

  it('fetchVersions 失败时记录 warn 日志（不再静默吞错）', async () => {
    await matrixCapabilityService.fetchCapabilities()
    expect(logWarn).toHaveBeenCalled()
    const allWarnCalls = vi.mocked(logWarn).mock.calls.map((c) => String(c[0]))
    expect(allWarnCalls.some((msg) => msg.includes('versions') || msg.includes('Versions'))).toBe(true)
  })

  it('fetchClientConfig 失败时记录 warn 日志（不再静默吞错）', async () => {
    await matrixCapabilityService.fetchCapabilities()
    expect(logWarn).toHaveBeenCalled()
    const allWarnCalls = vi.mocked(logWarn).mock.calls.map((c) => String(c[0]))
    expect(allWarnCalls.some((msg) => msg.includes('client_config') || msg.includes('ClientConfig'))).toBe(true)
  })

  it('能力检测整体仍返回降级结果（不因日志而破坏降级）', async () => {
    const result = await matrixCapabilityService.fetchCapabilities()
    expect(result).not.toBeNull()
    expect(result?.unstable_features).toEqual({})
    expect(result?.client_config).toEqual({})
  })
})

// R-16: tryGetStore 不能静默吞错，必须记录日志以便排查 store 解析失败
describe('R-16: error logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 注册一个会抛错的 resolver，使 tryGetStore 进入 catch 分支
    registerCapabilityStoreResolver(() => {
      throw new Error('store unavailable')
    })
  })

  it('logs a warning when tryGetStore throws and returns null', () => {
    const result = matrixCapabilityService.hasCapability('voip')

    expect(result).toBe(false)
    expect(logWarn).toHaveBeenCalled()
    const allWarnCalls = vi.mocked(logWarn).mock.calls.map((c) => String(c[0]))
    expect(allWarnCalls.some((msg) => msg.includes('tryGetStore'))).toBe(true)
  })
})

// Phase 2 ⑥: 并发去重 — fetchCapabilities 并发调用只发一次 HTTP
describe('Phase 2 ⑥: capability 探测并发去重（SingleFlight）', () => {
  let fetchCallCount: number

  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    registerCapabilityStoreResolver(() => useCapabilityStore())
    vi.clearAllMocks()
    fetchCallCount = 0

    // 可计数的 resolved mock fetch
    throwingFetch.mockReset()
    throwingFetch.mockImplementation(() => {
      fetchCallCount++
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ unstable_features: { 'io.hula.friends': true } })
      })
    })

    vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
      getHomeserverUrl: () => 'https://matrix.test'
    } as never)
  })

  it('并发调用 fetchCapabilities 3 次，/versions 只发 1 次 HTTP 请求', async () => {
    const [r1, r2, r3] = await Promise.all([
      matrixCapabilityService.fetchCapabilities(),
      matrixCapabilityService.fetchCapabilities(),
      matrixCapabilityService.fetchCapabilities()
    ])

    // 三个返回值相同（同一 Promise 的结果）
    expect(r1).toBe(r2)
    expect(r2).toBe(r3)

    // fetchVersions + fetchClientConfig 各调用 1 次（共 2 次 fetch）
    // matrixAccountService.getCapabilities 被 mock，不走 fetch
    expect(fetchCallCount).toBe(2)
  })

  it('串行调用 fetchCapabilities 2 次（第一次完成后），每次都发 HTTP（不缓存结果）', async () => {
    await matrixCapabilityService.fetchCapabilities()
    const firstCallCount = fetchCallCount

    await matrixCapabilityService.fetchCapabilities()

    // 第二次调用应重新发请求（in-flight 已清空，不缓存结果）
    expect(fetchCallCount).toBeGreaterThan(firstCallCount)
  })

  it('fetchCapabilities 失败后清空 in-flight，允许重试', async () => {
    // 第一次失败
    throwingFetch.mockImplementationOnce(() => Promise.reject(new Error('timeout')))
    const r1 = await matrixCapabilityService.fetchCapabilities()
    expect(r1).not.toBeNull() // 降级返回空对象，不 throw

    // 第二次应能正常执行（in-flight 已清空）
    throwingFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ unstable_features: { 'io.hula.friends': true } })
      })
    )
    const r2 = await matrixCapabilityService.fetchCapabilities()
    expect(r2?.unstable_features['io.hula.friends']).toBe(true)
  })
})
