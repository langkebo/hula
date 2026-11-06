import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * crypto store 的 storageKey 单元测试。
 *
 * 这层是 E2EE 的**根**：密钥一旦跨会话不一致，SDK 就打不开旧 crypto store
 * （"An object failed to be decrypted while unpickling"），用户会丢掉所有本地会话密钥。
 * 因此本文件重点钉住四件事：
 *   1. 长度恒为 32 字节（SDK 硬要求：`must be exactly 32 bytes`）；
 *   2. **跨会话稳定** —— 同一 userId:deviceId 反复取到逐字节相同的密钥；
 *   3. keychain 不可用/损坏时**返回 null**，绝不返回"只在内存里的新密钥"；
 *   4. 返回副本，调用方（含 WASM）就地修改不会污染缓存。
 */

const hoisted = vi.hoisted(() => {
  // 内存 keychain：set/get 必须成对，否则测试会走不到"写后读回校验"这一真实路径
  const store = new Map<string, string>()
  return {
    store,
    getSecureSecret: vi.fn(async (key: string): Promise<string | null> => store.get(key) ?? null),
    setSecureSecret: vi.fn(async (key: string, value: string): Promise<boolean> => {
      store.set(key, value)
      return true
    }),
    deleteSecureSecret: vi.fn(async (key: string): Promise<boolean> => {
      store.delete(key)
      return true
    }),
    // 后端事实默认"原生密钥库可用"；降级场景由单个用例覆写
    // 显式标注返回类型：可用场景 backend 是字符串，不可用场景是 null
    getSecureStorageBackendInfo: vi.fn(
      async (): Promise<{
        available: boolean
        backend: string | null
        nativeAvailable: boolean
        degraded: boolean
      }> => ({
        available: true,
        backend: 'macos_keychain',
        nativeAvailable: true,
        degraded: false
      })
    )
  }
})

// 保留真实的 `describeSecureStorageBackend`（纯函数），只替换 IO 面 ——
// 否则测试会断言不到真实文案，也就锁不住"降级时不得出现 keychain"这条契约。
vi.mock('@/services/secure/secureStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/secure/secureStorage')>()
  return {
    ...actual,
    getSecureSecret: (...args: unknown[]) => hoisted.getSecureSecret(...(args as [string])),
    setSecureSecret: (...args: unknown[]) => hoisted.setSecureSecret(...(args as [string, string])),
    deleteSecureSecret: (...args: unknown[]) => hoisted.deleteSecureSecret(...(args as [string])),
    getSecureStorageBackendInfo: () => hoisted.getSecureStorageBackendInfo()
  }
})

const logSpies = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => logSpies
}))

import { CRYPTO_KEY_SOURCE_STORAGE_KEY } from '../cryptoKeySource'
import {
  CRYPTO_KEYCHAIN_PREFIX,
  CRYPTO_STORAGE_KEY_BYTES,
  clearCryptoStorageKeyCache,
  deleteCryptoStorageKey,
  getOrCreateCryptoStorageKey
} from '../cryptoStorageKey'

/**
 * keychain 键名。**引用实现导出的常量**，不在测试里再抄一遍字面量 ——
 * 重复字面量会让 `check-settings-wiring.mjs` 的"漏报自检"报错，
 * 也会让"实现偷偷改名"这类破坏兼容性的改动无法被测试发现。
 */
const keychainKey = (userId: string, deviceId: string): string => `${CRYPTO_KEYCHAIN_PREFIX}:${userId}:${deviceId}`

describe('cryptoStorageKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.store.clear()
    clearCryptoStorageKeyCache()
    // 来源标记会跨会话持久化，用例之间必须清掉，否则上一条用例的 'secure'/'local'
    // 会改变下一条用例的读取路径（这正是被测行为本身）
    localStorage.removeItem(CRYPTO_KEY_SOURCE_STORAGE_KEY)
  })

  afterEach(() => {
    clearCryptoStorageKeyCache()
    vi.restoreAllMocks()
  })

  it('首次调用生成 32 字节密钥并写入 keychain', async () => {
    const key = await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')

    expect(key).toBeInstanceOf(Uint8Array)
    expect(key).toHaveLength(CRYPTO_STORAGE_KEY_BYTES)
    expect(hoisted.setSecureSecret).toHaveBeenCalledTimes(1)
    const [writtenKey, writtenValue] = hoisted.setSecureSecret.mock.calls[0] as [string, string]
    expect(writtenKey).toBe(keychainKey('@alice:hs', 'DEV1'))
    // 写入的是 base64 文本（keychain 只能存字符串），解码后仍是同一 32 字节
    expect(typeof writtenValue).toBe('string')
    expect(atob(writtenValue)).toHaveLength(CRYPTO_STORAGE_KEY_BYTES)
    expect(Array.from(key!)).toEqual(Array.from(Uint8Array.from(atob(writtenValue), (c) => c.charCodeAt(0))))
  })

  it('二次调用（模拟新会话）读回逐字节相同的密钥', async () => {
    const first = await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')

    // 新会话：内存缓存清空，keychain 里留着上次的值
    clearCryptoStorageKeyCache()

    const second = await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')

    expect(second).not.toBeNull()
    expect(Array.from(second!)).toEqual(Array.from(first!))
    // 有既存值时**不得**再次生成/写入 —— 换密钥会让旧 store 打不开
    expect(hoisted.setSecureSecret).toHaveBeenCalledTimes(1)
  })

  it('内存缓存命中时不再访问 keychain', async () => {
    await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')
    hoisted.getSecureSecret.mockClear()

    const again = await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')

    expect(again).toHaveLength(CRYPTO_STORAGE_KEY_BYTES)
    expect(hoisted.getSecureSecret).not.toHaveBeenCalled()
  })

  it('keychain 写入失败时返回 null，而不是只在内存中的新密钥', async () => {
    hoisted.setSecureSecret.mockResolvedValueOnce(false)

    const key = await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')

    // 返回随机密钥会让"下次启动读不到"变成静默的 store 不可读，故必须 null
    expect(key).toBeNull()
  })

  it('写入后读回不一致时返回 null 并清理该条目', async () => {
    // keychain 把值写坏（读到的是别的内容）—— 说明该条目不可依赖
    hoisted.getSecureSecret.mockResolvedValueOnce(null).mockResolvedValueOnce('some-other-value')

    const key = await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')

    expect(key).toBeNull()
    expect(hoisted.deleteSecureSecret).toHaveBeenCalledWith(keychainKey('@alice:hs', 'DEV1'))
  })

  it.each([
    ['非 base64 文本', 'not-base64-!!!'],
    ['长度不足 32 字节', btoa('short')],
    ['长度超过 32 字节', btoa('x'.repeat(64))]
  ])('keychain 中的值损坏（%s）时返回 null 并清除该条目', async (_label, corrupted) => {
    hoisted.store.set(keychainKey('@alice:hs', 'DEV1'), corrupted)

    const key = await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')

    expect(key).toBeNull()
    expect(hoisted.deleteSecureSecret).toHaveBeenCalledWith(keychainKey('@alice:hs', 'DEV1'))
    // 损坏值不得触发"生成新密钥"——那会用新密钥打开旧 store
    expect(hoisted.setSecureSecret).not.toHaveBeenCalled()
  })

  it('返回的是副本：就地修改不影响缓存', async () => {
    const first = await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')
    first!.fill(0)

    const second = await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')

    expect(Array.from(second!).every((b) => b === 0)).toBe(false)
  })

  it('deleteCryptoStorageKey 同时清内存缓存与 keychain 条目', async () => {
    await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')

    await deleteCryptoStorageKey('@alice:hs', 'DEV1')

    expect(hoisted.store.has(keychainKey('@alice:hs', 'DEV1'))).toBe(false)
    // 缓存已清 ⇒ 再次获取会重新访问 keychain（并因无值而重新生成）
    hoisted.getSecureSecret.mockClear()
    await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')
    expect(hoisted.getSecureSecret).toHaveBeenCalled()
  })

  it('不同设备/用户之间的密钥互不相同', async () => {
    const a = await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')
    const b = await getOrCreateCryptoStorageKey('@alice:hs', 'DEV2')
    const c = await getOrCreateCryptoStorageKey('@bob:hs', 'DEV1')

    expect(Array.from(a!)).not.toEqual(Array.from(b!))
    expect(Array.from(a!)).not.toEqual(Array.from(c!))
  })

  describe('后端如实上报（降级可见）', () => {
    beforeEach(() => {
      // 显式回到"原生可用"基线：`clearAllMocks` 不清除已设置的实现
      hoisted.getSecureStorageBackendInfo.mockResolvedValue({
        available: true,
        backend: 'macos_keychain',
        nativeAvailable: true,
        degraded: false
      })
    })

    it('原生密钥库可用时走 info 且文案指明系统密钥库', async () => {
      await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')

      const infoCalls = logSpies.info.mock.calls.map(([msg]) => String(msg))
      expect(infoCalls.some((msg) => msg.includes('系统密钥库'))).toBe(true)
      expect(logSpies.warn).not.toHaveBeenCalledWith(expect.stringContaining('系统密钥库不可用'))
    })

    it('降级（仅加密文件 fallback）时走 warn，且**不得**出现 keychain 字样', async () => {
      hoisted.getSecureStorageBackendInfo.mockResolvedValueOnce({
        available: true,
        backend: 'encrypted_file_fallback',
        nativeAvailable: false,
        degraded: true
      })

      const key = await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')

      expect(key).toHaveLength(CRYPTO_STORAGE_KEY_BYTES)
      const warnCalls = logSpies.warn.mock.calls.map(([msg]) => String(msg))
      const degradedMsg = warnCalls.find((msg) => msg.includes('生成并存储 crypto storageKey'))
      expect(degradedMsg).toBeDefined()
      expect(degradedMsg).toContain('加密文件 fallback')
      expect(degradedMsg).toContain('系统密钥库不可用')
      expect(degradedMsg).not.toContain('keychain')
      // 降级不得被记成 info
      expect(logSpies.info.mock.calls.map(([msg]) => String(msg)).some((m) => m.includes('生成并存储'))).toBe(false)
    })

    it('读取既有密钥时的 debug 文案同样按后端描述（降级不含 keychain）', async () => {
      // 先写入一条
      await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')
      clearCryptoStorageKeyCache()
      logSpies.debug.mockClear()
      hoisted.getSecureStorageBackendInfo.mockResolvedValue({
        available: true,
        backend: 'encrypted_file_fallback',
        nativeAvailable: false,
        degraded: true
      })

      await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')

      const debugMsg = logSpies.debug.mock.calls
        .map(([msg]) => String(msg))
        .find((m) => m.includes('读取 crypto storageKey'))
      expect(debugMsg).toBeDefined()
      expect(debugMsg).toContain('加密文件 fallback')
      expect(debugMsg).not.toContain('keychain')
    })
  })
})

// F-4 / B2：安全存储完全不可用时，退到「本地解锁密码」派生的密钥。
// 意义：没有系统密钥库的机器（如 Linux 无 Secret Service）不再只能在
// 「明文落盘」与「不能用 E2EE」之间二选一。
describe('cryptoStorageKey · 本地解锁兜底（F-4/B2）', () => {
  beforeEach(async () => {
    clearCryptoStorageKeyCache()
    hoisted.store.clear()
    localStorage.removeItem(CRYPTO_KEY_SOURCE_STORAGE_KEY)
    const { clearLocalUnlock } = await import('../localUnlockKey')
    clearLocalUnlock()
  })

  it('安全存储不可用且已解锁本地密码时，返回那把 32B 密钥', async () => {
    const { configureLocalUnlock, getLocalUnlockStorageKey } = await import('../localUnlockKey')
    await configureLocalUnlock('local-pass')
    const expected = getLocalUnlockStorageKey()!

    // 安全存储彻底不可用：写入失败
    hoisted.setSecureSecret.mockResolvedValueOnce(false)
    hoisted.getSecureStorageBackendInfo.mockResolvedValue({
      available: false,
      backend: null,
      nativeAvailable: false,
      degraded: false
    })

    const key = await getOrCreateCryptoStorageKey('@bob:hs', 'DEV9')

    expect(key).not.toBeNull()
    expect(key!.length).toBe(32)
    expect(Array.from(key!)).toEqual(Array.from(expected))
  })

  it('安全存储不可用且未解锁时返回 null（交由调用方 fail-closed，绝不默认明文）', async () => {
    hoisted.setSecureSecret.mockResolvedValueOnce(false)
    hoisted.getSecureStorageBackendInfo.mockResolvedValue({
      available: false,
      backend: null,
      nativeAvailable: false,
      degraded: false
    })

    const key = await getOrCreateCryptoStorageKey('@carol:hs', 'DEV8')

    expect(key).toBeNull()
  })
})

// D3：来源必须跨会话锁定。否则后端可用性一变（例如 keychain 恢复/失效），
// 下一次启动就会用另一把密钥去打开旧 store，WASM 侧表现为
// "An object failed to be decrypted while unpickling"，用户丢本地会话密钥。
describe('cryptoStorageKey · 来源锁定（D3）', () => {
  const readSource = (): Record<string, string> =>
    JSON.parse(localStorage.getItem(CRYPTO_KEY_SOURCE_STORAGE_KEY) ?? '{}') as Record<string, string>

  beforeEach(async () => {
    // 清调用历史（不清实现），否则 "不得调用安全存储" 这类断言会被前面的用例污染
    vi.clearAllMocks()
    clearCryptoStorageKeyCache()
    hoisted.store.clear()
    localStorage.removeItem(CRYPTO_KEY_SOURCE_STORAGE_KEY)
    // 前一批用例可能改过这些 mock 的持久实现，这里显式回到"原生可用"基线
    hoisted.getSecureStorageBackendInfo.mockResolvedValue({
      available: true,
      backend: 'macos_keychain',
      nativeAvailable: true,
      degraded: false
    })
    hoisted.getSecureSecret.mockImplementation(async (key: string) => hoisted.store.get(key) ?? null)
    hoisted.setSecureSecret.mockImplementation(async (key: string, value: string) => {
      hoisted.store.set(key, value)
      return true
    })
    hoisted.deleteSecureSecret.mockImplementation(async (key: string) => {
      hoisted.store.delete(key)
      return true
    })
    const { clearLocalUnlock } = await import('../localUnlockKey')
    clearLocalUnlock()
  })

  it('首次从安全存储生成时把来源记为 secure', async () => {
    await getOrCreateCryptoStorageKey('@alice:hs', 'DEV1')

    expect(readSource()['@alice:hs:DEV1']).toBe('secure')
  })

  it('来源为 local 时，即使安全存储可用也不改读安全存储', async () => {
    const { configureLocalUnlock, getLocalUnlockStorageKey } = await import('../localUnlockKey')
    await configureLocalUnlock('local-pass')
    const expected = getLocalUnlockStorageKey()!

    // 模拟「后端恢复可用」：安全存储里确实有一把可用的密钥
    hoisted.store.set(keychainKey('@dave:hs', 'DEV5'), btoa('x'.repeat(CRYPTO_STORAGE_KEY_BYTES)))
    localStorage.setItem(CRYPTO_KEY_SOURCE_STORAGE_KEY, JSON.stringify({ '@dave:hs:DEV5': 'local' }))

    const key = await getOrCreateCryptoStorageKey('@dave:hs', 'DEV5')

    expect(key).not.toBeNull()
    expect(Array.from(key!)).toEqual(Array.from(expected))
    expect(hoisted.getSecureSecret).not.toHaveBeenCalled()
  })

  it('来源为 local 但本次会话未解锁时返回 null，且不读安全存储', async () => {
    const { configureLocalUnlock, lockLocalUnlock } = await import('../localUnlockKey')
    await configureLocalUnlock('local-pass')
    lockLocalUnlock()
    hoisted.store.set(keychainKey('@erin:hs', 'DEV6'), btoa('y'.repeat(CRYPTO_STORAGE_KEY_BYTES)))
    localStorage.setItem(CRYPTO_KEY_SOURCE_STORAGE_KEY, JSON.stringify({ '@erin:hs:DEV6': 'local' }))

    const key = await getOrCreateCryptoStorageKey('@erin:hs', 'DEV6')

    expect(key).toBeNull()
    expect(hoisted.getSecureSecret).not.toHaveBeenCalled()
    // 未取到密钥不得改写来源标记
    expect(readSource()['@erin:hs:DEV6']).toBe('local')
  })

  it('来源为 secure 但安全存储条目丢失时返回 null，不切换本地解锁密钥', async () => {
    const { configureLocalUnlock, getLocalUnlockStorageKey } = await import('../localUnlockKey')
    await configureLocalUnlock('local-pass')
    expect(getLocalUnlockStorageKey()).not.toBeNull()
    localStorage.setItem(CRYPTO_KEY_SOURCE_STORAGE_KEY, JSON.stringify({ '@frank:hs:DEV7': 'secure' }))

    const key = await getOrCreateCryptoStorageKey('@frank:hs', 'DEV7')

    expect(key).toBeNull()
    // 既不得生成新密钥，也不得把来源改成 local
    expect(hoisted.setSecureSecret).not.toHaveBeenCalled()
    expect(readSource()['@frank:hs:DEV7']).toBe('secure')
  })

  it('deleteCryptoStorageKey 同时清除来源标记', async () => {
    await getOrCreateCryptoStorageKey('@gina:hs', 'DEV10')
    expect(readSource()['@gina:hs:DEV10']).toBe('secure')

    await deleteCryptoStorageKey('@gina:hs', 'DEV10')

    expect(readSource()['@gina:hs:DEV10']).toBeUndefined()
  })
})
