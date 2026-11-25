import { beforeEach, describe, expect, it, vi } from 'vitest'

const { showFeedbackMock, backendInfoRef } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  backendInfoRef: { current: null as null | Record<string, unknown> }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('@/services/secure/secureStorage', () => ({
  getSecureStorageBackendInfo: async () => backendInfoRef.current
}))

import {
  resetSecureStorageDegradedNotice,
  SECURE_STORAGE_NOTICE_STATE_STORAGE_KEY,
  useSecureStorageDegradedNotice
} from '../useSecureStorageDegradedNotice'

const setBackend = (info: Record<string, unknown> | null) => {
  backendInfoRef.current = info
}

const ifNative = { available: true, backend: 'macos_keychain', nativeAvailable: true, degraded: false }
const ifDegraded = {
  available: true,
  backend: 'encrypted_file_fallback',
  nativeAvailable: false,
  degraded: true
}
const ifUnavailable = { available: false, backend: null, nativeAvailable: false, degraded: false }

describe('useSecureStorageDegradedNotice（B3）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    resetSecureStorageDegradedNotice()
    setBackend(ifNative)
  })

  it('首次降级时提示一次，并记录降级后端', async () => {
    setBackend(ifDegraded)

    const result = await useSecureStorageDegradedNotice().notifyIfNeeded()

    expect(result).toBe('degraded')
    expect(showFeedbackMock).toHaveBeenCalledWith('setting.security.local_store_degraded_toast', 'warning', 'polite')
    expect(localStorage.getItem(SECURE_STORAGE_NOTICE_STATE_STORAGE_KEY)).toBe('encrypted_file_fallback')
  })

  it('再次启动仍降级时不重复提示', async () => {
    setBackend(ifDegraded)
    await useSecureStorageDegradedNotice().notifyIfNeeded()
    showFeedbackMock.mockClear()

    const result = await useSecureStorageDegradedNotice().notifyIfNeeded()

    expect(result).toBeNull()
    expect(showFeedbackMock).not.toHaveBeenCalled()
  })

  it('从降级恢复为系统密钥库时提示一次，并清除降级记录', async () => {
    setBackend(ifDegraded)
    await useSecureStorageDegradedNotice().notifyIfNeeded()
    showFeedbackMock.mockClear()

    setBackend(ifNative)
    const result = await useSecureStorageDegradedNotice().notifyIfNeeded()

    expect(result).toBe('recovered')
    expect(showFeedbackMock).toHaveBeenCalledWith('setting.security.local_store_recovered_toast', 'success', 'polite')
    expect(localStorage.getItem(SECURE_STORAGE_NOTICE_STATE_STORAGE_KEY)).toBeNull()
  })

  it('从未降级过的设备不提示恢复', async () => {
    setBackend(ifNative)

    const result = await useSecureStorageDegradedNotice().notifyIfNeeded()

    expect(result).toBeNull()
    expect(showFeedbackMock).not.toHaveBeenCalled()
  })

  it('恢复提示只出现一次', async () => {
    setBackend(ifDegraded)
    await useSecureStorageDegradedNotice().notifyIfNeeded()
    setBackend(ifNative)
    await useSecureStorageDegradedNotice().notifyIfNeeded()
    showFeedbackMock.mockClear()

    const result = await useSecureStorageDegradedNotice().notifyIfNeeded()

    expect(result).toBeNull()
    expect(showFeedbackMock).not.toHaveBeenCalled()
  })

  // 明文（安全存储不可用）是另一条链路（useLocalStorePlaintextWarning），
  // 这里既不能抢着提示，也不能把降级记录清掉。
  it('安全存储不可用时不介入，也不改写降级记录', async () => {
    setBackend(ifDegraded)
    await useSecureStorageDegradedNotice().notifyIfNeeded()
    showFeedbackMock.mockClear()

    setBackend(ifUnavailable)
    const result = await useSecureStorageDegradedNotice().notifyIfNeeded()

    expect(result).toBeNull()
    expect(showFeedbackMock).not.toHaveBeenCalled()
    expect(localStorage.getItem(SECURE_STORAGE_NOTICE_STATE_STORAGE_KEY)).toBe('encrypted_file_fallback')
  })
})
