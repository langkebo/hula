import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { refreshTrustLevel, senderDeviceCache, useMessageTrust } from '@/composables/encryption/useMessageTrust'
import { matrixDeviceService } from '@/services/matrix/user/MatrixDeviceService'

vi.mock('@/services/matrix/user/MatrixDeviceService', () => ({
  matrixDeviceService: {
    getUserDevices: vi.fn()
  }
}))

const mockGetUserDevices = vi.mocked(matrixDeviceService.getUserDevices)

describe('useMessageTrust', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 清空缓存（避免跨测试污染）
    senderDeviceCache.clear()
    // 模拟 mock 模块级缓存
    vi.doMock('@/composables/encryption/useMessageTrust', async (importOriginal) => {
      const mod = await importOriginal<typeof import('@/composables/encryption/useMessageTrust')>()
      Object.assign(mod.senderDeviceCache, senderDeviceCache)
      return mod
    })
  })
  it('returns plain for non-encrypted messages', () => {
    const result = useMessageTrust(false)
    expect(result.trustLevel.value).toBe('plain')
    expect(result.isEncrypted.value).toBe(false)
    expect(result.isVerified.value).toBe(false)
    expect(result.encryptionAlgorithm.value).toBeNull()
  })

  it('returns unverified for encrypted messages without senderId (security default)', () => {
    const result = useMessageTrust(true)
    // 无 senderId → 安全默认值 'unverified'（旧实现返回 'verified'）
    expect(result.trustLevel.value).toBe('unverified')
    expect(result.isEncrypted.value).toBe(true)
    expect(result.isVerified.value).toBe(false)
  })

  it('provides correct trust description for plain messages', () => {
    expect(useMessageTrust(false).trustDescription.value).toBe('消息未加密')
  })

  it('provides correct trust description for unverified messages', () => {
    const result = useMessageTrust(true, { senderId: '@alice:server' })
    expect(result.trustDescription.value).toBe('端到端加密未完全验证')
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

  it('lockBadgeLevel mirrors trust level for encrypted messages (unverified by default)', () => {
    // 无 senderId → unverified（安全默认值）
    expect(useMessageTrust(true).lockBadgeLevel.value).toBe('unverified')
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
    // 无 senderId → 安全默认值 'unverified'
    expect(result.lockBadgeLevel.value).toBe('unverified')
    expect(result.trustDescription.value).toBe('端到端加密未完全验证')

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

  // ---- senderId + refreshTrustLevel：异步刷新验证状态 ----

  it('with senderId and empty device list → unverified (cache miss)', async () => {
    mockGetUserDevices.mockResolvedValue([])
    const result = useMessageTrust(true, { senderId: '@alice:server' })
    // 初始：cache miss → unverified
    expect(result.trustLevel.value).toBe('unverified')
    // 异步刷新后仍为 unverified（无设备）
    await refreshTrustLevel('@alice:server')
    expect(result.trustLevel.value).toBe('unverified')
  })

  it('with senderId and verified device → verified after refresh', async () => {
    mockGetUserDevices.mockResolvedValue([{ device_id: 'D1', verified: true }])
    const result = useMessageTrust(true, { senderId: '@alice:server' })
    // 初始：cache miss → unverified
    expect(result.trustLevel.value).toBe('unverified')
    // 异步刷新：缓存更新 → verified
    await refreshTrustLevel('@alice:server')
    expect(result.trustLevel.value).toBe('verified')
  })

  it('refreshTrustLevel handles network errors gracefully', async () => {
    mockGetUserDevices.mockRejectedValue(new Error('network'))
    const result = useMessageTrust(true, { senderId: '@alice:server' })
    expect(result.trustLevel.value).toBe('unverified')
    // 失败时保持缓存原值，不抛错
    await expect(refreshTrustLevel('@alice:server')).resolves.toBe('unverified')
    expect(result.trustLevel.value).toBe('unverified')
  })
})
