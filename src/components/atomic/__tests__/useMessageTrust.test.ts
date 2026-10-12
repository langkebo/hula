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

  // trustDescriptionKey 返回 i18n key 而不是文案：
  // composable 层没有 i18n 上下文，硬编码中文会在英文界面漏出中文。
  it('returns the i18n key for plain messages', () => {
    expect(useMessageTrust(false).trustDescriptionKey.value).toBe('chat.encryption.plain_title')
  })

  it('returns the i18n key for unverified messages', () => {
    const result = useMessageTrust(true, { senderId: '@alice:server' })
    expect(result.trustDescriptionKey.value).toBe('chat.encryption.unverified_title')
  })

  it('returns the i18n key for verified messages', async () => {
    mockGetUserDevices.mockResolvedValue([{ verified: true }] as never)
    const result = useMessageTrust(true, { senderId: '@alice:server' })
    await refreshTrustLevel('@alice:server')
    await nextTick()
    expect(result.trustDescriptionKey.value).toBe('chat.encryption.verified_title')
  })

  it('never returns a hardcoded human-readable string', () => {
    const key = useMessageTrust(false).trustDescriptionKey.value
    expect(key).toMatch(/^[a-z0-9_.]+$/)
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
    expect(result.trustDescriptionKey.value).toBe('chat.encryption.plain_title')

    encrypted.value = true
    await nextTick()

    expect(result.isEncrypted.value).toBe(true)
    // 无 senderId → 安全默认值 'unverified'
    expect(result.lockBadgeLevel.value).toBe('unverified')
    expect(result.trustDescriptionKey.value).toBe('chat.encryption.unverified_title')

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

  // ---- 信任判定：必须是「全部设备已验证」（2026-10-12 修正）----

  it('任一台设备未验证时不得给出已验证（防止"任一台即可"的假安全）', async () => {
    mockGetUserDevices.mockResolvedValue([
      { device_id: 'D1', verified: true },
      { device_id: 'D2', verified: false }
    ])
    await expect(refreshTrustLevel('@mixed:server')).resolves.toBe('unverified')
    expect(senderDeviceCache.get('@mixed:server')).toBe('unverified')
  })

  it('全部设备已验证 → verified', async () => {
    mockGetUserDevices.mockResolvedValue([
      { device_id: 'D1', verified: true },
      { device_id: 'D2', verified: true }
    ])
    await expect(refreshTrustLevel('@all:server')).resolves.toBe('verified')
  })

  it('verified 字段缺失（undefined）不得被当作已验证', async () => {
    mockGetUserDevices.mockResolvedValue([{ device_id: 'D1' }])
    await expect(refreshTrustLevel('@noverified:server')).resolves.toBe('unverified')
  })

  // ---- risk：加密房间中的明文消息（该分支此前不可达）----

  it('加密房间中的明文消息 → risk（红锁）', () => {
    const result = useMessageTrust(false, { isEncrypted: true, senderId: '@alice:server' })
    expect(result.trustLevel.value).toBe('risk')
    expect(result.lockBadgeLevel.value).toBe('risk')
    expect(result.trustDescriptionKey.value).toBe('chat.encryption.risk_title')
  })

  it('未加密房间中的明文消息仍为 plain（不得误报风险）', () => {
    expect(useMessageTrust(false, { isEncrypted: false }).trustLevel.value).toBe('plain')
    // 房间信息缺失时保守地按 plain 处理（无证据表明房间要求加密）
    expect(useMessageTrust(false).trustLevel.value).toBe('plain')
  })

  it('房间加密状态支持 getter：会话中启用加密后同步重算', async () => {
    const roomEncrypted = ref(false)
    const result = useMessageTrust(false, { isEncrypted: () => roomEncrypted.value })
    expect(result.trustLevel.value).toBe('plain')

    roomEncrypted.value = true
    await nextTick()
    expect(result.trustLevel.value).toBe('risk')
  })

  it('已加密消息不受"房间明文"判定影响（仍走设备验证路径）', () => {
    const result = useMessageTrust(true, { isEncrypted: true, senderId: '@alice:server' })
    expect(result.trustLevel.value).toBe('unverified')
  })
})
