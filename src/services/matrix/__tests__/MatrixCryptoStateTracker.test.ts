import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MatrixCryptoStateTracker } from '../MatrixCryptoStateTracker'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
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
