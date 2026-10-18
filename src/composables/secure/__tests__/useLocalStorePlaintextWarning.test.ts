import { beforeEach, describe, expect, it, vi } from 'vitest'

const { showFeedbackMock, backendInfoRef, debugStateRef } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  backendInfoRef: { current: null as null | Record<string, unknown> },
  debugStateRef: { current: { storeEncrypted: null as boolean | null } }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getRustCryptoDebugState: () => debugStateRef.current
  }
}))

vi.mock('@/services/secure/secureStorage', () => ({
  getSecureStorageBackendInfo: async () => backendInfoRef.current
}))

import {
  LOCAL_STORE_PLAINTEXT_WARNED_STORAGE_KEY,
  resetLocalStorePlaintextWarning,
  useLocalStorePlaintextWarning
} from '../useLocalStorePlaintextWarning'

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

describe('useLocalStorePlaintextWarning（F-4 / D1）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    resetLocalStorePlaintextWarning()
    debugStateRef.current = { storeEncrypted: null }
    setBackend(ifNative)
  })

  it('实测未加密时提示一次，并写标记', async () => {
    debugStateRef.current = { storeEncrypted: false }
    setBackend(ifUnavailable)

    const shown = await useLocalStorePlaintextWarning().warnIfNeeded()

    expect(shown).toBe(true)
    expect(showFeedbackMock).toHaveBeenCalledWith(
      'setting.security.local_store_plaintext_toast',
      'warning',
      'assertive'
    )
    expect(localStorage.getItem(LOCAL_STORE_PLAINTEXT_WARNED_STORAGE_KEY)).toBe('1')
  })

  it('第二次启动不再提示（避免变成噪音）', async () => {
    debugStateRef.current = { storeEncrypted: false }
    setBackend(ifUnavailable)

    await useLocalStorePlaintextWarning().warnIfNeeded()
    showFeedbackMock.mockClear()
    const shownAgain = await useLocalStorePlaintextWarning().warnIfNeeded()

    expect(shownAgain).toBe(false)
    expect(showFeedbackMock).not.toHaveBeenCalled()
  })

  // 关键边界：degraded 仍然是加密的，不能提示「明文落盘」
  it('降级（加密文件 fallback）不提示', async () => {
    debugStateRef.current = { storeEncrypted: true }
    setBackend(ifDegraded)

    const shown = await useLocalStorePlaintextWarning().warnIfNeeded()

    expect(shown).toBe(false)
    expect(showFeedbackMock).not.toHaveBeenCalled()
  })

  it('未初始化（storeEncrypted=null）不提示', async () => {
    debugStateRef.current = { storeEncrypted: null }
    setBackend(ifUnavailable)

    const shown = await useLocalStorePlaintextWarning().warnIfNeeded()

    expect(shown).toBe(false)
    expect(showFeedbackMock).not.toHaveBeenCalled()
  })
})
