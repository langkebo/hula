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
