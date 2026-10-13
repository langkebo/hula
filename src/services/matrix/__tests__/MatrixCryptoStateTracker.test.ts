import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getOrCreateCryptoStorageKey } from '@/services/secure/cryptoStorageKey'
import { MatrixCryptoStateTracker } from '../MatrixCryptoStateTracker'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/services/secure/cryptoStorageKey', () => ({
  getOrCreateCryptoStorageKey: vi.fn().mockResolvedValue(null),
  deleteCryptoStorageKey: vi.fn().mockResolvedValue(undefined),
  // 密钥存放后端的日志（本文件不关心其内容，但 mock 必须与模块导出同形）
  logCryptoStorageKeyBackend: vi.fn().mockResolvedValue(undefined)
}))

/**
 * H1 回归测试：同一用户换设备登录时，ensureCrypto 必须触发主动清理。
 *
 * 原 BUG：localStorage 仅存储 userId，同一用户换设备登录时
 * lastCryptoUser === userId 为 true，主动清理未触发，
 * 导致 initRustCrypto 报 "account in the store doesn't match" 错误，
 * 登录耗时 51s（crypto 重试循环 + 超时等待）。
 *
 * 修复：localStorage 改为存储 userId:deviceId，换设备时触发清理。
 */
describe('MatrixCryptoStateTracker - ADR-005 H1 回归', () => {
  let tracker: MatrixCryptoStateTracker
  let deleteDbMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    tracker = new MatrixCryptoStateTracker()

    // happy-dom 不提供 IndexedDB，手动 mock
    // deleteDatabase 返回的 IDBOpenDBRequest 需要支持 onsuccess/onerror/onblocked 回调
    deleteDbMock = vi.fn().mockImplementation(() => {
      const req = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onblocked: null as (() => void) | null
      }
      // 模拟异步删除成功，在下一 tick 触发 onsuccess
      setTimeout(() => req.onsuccess?.(), 0)
      return req
    })
    Object.defineProperty(globalThis, 'indexedDB', {
      value: {
        deleteDatabase: deleteDbMock,
        databases: vi.fn().mockResolvedValue([])
      },
      configurable: true,
      writable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  /** 创建 mock MatrixClient */
  function createMockClient(userId: string, deviceId: string) {
    return {
      getUserId: vi.fn().mockReturnValue(userId),
      getDeviceId: vi.fn().mockReturnValue(deviceId),
      getCrypto: vi.fn().mockReturnValue(null),
      initRustCrypto: vi.fn().mockResolvedValue(undefined)
    } as unknown as Parameters<MatrixCryptoStateTracker['ensureCrypto']>[0]
  }

  it('同用户换设备登录时必须触发主动清理（H1 核心修复）', async () => {
    // 第一次登录：user@test.com / device-A
    const clientA = createMockClient('@user:test.com', 'device-A')
    await tracker.ensureCrypto(clientA, true)

    // 验证 localStorage 存储了 userId:deviceId
    const stored = localStorage.getItem('tjg.lastCryptoUserId')
    expect(stored).toBe('@user:test.com:device-A')

    deleteDbMock.mockClear()

    // 第二次登录：同一用户 / device-B（换设备）
    const clientB = createMockClient('@user:test.com', 'device-B')
    await tracker.ensureCrypto(clientB, true)

    // 验证主动清理被触发（deleteDatabase 被调用）
    expect(deleteDbMock).toHaveBeenCalled()

    // 验证 localStorage 更新为新 deviceId
    expect(localStorage.getItem('tjg.lastCryptoUserId')).toBe('@user:test.com:device-B')
  })

  it('同用户同设备重启时不应触发清理', async () => {
    // 第一次登录
    const client = createMockClient('@user:test.com', 'device-A')
    await tracker.ensureCrypto(client, true)

    deleteDbMock.mockClear()

    // 同设备重启
    await tracker.ensureCrypto(client, true)

    // 验证主动清理未触发
    expect(deleteDbMock).not.toHaveBeenCalled()
  })

  it('换用户登录必须触发清理', async () => {
    const clientA = createMockClient('@userA:test.com', 'device-A')
    await tracker.ensureCrypto(clientA, true)

    deleteDbMock.mockClear()

    const clientB = createMockClient('@userB:test.com', 'device-B')
    await tracker.ensureCrypto(clientB, true)

    expect(deleteDbMock).toHaveBeenCalled()
  })

  it('首次登录（无 localStorage 记录）必须触发清理', async () => {
    const client = createMockClient('@user:test.com', 'device-A')
    await tracker.ensureCrypto(client, true)

    expect(deleteDbMock).toHaveBeenCalled()
  })

  it('旧版本 localStorage（仅 userId 无冒号）必须触发清理（向后兼容）', async () => {
    // 模拟旧版本存储的值（仅 userId，无 deviceId）
    localStorage.setItem('tjg.lastCryptoUserId', '@user:test.com')

    const client = createMockClient('@user:test.com', 'device-A')
    await tracker.ensureCrypto(client, true)

    // 旧格式应触发清理
    expect(deleteDbMock).toHaveBeenCalled()
  })

  it('clearCryptoStoreForLogout 必须清除 localStorage 记录', async () => {
    // 先设置 localStorage
    localStorage.setItem('tjg.lastCryptoUserId', '@user:test.com:device-A')

    await tracker.clearCryptoStoreForLogout('@user:test.com')

    // 验证 localStorage 被清除
    expect(localStorage.getItem('tjg.lastCryptoUserId')).toBeNull()
  })
})

/**
 * 修复回归测试：initRustCrypto 失败时无条件清理重试
 *
 * 原 BUG：catch 块用 `String(err)` 处理错误，但 WASM 抛出的是空对象 `{}`，
 * `String({})` = "[object Object]" 不匹配 "account mismatch" 字符串，
 * 导致清理重试逻辑被完全跳过，每次登录都降级为非加密模式。
 *
 * 修复：
 *   - 使用 normalizeCryptoError 归一化错误对象
 *   - initRustCrypto 失败且 IndexedDB 可用时无条件清理旧 store 后重试
 */
describe('MatrixCryptoStateTracker - initRustCrypto 失败清理重试', () => {
  let tracker: MatrixCryptoStateTracker
  let deleteDbMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    tracker = new MatrixCryptoStateTracker()

    deleteDbMock = vi.fn().mockImplementation(() => {
      const req = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onblocked: null as (() => void) | null
      }
      setTimeout(() => req.onsuccess?.(), 0)
      return req
    })
    Object.defineProperty(globalThis, 'indexedDB', {
      value: {
        deleteDatabase: deleteDbMock,
        databases: vi.fn().mockResolvedValue([])
      },
      configurable: true,
      writable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  function createMockClient(userId: string, deviceId: string, initImpl: ReturnType<typeof vi.fn>) {
    return {
      getUserId: vi.fn().mockReturnValue(userId),
      getDeviceId: vi.fn().mockReturnValue(deviceId),
      getCrypto: vi.fn().mockReturnValue(null),
      initRustCrypto: initImpl
    } as unknown as Parameters<MatrixCryptoStateTracker['ensureCrypto']>[0]
  }

  it('initRustCrypto 抛 Error 时清理重试成功后应初始化为加密模式', async () => {
    const initMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("account in the store doesn't match"))
      .mockResolvedValueOnce(undefined)

    const client = createMockClient('@user:test.com', 'device-A', initMock)
    await tracker.ensureCrypto(client, true)

    // 第一次失败 + 第二次成功 → 共调用 2 次
    expect(initMock).toHaveBeenCalledTimes(2)
    // 清理 IndexedDB 被触发
    expect(deleteDbMock).toHaveBeenCalled()
    // 最终状态：初始化成功
    const state = tracker.getRustCryptoDebugState()
    expect(state.attempted).toBe(true)
    expect(state.initialized).toBe(true)
    expect(state.error).toBeNull()
  })

  it('initRustCrypto 抛空对象 {} 时也必须触发清理重试', async () => {
    // 这是核心回归点：WASM 抛出空对象 {}，String({}) = "[object Object]"
    // 原代码不匹配 "account mismatch" → 重试被跳过
    const initMock = vi.fn().mockRejectedValueOnce({}).mockResolvedValueOnce(undefined)

    const client = createMockClient('@user:test.com', 'device-A', initMock)
    await tracker.ensureCrypto(client, true)

    expect(initMock).toHaveBeenCalledTimes(2)
    expect(deleteDbMock).toHaveBeenCalled()
    const state = tracker.getRustCryptoDebugState()
    expect(state.initialized).toBe(true)
  })

  it('重试仍失败时应降级为非加密模式', async () => {
    const initMock = vi.fn().mockRejectedValue(new Error('persistent failure'))

    const client = createMockClient('@user:test.com', 'device-A', initMock)
    await tracker.ensureCrypto(client, true)

    expect(initMock).toHaveBeenCalledTimes(2)
    expect(deleteDbMock).toHaveBeenCalled()
    const state = tracker.getRustCryptoDebugState()
    expect(state.initialized).toBe(false)
    expect(state.error).toBe('persistent failure')
  })

  it('重试仍失败时错误为空对象 {} 应归一化为可读字符串', async () => {
    const initMock = vi.fn().mockRejectedValue({})

    const client = createMockClient('@user:test.com', 'device-A', initMock)
    await tracker.ensureCrypto(client, true)

    const state = tracker.getRustCryptoDebugState()
    expect(state.initialized).toBe(false)
    // 空对象 {} 应归一化为 [empty-object]，而非 [object Object]
    expect(state.error).toBe('[empty-object]')
  })
})

/**
 * storageKey 加密原语 + 可观测性回归（2026-10-12）
 *
 * 背景：
 *   1. SDK 的 `initRustCrypto` 提供 `storageKey`（32 字节原始密钥）与
 *      `storagePassword`（口令 → **故意慢**的 KDF）两条互斥路径；JSDoc 明确
 *      "prefer to pass a `storageKey` directly where possible"。
 *      本仓原先传的是**随机 32 字节**的 base64 当作 password ⇒ 白付一次 KDF。
 *   2. keychain 不可用时 store 会**不加密**，而 SDK 只拒绝"未加密的**内存** store"，
 *      不拒绝"未加密的 IndexedDB store" ⇒ 必须显式暴露为可观测状态，不能静默。
 *   3. 加密原语不同 ⇒ 实际加密密钥不同。仅比较"是否加密"发现不了原语切换，
 *      会把"换了密钥却继续打开旧 store"推迟到 initRustCrypto 失败才发现。
 */
describe('MatrixCryptoStateTracker - storageKey 原语与加密状态可观测性', () => {
  let tracker: MatrixCryptoStateTracker
  let deleteDbMock: ReturnType<typeof vi.fn>
  const getOrCreateCryptoStorageKeyMock = vi.mocked(getOrCreateCryptoStorageKey)

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    tracker = new MatrixCryptoStateTracker()
    getOrCreateCryptoStorageKeyMock.mockResolvedValue(null)

    deleteDbMock = vi.fn().mockImplementation(() => {
      const req = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onblocked: null as (() => void) | null
      }
      setTimeout(() => req.onsuccess?.(), 0)
      return req
    })
    Object.defineProperty(globalThis, 'indexedDB', {
      value: { deleteDatabase: deleteDbMock, databases: vi.fn().mockResolvedValue([]) },
      configurable: true,
      writable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  function createMockClient(userId: string, deviceId: string) {
    const initRustCrypto = vi.fn().mockResolvedValue(undefined)
    return {
      client: {
        getUserId: vi.fn().mockReturnValue(userId),
        getDeviceId: vi.fn().mockReturnValue(deviceId),
        getCrypto: vi.fn().mockReturnValue(null),
        initRustCrypto
      } as unknown as Parameters<MatrixCryptoStateTracker['ensureCrypto']>[0],
      initRustCrypto
    }
  }

  it('keychain 有密钥时以 32 字节 storageKey 初始化，且不得再传 storagePassword', async () => {
    const key = new Uint8Array(32).fill(7)
    getOrCreateCryptoStorageKeyMock.mockResolvedValue(key)
    const { client, initRustCrypto } = createMockClient('@user:test.com', 'device-A')

    await tracker.ensureCrypto(client, true)

    expect(initRustCrypto).toHaveBeenCalledTimes(1)
    const args = initRustCrypto.mock.calls[0][0] as Record<string, unknown>
    expect(args.storageKey).toBe(key)
    expect(args).not.toHaveProperty('storagePassword')
    expect(tracker.getRustCryptoDebugState().storeEncrypted).toBe(true)
  })

  it('keychain 无密钥时不得传 storageKey，并把 storeEncrypted 标为 false（可见降级）', async () => {
    getOrCreateCryptoStorageKeyMock.mockResolvedValue(null)
    const { client, initRustCrypto } = createMockClient('@user:test.com', 'device-A')

    await tracker.ensureCrypto(client, true)

    const args = initRustCrypto.mock.calls[0][0] as Record<string, unknown>
    expect(args).toEqual({ useIndexedDB: true })
    expect(args).not.toHaveProperty('storageKey')
    expect(tracker.getRustCryptoDebugState().storeEncrypted).toBe(false)
  })

  it('原语标记写入 localStorage：有密钥 → k1，无密钥 → 0', async () => {
    getOrCreateCryptoStorageKeyMock.mockResolvedValue(new Uint8Array(32))
    const withKey = createMockClient('@user:test.com', 'device-A')
    await tracker.ensureCrypto(withKey.client, true)
    expect(localStorage.getItem('tjg.lastCryptoEncrypted')).toBe('k1')

    getOrCreateCryptoStorageKeyMock.mockResolvedValue(null)
    const withoutKey = createMockClient('@user:test.com', 'device-B')
    await tracker.ensureCrypto(withoutKey.client, true)
    expect(localStorage.getItem('tjg.lastCryptoEncrypted')).toBe('0')
  })

  it('历史标记（storagePassword 时代的 "1"）必须触发提前清理，且一次初始化即成功', async () => {
    // 模拟：上一版用 storagePassword，标记为 '1'；本次改用 storageKey（'k1'）
    localStorage.setItem('tjg.lastCryptoUserId', '@user:test.com:device-A')
    localStorage.setItem('tjg.lastCryptoEncrypted', '1')
    getOrCreateCryptoStorageKeyMock.mockResolvedValue(new Uint8Array(32).fill(1))
    const { client, initRustCrypto } = createMockClient('@user:test.com', 'device-A')

    await tracker.ensureCrypto(client, true)

    // 提前清理：不必经历"initRustCrypto 失败 → 清理 → 重试"
    expect(deleteDbMock).toHaveBeenCalled()
    expect(initRustCrypto).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('tjg.lastCryptoEncrypted')).toBe('k1')
  })

  it('原语未变化时不触发清理', async () => {
    localStorage.setItem('tjg.lastCryptoUserId', '@user:test.com:device-A')
    localStorage.setItem('tjg.lastCryptoEncrypted', 'k1')
    getOrCreateCryptoStorageKeyMock.mockResolvedValue(new Uint8Array(32))
    const { client } = createMockClient('@user:test.com', 'device-A')

    await tracker.ensureCrypto(client, true)

    expect(deleteDbMock).not.toHaveBeenCalled()
  })
})

/**
 * 跨窗口语义（2026-10-13 取证后订正，报告见仓库外
 * OPS_ARTIFACTS/TJG_multi_window_crypto_store_forensics_2026-10-13.md）。
 *
 * Tauri 每个 WebView 有独立 JS 上下文，但同源 IndexedDB 共享同一组 crypto DB。
 * 结论：**每个窗口都必须有自己的 OlmMachine**，跨窗口只由 Web Locks **串行化** ——
 * 「其他窗口已完成 ⇒ 本窗口跳过」既不可达也不可能实现（本窗口 client 的 getCrypto()
 * 看不到别窗口的 crypto）。原 BroadcastChannel 协调 + 锁内复查分支已删除。
 * 本组测试锁住这两条语义，防止回退。
 */
describe('MatrixCryptoStateTracker - 跨窗口语义（无跳过，仅串行化）', () => {
  let tracker: MatrixCryptoStateTracker

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    tracker = new MatrixCryptoStateTracker()
    vi.mocked(getOrCreateCryptoStorageKey).mockResolvedValue(null)
    Object.defineProperty(globalThis, 'indexedDB', {
      value: {
        deleteDatabase: vi.fn().mockImplementation(() => {
          const req = {
            onsuccess: null as (() => void) | null,
            onerror: null as (() => void) | null,
            onblocked: null as (() => void) | null
          }
          setTimeout(() => req.onsuccess?.(), 0)
          return req
        }),
        databases: vi.fn().mockResolvedValue([])
      },
      configurable: true,
      writable: true
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete (globalThis.navigator as { locks?: unknown }).locks
    localStorage.clear()
  })

  /** mock client：initRustCrypto 被调用后 getCrypto 变为可用（贴近真实 SDK 行为） */
  function createClient(userId: string, deviceId: string) {
    let cryptoAvailable: unknown = null
    const initRustCrypto = vi.fn().mockImplementation(async () => {
      cryptoAvailable = { ready: true }
    })
    const client = {
      getUserId: vi.fn().mockReturnValue(userId),
      getDeviceId: vi.fn().mockReturnValue(deviceId),
      getCrypto: vi.fn().mockImplementation(() => cryptoAvailable),
      initRustCrypto
    } as unknown as Parameters<MatrixCryptoStateTracker['ensureCrypto']>[0]
    return { client, initRustCrypto }
  }

  it('不得因其他窗口的完成广播而跳过初始化（跨窗口跳过语义已删除）', async () => {
    const posted: unknown[] = []
    class FakeBroadcastChannel {
      onmessage: ((event: MessageEvent) => void) | null = null
      constructor(public readonly name: string) {
        posted.push(`open:${name}`)
      }
      postMessage(data: unknown): void {
        posted.push(data)
      }
      close(): void {}
    }
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)

    const { client, initRustCrypto } = createClient('@user:test.com', 'device-A')
    await tracker.ensureCrypto(client, true)

    // 本窗口必须真的初始化自己的 OlmMachine
    expect(initRustCrypto).toHaveBeenCalledTimes(1)
    const state = tracker.getRustCryptoDebugState()
    expect(state.initialized).toBe(true)
    expect(state.skippedReason).not.toBe('crypto-initialized-by-other-window')
    // 且不再有任何跨窗口广播（旧机制被整体删除）
    expect(posted).toEqual([])
  })

  it('不得再有固定 1s 跨窗口探测延迟（旧实现每次初始化都白等 1s）', async () => {
    vi.useFakeTimers()
    const { client, initRustCrypto } = createClient('@user:test.com', 'device-B')

    const pending = tracker.ensureCrypto(client, true)
    // 只推进 10ms：旧实现会在这里白等 1000ms 的「crypto-init-done」探测，
    // 因而 initRustCrypto 尚未被调用 —— 本断言即该缺陷的探针。
    await vi.advanceTimersByTimeAsync(10)

    expect(initRustCrypto).toHaveBeenCalledTimes(1)
    await pending
  })

  it('跨窗口串行化仍由 Web Locks 承担（tjg-ensure-crypto / exclusive）', async () => {
    const requests: Array<{ name: string; mode: string }> = []
    Object.defineProperty(globalThis.navigator, 'locks', {
      value: {
        request: async (name: string, options: { mode?: string }, callback: () => Promise<void>) => {
          requests.push({ name, mode: options?.mode ?? '' })
          return await callback()
        }
      },
      configurable: true,
      writable: true
    })

    const { client, initRustCrypto } = createClient('@user:test.com', 'device-C')
    await tracker.ensureCrypto(client, true)

    expect(requests).toEqual([{ name: 'tjg-ensure-crypto', mode: 'exclusive' }])
    expect(initRustCrypto).toHaveBeenCalledTimes(1)
  })

  it('本 client crypto 已可用时不得重复初始化（唯一真实护栏）', async () => {
    const { client, initRustCrypto } = createClient('@user:test.com', 'device-D')
    // 先初始化一次，使该 client 的 getCrypto() 可用
    await tracker.ensureCrypto(client, true)
    expect(initRustCrypto).toHaveBeenCalledTimes(1)

    // 第二次调用必须走 getCrypto() 早退，而不是再 init 一次
    await tracker.ensureCrypto(client, true)

    expect(initRustCrypto).toHaveBeenCalledTimes(1)
    expect(tracker.getRustCryptoDebugState().skippedReason).toBe('crypto-already-available')
  })

  it('同一 client 连续两次调用只初始化一次（锁定早退语义，不依赖锁内复查）', async () => {
    const { client, initRustCrypto } = createClient('@user:test.com', 'device-E')

    await tracker.ensureCrypto(client, true)
    await tracker.ensureCrypto(client, true)

    expect(initRustCrypto).toHaveBeenCalledTimes(1)
  })
})

/**
 * `releaseStoppedCryptoBinding` —— 复用同一 client 重启 sync 的前置条件。
 *
 * SDK 契约（fork 40.2.0-langkebo.6）：stopClient() 会 cryptoBackend.stop() →
 * olmMachine.close()（IndexedDB 连接关闭），但不清空 client.cryptoBackend；
 * initRustCrypto() 见 cryptoBackend 非空即 warn+return ⇒ 必须先解除绑定。
 */
describe('MatrixCryptoStateTracker - 解除已停止的 crypto 绑定（重启前置）', () => {
  let tracker: MatrixCryptoStateTracker

  beforeEach(() => {
    vi.clearAllMocks()
    tracker = new MatrixCryptoStateTracker()
  })

  /**
   * 构造最小 client。**必须让 getCrypto() 读自身字段**（真实 SDK 就是 `return this.cryptoBackend`）——
   * 闭包捕获入参会让"解除绑定"看起来无效，从而测不出真实语义。
   */
  function makeClient(cryptoBackend: unknown) {
    const client = { cryptoBackend, getCrypto: (): unknown => client.cryptoBackend }
    return client
  }

  /** 仅用于传参：测试替身与真实 MatrixClient 结构不同，需显式收窄 */
  function asTrackerClient(client: ReturnType<typeof makeClient>) {
    return client as unknown as Parameters<MatrixCryptoStateTracker['releaseStoppedCryptoBinding']>[0]
  }

  it('crypto 已停止（stopped=true）⇒ 解除绑定，getCrypto() 变为 undefined', () => {
    const client = makeClient({ stopped: true })

    expect(tracker.releaseStoppedCryptoBinding(asTrackerClient(client))).toBe(true)
    expect(client.getCrypto()).toBeUndefined()
  })

  it('crypto 仍在运行（stopped=false）⇒ 拒绝解除并告警（否则泄漏 OlmMachine/连接）', () => {
    const live = { stopped: false }
    const client = makeClient(live)

    expect(tracker.releaseStoppedCryptoBinding(asTrackerClient(client))).toBe(false)
    expect(client.getCrypto()).toBe(live)
  })

  it('未初始化 crypto ⇒ 幂等返回 false，不抛错', () => {
    const client = makeClient(undefined)
    expect(tracker.releaseStoppedCryptoBinding(asTrackerClient(client))).toBe(false)
  })

  it('client 为 null ⇒ 返回 false', () => {
    expect(tracker.releaseStoppedCryptoBinding(null)).toBe(false)
  })

  it('解除后再 ensureCrypto 必须真的重新 initRustCrypto（回归：否则 E2EE 永久静默失效）', async () => {
    const fake: {
      cryptoBackend: unknown
      getUserId: () => string
      getDeviceId: () => string
      getCrypto: () => unknown
      initRustCrypto: ReturnType<typeof vi.fn>
    } = {
      cryptoBackend: { stopped: true },
      getUserId: () => '@user:test.com',
      getDeviceId: () => 'device-F',
      getCrypto: () => fake.cryptoBackend,
      // 模拟 SDK：initRustCrypto 成功后把新 backend 挂到 client 上
      initRustCrypto: vi.fn(async () => {
        fake.cryptoBackend = { stopped: false }
      })
    }
    const client = fake as unknown as Parameters<MatrixCryptoStateTracker['ensureCrypto']>[0]
    Object.defineProperty(globalThis, 'indexedDB', {
      value: {
        // 首次登录（localStorage 无记录）会触发提前清理 ⇒ deleteDatabase 必须返回带回调的请求对象
        deleteDatabase: vi.fn().mockImplementation(() => {
          const req = {
            onsuccess: null as (() => void) | null,
            onerror: null as (() => void) | null,
            onblocked: null as (() => void) | null
          }
          setTimeout(() => req.onsuccess?.(), 0)
          return req
        }),
        databases: vi.fn().mockResolvedValue([])
      },
      configurable: true,
      writable: true
    })

    // 未解除绑定：ensureCrypto 会把已停止的 crypto 误判为"已可用"而早退（缺陷形态）
    await tracker.ensureCrypto(client, true)
    expect(fake.initRustCrypto).not.toHaveBeenCalled()

    tracker.releaseStoppedCryptoBinding(client)
    await tracker.ensureCrypto(client, true)

    expect(fake.initRustCrypto).toHaveBeenCalledTimes(1)
    expect(tracker.getRustCryptoDebugState().initialized).toBe(true)
  })
})

/**
 * Batch 4.1（图谱 §8.5 A5）：crypto 生命周期失配此前**只在日志里可见**。
 * 本组锁定「已进入结构化诊断」这一契约 —— 少了它，store 侧拿不到任何运行期信号。
 */
describe('MatrixCryptoStateTracker - 生命周期诊断（Batch 4.1）', () => {
  let tracker: MatrixCryptoStateTracker

  beforeEach(() => {
    vi.clearAllMocks()
    tracker = new MatrixCryptoStateTracker()
  })

  /** 最小 client：getCrypto() 读自身字段（与真实 SDK `return this.cryptoBackend` 一致） */
  function makeClient(cryptoBackend: unknown) {
    const client = { cryptoBackend, getCrypto: (): unknown => client.cryptoBackend }
    return client as unknown as Parameters<MatrixCryptoStateTracker['releaseStoppedCryptoBinding']>[0]
  }

  it('初始：三项诊断均为空/零', () => {
    expect(tracker.getCryptoLifecycleDiagnostics()).toEqual({
      lastBindingReleaseRejection: null,
      stoppedBindingReleased: 0,
      staleCryptoReuseWarning: null
    })
  })

  it('拒绝解绑（crypto 仍在运行）⇒ 诊断可见（此前只有一行 warn 日志）', () => {
    expect(tracker.releaseStoppedCryptoBinding(makeClient({ stopped: false }))).toBe(false)

    expect(tracker.getCryptoLifecycleDiagnostics().lastBindingReleaseRejection).toBe('crypto-not-stopped')
  })

  it('成功解绑 ⇒ 计数 +1 并清掉上一次的拒绝记录', () => {
    tracker.releaseStoppedCryptoBinding(makeClient({ stopped: false }))
    expect(tracker.getCryptoLifecycleDiagnostics().lastBindingReleaseRejection).toBe('crypto-not-stopped')

    expect(tracker.releaseStoppedCryptoBinding(makeClient({ stopped: true }))).toBe(true)

    const diagnostics = tracker.getCryptoLifecycleDiagnostics()
    expect(diagnostics.stoppedBindingReleased).toBe(1)
    expect(diagnostics.lastBindingReleaseRejection).toBeNull()
  })

  it('A1 复发哨兵：复用「已停止但未解绑」的 crypto ⇒ 记入诊断', async () => {
    await tracker.ensureCrypto(makeClient({ stopped: true }), true)

    // 未解绑 ⇒ ensureCrypto 把它当「已可用」早退，E2EE 静默失效；哨兵必须留下证据
    expect(tracker.getCryptoLifecycleDiagnostics().staleCryptoReuseWarning).toBe('crypto-stopped-but-still-bound')
  })

  it('正常运行的 crypto 复用（stopped=false）⇒ 不误报哨兵', async () => {
    await tracker.ensureCrypto(makeClient({ stopped: false }), true)

    expect(tracker.getCryptoLifecycleDiagnostics().staleCryptoReuseWarning).toBeNull()
  })

  it('resetState 清空诊断（登出 / 切换账号）', () => {
    tracker.releaseStoppedCryptoBinding(makeClient({ stopped: false }))
    expect(tracker.getCryptoLifecycleDiagnostics().lastBindingReleaseRejection).not.toBeNull()

    tracker.resetState()

    expect(tracker.getCryptoLifecycleDiagnostics()).toEqual({
      lastBindingReleaseRejection: null,
      stoppedBindingReleased: 0,
      staleCryptoReuseWarning: null
    })
  })
})
