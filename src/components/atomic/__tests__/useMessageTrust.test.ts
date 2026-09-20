import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { useMessageTrust } from '@/composables/encryption/useMessageTrust'

describe('useMessageTrust', () => {
  it('returns plain for non-encrypted messages', () => {
    const result = useMessageTrust(false)
    expect(result.trustLevel.value).toBe('plain')
    expect(result.isEncrypted.value).toBe(false)
    expect(result.isVerified.value).toBe(false)
    expect(result.encryptionAlgorithm.value).toBeNull()
  })

  it('returns verified for encrypted messages', () => {
    const result = useMessageTrust(true)
    expect(result.trustLevel.value).toBe('verified')
    expect(result.isEncrypted.value).toBe(true)
    expect(result.isVerified.value).toBe(true)
  })

  it('provides correct trust description for plain messages', () => {
    expect(useMessageTrust(false).trustDescription.value).toBe('消息未加密')
  })

  it('provides correct trust description for verified messages', () => {
    expect(useMessageTrust(true).trustDescription.value).toBe('端到端加密已验证')
  })

  it('reads encryption algorithm from room when encrypted', () => {
    const result = useMessageTrust(true, { getEncryptionAlgorithm: () => 'm.megolm.v1.aes-sha2' })
    expect(result.encryptionAlgorithm.value).toBe('m.megolm.v1.aes-sha2')
  })

  it('does not read encryption algorithm when room accessor is absent', () => {
    expect(useMessageTrust(true).encryptionAlgorithm.value).toBeNull()
  })

  it('does not read encryption algorithm for plain messages even when room exposes one', () => {
    const result = useMessageTrust(false, { getEncryptionAlgorithm: () => 'm.megolm.v1.aes-sha2' })
    expect(result.encryptionAlgorithm.value).toBeNull()
  })

  // ---- lockBadgeLevel：MessageLockBadge 的 trust-level 绑定来源 ----

  it('lockBadgeLevel collapses plain to unverified (type-safe fallback)', () => {
    const result = useMessageTrust(false)
    expect(result.trustLevel.value).toBe('plain')
    // plain 不属于 LockBadgeLevel，必须收敛为中性 unverified
    expect(result.lockBadgeLevel.value).toBe('unverified')
  })

  it('lockBadgeLevel mirrors verified for encrypted messages', () => {
    expect(useMessageTrust(true).lockBadgeLevel.value).toBe('verified')
  })

  it('lockBadgeLevel never emits plain (contract with MessageLockBadge)', () => {
    for (const encrypted of [true, false]) {
      expect(useMessageTrust(encrypted).lockBadgeLevel.value).not.toBe('plain')
    }
  })

  // ---- 响应式：props 变化时信任等级必须同步（虚拟列表复用组件实例场景）----

  it('tracks reactive source passed as getter', async () => {
    const encrypted = ref(false)
    const result = useMessageTrust(() => encrypted.value)

    expect(result.isEncrypted.value).toBe(false)
    expect(result.lockBadgeLevel.value).toBe('unverified')
    expect(result.trustDescription.value).toBe('消息未加密')

    encrypted.value = true
    await nextTick()

    expect(result.isEncrypted.value).toBe(true)
    expect(result.lockBadgeLevel.value).toBe('verified')
    expect(result.trustDescription.value).toBe('端到端加密已验证')

    encrypted.value = false
    await nextTick()

    // 回退同样生效，不残留上一条消息的信任状态
    expect(result.isEncrypted.value).toBe(false)
    expect(result.lockBadgeLevel.value).toBe('unverified')
  })

  it('accepts a ref directly as reactive source', async () => {
    const encrypted = ref(true)
    const result = useMessageTrust(encrypted)
    expect(result.isEncrypted.value).toBe(true)

    encrypted.value = false
    await nextTick()
    expect(result.isEncrypted.value).toBe(false)
  })
})
