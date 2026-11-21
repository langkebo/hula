import { error as logError, warn as logWarn } from '@tauri-apps/plugin-log'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../MatrixClientService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

// E2EE 属客户端能力：服务端不宣告，判定只看 crypto 是否初始化（CAP-08）
const { cryptoContextMock } = vi.hoisted(() => ({
  cryptoContextMock: { isCryptoEnabled: false }
}))

vi.mock('../crypto/MatrixEncryptionContextService', () => ({
  matrixEncryptionContextService: {
    getCurrentSessionContext: () => cryptoContextMock
  }
}))

import { useCapabilityStore } from '@/stores/domains/chat/capability'
import {
  CapabilityUnavailableError,
  HULA_CAPABILITY_ALIASES,
  matrixCapabilityService,
  registerAdminApiAvailabilityResolver,
  registerCapabilityStoreResolver,
  type TjgCapability
} from '../MatrixCapabilityService'
import capabilitySnapshot from './fixtures/capabilities.snapshot.json'

/**
 * CAP-08：真实后端快照（2026-11-19 本地 synapse-rust 原始响应）。
 * 能力位用例的输入 key 一律从「别名表 ∩ 快照」推导，不在测试里手写 key 字面量。
 */
const snapshotUnstable: Record<string, boolean> = {
  ...(capabilitySnapshot.capabilities.unstable_features as Record<string, boolean>),
  ...capabilitySnapshot.versions.unstable_features
}
const snapshotCapabilities = capabilitySnapshot.capabilities.capabilities as Record<string, unknown>

// e2ee / admin-api 不由服务端宣告，单独由客户端状态判定
const serverDeclared = (Object.keys(HULA_CAPABILITY_ALIASES) as TjgCapability[]).filter(
  (capability) => capability !== 'e2ee' && capability !== 'admin-api'
)

/** 取某能力位「服务端真实宣告过」的 key（只看是否出现，不要求值为 true） */
function declaredAliasBits(source: 'unstable' | 'capabilities'): Array<[TjgCapability, string]> {
  const declared = new Set(Object.keys(source === 'unstable' ? snapshotUnstable : snapshotCapabilities))
  return serverDeclared.flatMap((capability) =>
    HULA_CAPABILITY_ALIASES[capability][source]
      .filter((key) => declared.has(key))
      .map((key): [TjgCapability, string] => [capability, key])
  )
}

describe('MatrixCapabilityService §16.5.3 gates', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    // Register the store resolver so the service can access the store
    // (resets the cached store instance from previous tests)
    registerCapabilityStoreResolver(() => useCapabilityStore())
    registerAdminApiAvailabilityResolver(null)
    cryptoContextMock.isCryptoEnabled = false
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

  it('canUseE2EE follows local crypto readiness, not server capabilities', () => {
    const store = useCapabilityStore()
    // 服务端即使宣告 m.room.encryption 也不作为 E2EE 依据
    store.setCapabilities({ capabilities: { 'm.room.encryption': { enabled: true } } })
    expect(matrixCapabilityService.getCapabilityStatus('e2ee')).toBe('unsupported')
    expect(matrixCapabilityService.canUseE2EE()).toBe(false)

    cryptoContextMock.isCryptoEnabled = true
    expect(matrixCapabilityService.getCapabilityStatus('e2ee')).toBe('supported')
    expect(matrixCapabilityService.canUseE2EE()).toBe(true)

    cryptoContextMock.isCryptoEnabled = false
    store.setCapabilities({ unstable_features: { 'org.matrix.msc3814': true } })
    expect(matrixCapabilityService.getCapabilityStatus('e2ee')).toBe('unsupported')
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

  it('canUseFriendList checks hula extension and canUseAdminApi follows the injected resolver', () => {
    const store = useCapabilityStore()
    expect(matrixCapabilityService.canUseFriendList()).toBe(false)
    expect(matrixCapabilityService.canUseAdminApi()).toBe(false)

    store.setCapabilities({ capabilities: { 'io.hula.friends': { enabled: true } } })
    expect(matrixCapabilityService.canUseFriendList()).toBe(true)

    // admin-api 不经 capabilities 面宣告，即使服务端返回 io.hula.admin 也不代表可用
    store.setCapabilities({ capabilities: { 'io.hula.admin': { enabled: true } } })
    expect(matrixCapabilityService.canUseAdminApi()).toBe(false)

    // 由桌面端 admin 桥接层注入的判定结果决定
    registerAdminApiAvailabilityResolver(() => true)
    expect(matrixCapabilityService.canUseAdminApi()).toBe(true)
    expect(matrixCapabilityService.getCapabilityStatus('admin-api')).toBe('supported')

    registerAdminApiAvailabilityResolver(() => false)
    expect(matrixCapabilityService.canUseAdminApi()).toBe(false)
    expect(matrixCapabilityService.getCapabilityStatus('admin-api')).toBe('unsupported')
  })

  it('hasCapability resolves symbolic names', () => {
    const store = useCapabilityStore()
    store.setCapabilities({
      unstable_features: { 'org.matrix.msc3886.sliding_sync': true }
    })
    registerAdminApiAvailabilityResolver(() => true)
    expect(matrixCapabilityService.hasCapability('sliding-sync')).toBe(true)
    expect(matrixCapabilityService.hasCapability('admin-api')).toBe(true)
    expect(matrixCapabilityService.hasCapability('voip')).toBe(false)
    expect(matrixCapabilityService.hasCapability('friend-list')).toBe(false)
  })

  // CAP-01: 三态口径与 14 个能力位（§12.3.1 / §12.3.2）
  describe('CAP-01 能力三态与别名矩阵', () => {
    // CAP-08：输入 key 由「别名表 ∩ 真实快照」推导，别名表或服务端改名时这里立刻红
    const unstableBits = declaredAliasBits('unstable')
    const capabilityBits = declaredAliasBits('capabilities')

    it('reports unknown before the snapshot is loaded', () => {
      expect(matrixCapabilityService.getCapabilityStatus('sticky-events')).toBe('unknown')
      expect(matrixCapabilityService.hasCapability('sticky-events')).toBe(false)
    })

    it('推导出的输入覆盖全部 12 个服务端宣告位', () => {
      const covered = new Set([...unstableBits, ...capabilityBits].map(([capability]) => capability))
      expect([...covered].sort()).toEqual([...serverDeclared].sort())
    })

    it.each(unstableBits)('maps %s to unstable feature %s', (capability, key) => {
      const store = useCapabilityStore()
      expect(matrixCapabilityService.getCapabilityStatus(capability)).toBe('unknown')

      store.setCapabilities({ unstable_features: { [key]: true } })
      expect(matrixCapabilityService.getCapabilityStatus(capability)).toBe('supported')
      expect(matrixCapabilityService.hasCapability(capability)).toBe(true)

      store.setCapabilities({ unstable_features: {}, capabilities: {} })
      expect(matrixCapabilityService.getCapabilityStatus(capability)).toBe('unsupported')
      expect(matrixCapabilityService.hasCapability(capability)).toBe(false)
    })

    it.each(capabilityBits)('maps %s to capability %s', (capability, key) => {
      const store = useCapabilityStore()

      store.setCapabilities({ capabilities: { [key]: { enabled: true } } as never })
      expect(matrixCapabilityService.getCapabilityStatus(capability)).toBe('supported')
      expect(matrixCapabilityService.hasCapability(capability)).toBe(true)

      store.setCapabilities({ unstable_features: {}, capabilities: {} })
      expect(matrixCapabilityService.getCapabilityStatus(capability)).toBe('unsupported')
    })

    it('keeps SDK-compatible sliding sync and voice fallbacks', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ unstable_features: { 'org.matrix.simplified_msc3575': true } })
      expect(matrixCapabilityService.canUseSlidingSync()).toBe(true)

      store.setCapabilities({ unstable_features: {}, capabilities: {} })
      store.setCapabilities({ unstable_features: { 'org.matrix.msc3245.voice': true } })
      expect(matrixCapabilityService.canUseVoip()).toBe(true)
    })

    it('does not treat dehydrated-device as an E2EE signal', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ unstable_features: { 'org.matrix.msc3814': true } })

      expect(matrixCapabilityService.hasCapability('dehydrated-device')).toBe(true)
      expect(matrixCapabilityService.canUseE2EE()).toBe(false)
    })

    // CAP-08: 旧错误 key 不得再命中能力位
    it('rejects the legacy keys that the backend never advertises', () => {
      const store = useCapabilityStore()
      store.setCapabilities({
        unstable_features: {
          'org.matrix.msc4133': true,
          'org.matrix.msc3720': true,
          'org.matrix.msc2666': true,
          'org.matrix.msc3814': true
        },
        capabilities: {
          'm.room.encryption': { enabled: true },
          'io.hula.admin': { enabled: true }
        }
      })

      expect(matrixCapabilityService.getCapabilityStatus('extended-profile')).toBe('unsupported')
      expect(matrixCapabilityService.getCapabilityStatus('account-status')).toBe('unsupported')
      expect(matrixCapabilityService.getCapabilityStatus('mutual-rooms')).toBe('unsupported')
      expect(matrixCapabilityService.getCapabilityStatus('e2ee')).toBe('unsupported')
      expect(matrixCapabilityService.getCapabilityStatus('admin-api')).toBe('unsupported')
    })
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

// FT-131-B: 能力快照探测失败不能静默吞错，必须记录日志以便排查能力检测失败
describe('FT-131-B: capability snapshot error logging', () => {
  const snapshotMock = vi.fn()

  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    registerCapabilityStoreResolver(() => useCapabilityStore())
    vi.clearAllMocks()
    snapshotMock.mockReset()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
      getHomeserverUrl: () => 'https://matrix.test',
      getServerCapabilitiesManager: () => ({ getCapabilitySnapshot: snapshotMock })
    } as never)
  })

  it('快照探测失败时记录 error 日志（不再静默吞错）', async () => {
    snapshotMock.mockRejectedValue(new Error('network down'))

    const result = await matrixCapabilityService.fetchCapabilities()

    expect(result).toBeNull()
    const allErrorCalls = vi.mocked(logError).mock.calls.map((c) => String(c[0]))
    expect(allErrorCalls.some((msg) => msg.includes('Capability snapshot failed'))).toBe(true)
  })

  it('SDK 单端点降级时仍返回可消费的空结构', async () => {
    snapshotMock.mockResolvedValue({ unstableFeatures: {} })

    const result = await matrixCapabilityService.fetchCapabilities()

    expect(result).not.toBeNull()
    expect(result?.unstable_features).toEqual({})
    expect(result?.capabilities).toEqual({})
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

// Phase 2 ⑥: 并发去重 — fetchCapabilities 并发调用只探测一次
describe('Phase 2 ⑥: capability 探测并发去重（SingleFlight）', () => {
  const snapshotMock = vi.fn()

  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    registerCapabilityStoreResolver(() => useCapabilityStore())
    vi.clearAllMocks()

    snapshotMock.mockReset()
    snapshotMock.mockResolvedValue({ unstableFeatures: { 'io.hula.friends': true } })

    vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
      getHomeserverUrl: () => 'https://matrix.test',
      getServerCapabilitiesManager: () => ({ getCapabilitySnapshot: snapshotMock })
    } as never)
  })

  it('并发调用 fetchCapabilities 3 次，只探测 1 次', async () => {
    const [r1, r2, r3] = await Promise.all([
      matrixCapabilityService.fetchCapabilities(),
      matrixCapabilityService.fetchCapabilities(),
      matrixCapabilityService.fetchCapabilities()
    ])

    // 三个返回值相同（同一 Promise 的结果）
    expect(r1).toBe(r2)
    expect(r2).toBe(r3)
    expect(snapshotMock).toHaveBeenCalledTimes(1)
  })

  it('串行调用 fetchCapabilities 2 次（第一次完成后），每次都重新探测（服务层不缓存结果）', async () => {
    await matrixCapabilityService.fetchCapabilities()
    await matrixCapabilityService.fetchCapabilities()

    // 第二次调用应重新探测（in-flight 已清空，不缓存结果）
    expect(snapshotMock).toHaveBeenCalledTimes(2)
  })

  it('fetchCapabilities 失败后清空 in-flight，允许重试', async () => {
    // 第一次失败
    snapshotMock.mockRejectedValueOnce(new Error('timeout'))
    const r1 = await matrixCapabilityService.fetchCapabilities()
    expect(r1).toBeNull()

    // 第二次应能正常执行（in-flight 已清空）
    const r2 = await matrixCapabilityService.fetchCapabilities()
    expect(r2?.unstable_features['io.hula.friends']).toBe(true)
    expect(snapshotMock).toHaveBeenCalledTimes(2)
  })
})

/** capabilities 条目既可能是 boolean，也可能是 `{ enabled }`，与 store 的判定口径一致 */
function isCapabilityEnabled(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (value && typeof value === 'object' && 'enabled' in value) {
    return (value as { enabled?: unknown }).enabled === true
  }
  return false
}

/**
 * CAP-08：真值表改由真实后端快照驱动。
 *
 * 快照来源：2026-11-19 对本地 synapse-rust 实例的 `GET /_matrix/client/versions` 与
 * `GET /_matrix/client/v3/capabilities` 原始响应（fixtures/capabilities.snapshot.json）。
 * 此前每个能力位都在本文件手写 key 字面量，服务端 key 改名（msc4133 / msc2666 等）时
 * 测试仍会全绿；改为快照输入后，key 漂移会直接反映到断言结果。
 */
describe('CAP-08 真实后端快照驱动的能力真值表', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    registerCapabilityStoreResolver(() => useCapabilityStore())
    registerAdminApiAvailabilityResolver(null)
    cryptoContextMock.isCryptoEnabled = false
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    useCapabilityStore().setCapabilities({
      unstable_features: snapshotUnstable,
      capabilities: snapshotCapabilities
    })
  })

  it('快照覆盖 12 个服务端宣告位，逐位按真实 key 推导命中结果', () => {
    expect(serverDeclared).toHaveLength(12)

    for (const capability of serverDeclared) {
      const aliases = HULA_CAPABILITY_ALIASES[capability]
      const supported =
        aliases.unstable.some((key) => snapshotUnstable[key] === true) ||
        aliases.capabilities.some((key) => isCapabilityEnabled(snapshotCapabilities[key]))
      expect(matrixCapabilityService.getCapabilityStatus(capability), `${capability} 的命中结果与快照不一致`).toBe(
        supported ? 'supported' : 'unsupported'
      )
      expect(matrixCapabilityService.hasCapability(capability)).toBe(supported)
    }
  })

  it('真实快照下 11 位 supported，account-status 因 enabled=false 为 unsupported', () => {
    const statuses = Object.fromEntries(
      serverDeclared.map((capability) => [capability, matrixCapabilityService.getCapabilityStatus(capability)])
    )

    expect(statuses).toEqual({
      'sliding-sync': 'supported',
      voip: 'supported',
      'friend-list': 'supported',
      'burn-after-read': 'supported',
      'dehydrated-device': 'supported',
      'sticky-events': 'supported',
      'scheduled-send': 'supported',
      'rtc-transports': 'supported',
      'account-status': 'unsupported',
      'extended-profile': 'supported',
      'qr-rendezvous': 'supported',
      'mutual-rooms': 'supported'
    })
  })

  it('快照包含四处曾写错的真实 key，且不含旧错误 key', () => {
    // 曾写错并修复的四个 key（CAP-08 回归锚点）
    expect(snapshotUnstable['uk.tcpip.msc4133']).toBe(true)
    expect(snapshotUnstable['uk.half-shot.msc2666.query_mutual_rooms']).toBe(true)
    expect(snapshotUnstable['org.matrix.msc3814']).toBe(true)
    expect(snapshotCapabilities['org.matrix.msc3720.account_status']).toBeDefined()

    // 旧错误 key 不得出现在真实快照里，否则说明别名表又在兼容不存在的形态
    expect(snapshotUnstable['org.matrix.msc4133']).toBeUndefined()
    expect(snapshotUnstable['org.matrix.msc2666']).toBeUndefined()
    expect(snapshotCapabilities['org.matrix.msc3720']).toBeUndefined()
  })

  it('仅声明旧错误 key 时不命中（防止别名回退）', () => {
    useCapabilityStore().setCapabilities({
      unstable_features: {
        'org.matrix.msc4133': true,
        'org.matrix.msc2666': true
      },
      capabilities: {
        'm.room.encryption': { enabled: true },
        'org.matrix.msc3720': { enabled: true }
      }
    })

    expect(matrixCapabilityService.getCapabilityStatus('extended-profile')).toBe('unsupported')
    expect(matrixCapabilityService.getCapabilityStatus('mutual-rooms')).toBe('unsupported')
    expect(matrixCapabilityService.getCapabilityStatus('account-status')).toBe('unsupported')
    expect(matrixCapabilityService.getCapabilityStatus('e2ee')).toBe('unsupported')
  })

  it('真实快照不含 m.room.encryption，e2ee 与 admin-api 仍由客户端状态判定', () => {
    expect(snapshotCapabilities['m.room.encryption']).toBeUndefined()
    expect(matrixCapabilityService.getCapabilityStatus('e2ee')).toBe('unsupported')
    expect(matrixCapabilityService.getCapabilityStatus('admin-api')).toBe('unsupported')

    cryptoContextMock.isCryptoEnabled = true
    registerAdminApiAvailabilityResolver(() => true)
    expect(matrixCapabilityService.getCapabilityStatus('e2ee')).toBe('supported')
    expect(matrixCapabilityService.getCapabilityStatus('admin-api')).toBe('supported')
  })
})
