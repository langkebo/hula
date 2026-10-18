import { describe, expect, it } from 'vitest'
import { deriveLocalStoreEncryptionLevel, isLocalStoreEncryptionConcerning } from '../localStoreEncryptionStatus'
import type { SecureStorageBackendInfo } from '../secureStorage'

// F-4：本地密钥库状态判定。
//
// 最要紧的一条：**degraded 仍然是加密**。历史实现把「原生密钥库不可用」当成
// 「明文落盘」，会在 Linux 无 Secret Service 的机器上误报 —— 错误的告警会让用户
// 学会忽略所有告警。

const native: SecureStorageBackendInfo = {
  available: true,
  backend: 'macos-keychain',
  nativeAvailable: true,
  degraded: false
}

const degradedFallback: SecureStorageBackendInfo = {
  available: true,
  backend: 'encrypted_file_fallback',
  nativeAvailable: false,
  degraded: true
}

const unavailable: SecureStorageBackendInfo = {
  available: false,
  backend: null,
  nativeAvailable: false,
  degraded: false
}

describe('deriveLocalStoreEncryptionLevel', () => {
  it('未尝试（storeEncrypted=null）→ unknown，不猜', () => {
    expect(deriveLocalStoreEncryptionLevel(null, native)).toBe('unknown')
    expect(deriveLocalStoreEncryptionLevel(null, null)).toBe('unknown')
  })

  it('原生密钥库可用且已加密 → encrypted-native', () => {
    expect(deriveLocalStoreEncryptionLevel(true, native)).toBe('encrypted-native')
  })

  it('降级到加密文件 fallback → encrypted-degraded（仍然是加密）', () => {
    expect(deriveLocalStoreEncryptionLevel(true, degradedFallback)).toBe('encrypted-degraded')
  })

  it('安全存储完全不可用 → plaintext', () => {
    expect(deriveLocalStoreEncryptionLevel(false, unavailable)).toBe('plaintext')
  })

  // 以实测为准，不以配置为准：后端报告 degraded（看起来"有加密"），
  // 但 store 实际没拿到 key ⇒ 必须报 plaintext
  it('实测未加密时，即使后端自称 degraded 也报 plaintext', () => {
    expect(deriveLocalStoreEncryptionLevel(false, degradedFallback)).toBe('plaintext')
  })

  it('后端信息缺失但 store 已加密 → 保守报 encrypted-native（不虚报降级）', () => {
    expect(deriveLocalStoreEncryptionLevel(true, null)).toBe('encrypted-native')
  })
})

describe('isLocalStoreEncryptionConcerning', () => {
  it('只有 plaintext 需要提醒用户', () => {
    expect(isLocalStoreEncryptionConcerning('plaintext')).toBe(true)
    expect(isLocalStoreEncryptionConcerning('encrypted-degraded')).toBe(false)
    expect(isLocalStoreEncryptionConcerning('encrypted-native')).toBe(false)
    expect(isLocalStoreEncryptionConcerning('unknown')).toBe(false)
  })
})
