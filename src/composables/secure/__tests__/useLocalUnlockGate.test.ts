import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  backendInfo: { current: null as null | Record<string, unknown> },
  configured: { current: false },
  configureLocalUnlock: vi.fn(async () => {}),
  unlockLocalUnlock: vi.fn(async () => false)
}))

vi.mock('@/services/secure/secureStorage', () => ({
  getSecureStorageBackendInfo: async () => mocks.backendInfo.current
}))

vi.mock('@/services/secure/localUnlockKey', () => ({
  isLocalUnlockConfigured: () => mocks.configured.current,
  configureLocalUnlock: mocks.configureLocalUnlock,
  unlockLocalUnlock: mocks.unlockLocalUnlock
}))

import {
  LOCAL_UNLOCK_MIN_PASSWORD_LENGTH,
  resetLocalUnlockGateForTest,
  useLocalUnlockGate
} from '../useLocalUnlockGate'

const ifNative = { available: true, backend: 'macos_keychain', nativeAvailable: true, degraded: false }
const ifUnavailable = { available: false, backend: null, nativeAvailable: false, degraded: false }

describe('useLocalUnlockGate（F-4 / B1）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetLocalUnlockGateForTest()
    mocks.backendInfo.current = ifNative
    mocks.configured.current = false
  })

  it('安全存储可用时不打扰用户，直接放行', async () => {
    const gate = useLocalUnlockGate()
    await expect(gate.ensureReady()).resolves.toBe(true)
    expect(gate.visible.value).toBe(false)
  })

  // 关键：degraded 仍然加密，不需要设密码
  it('降级（加密文件 fallback）同样直接放行', async () => {
    mocks.backendInfo.current = {
      available: true,
      backend: 'encrypted_file_fallback',
      nativeAvailable: false,
      degraded: true
    }
    const gate = useLocalUnlockGate()
    await expect(gate.ensureReady()).resolves.toBe(true)
    expect(gate.visible.value).toBe(false)
  })

  it('不可用且未配置过密码 → 以「设置」模式弹门禁', async () => {
    mocks.backendInfo.current = ifUnavailable
    mocks.configured.current = false

    const gate = useLocalUnlockGate()
    const ready = gate.ensureReady()
    await vi.waitFor(() => expect(gate.visible.value).toBe(true))

    expect(gate.mode.value).toBe('setup')

    await gate.submit('local-pass')
    await expect(ready).resolves.toBe(true)
    expect(mocks.configureLocalUnlock).toHaveBeenCalledWith('local-pass')
    expect(gate.visible.value).toBe(false)
  })

  it('不可用但已配置过 → 以「解锁」模式弹门禁', async () => {
    mocks.backendInfo.current = ifUnavailable
    mocks.configured.current = true
    // 解锁成功才能让 ensureReady 的 promise 落地（默认桩返回 false 会挂起）
    mocks.unlockLocalUnlock.mockResolvedValueOnce(true)

    const gate = useLocalUnlockGate()
    const ready = gate.ensureReady()
    await vi.waitFor(() => expect(gate.visible.value).toBe(true))

    expect(gate.mode.value).toBe('unlock')
    await gate.submit('whatever')
    await expect(ready).resolves.toBe(true)
    expect(mocks.unlockLocalUnlock).toHaveBeenCalledWith('whatever')
  })

  it('密码太短：报错、不弹回、不放行', async () => {
    mocks.backendInfo.current = ifUnavailable
    const gate = useLocalUnlockGate()
    const ready = gate.ensureReady()
    await vi.waitFor(() => expect(gate.visible.value).toBe(true))

    await expect(gate.submit('123')).resolves.toBe(false)
    expect(gate.errorKey.value).toBe('setting.security.local_unlock_too_short')
    expect(gate.visible.value).toBe(true)
    expect(mocks.configureLocalUnlock).not.toHaveBeenCalled()

    // 收尾：放行以免 await 悬挂
    gate.skip()
    await expect(ready).resolves.toBe(false)
  })

  it('解锁密码错误：保持对话框，不写任何状态', async () => {
    mocks.backendInfo.current = ifUnavailable
    mocks.configured.current = true
    mocks.unlockLocalUnlock.mockResolvedValueOnce(false)

    const gate = useLocalUnlockGate()
    const ready = gate.ensureReady()
    await vi.waitFor(() => expect(gate.visible.value).toBe(true))

    const ok = await gate.submit('wrong-pass')
    expect(ok).toBe(false)
    expect(gate.errorKey.value).toBe('setting.security.local_unlock_wrong_password')
    expect(gate.visible.value).toBe(true)

    gate.skip()
    await expect(ready).resolves.toBe(false)
  })

  it('选择「稍后」→ ensureReady 返回 false（crypto 将 fail-closed）', async () => {
    mocks.backendInfo.current = ifUnavailable
    const gate = useLocalUnlockGate()
    const ready = gate.ensureReady()
    await vi.waitFor(() => expect(gate.visible.value).toBe(true))

    gate.skip()

    await expect(ready).resolves.toBe(false)
    expect(gate.visible.value).toBe(false)
  })

  it('最小长度常量为 6（与私密聊天一致）', () => {
    expect(LOCAL_UNLOCK_MIN_PASSWORD_LENGTH).toBe(6)
  })
})
