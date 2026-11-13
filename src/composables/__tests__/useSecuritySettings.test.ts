import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { useSecuritySettings } from '@/composables/encryption/useSecuritySettings'

const mocks = vi.hoisted(() => ({
  exportKeys: vi.fn(),
  store: {} as Record<string, unknown>
}))

vi.mock('@/composables/encryption/useKeyExport', async () => {
  const { ref: refImpl } = await import('vue')
  return { useKeyExport: () => ({ isExporting: refImpl(false), exportKeys: mocks.exportKeys }) }
})

vi.mock('@/stores/domains/settings/encryption', () => ({
  useEncryptionStore: () => mocks.store
}))

// 与真实 Pinia store 一致：对外暴露的是解包后的值（reactive 代理），而不是 Ref 本身
const encryptionState = reactive({
  encryptionEnabled: false,
  securityKeyConfigured: false,
  backupEnabled: false,
  backupVersion: '',
  backupKeyCount: 0,
  loading: false,
  loadEncryptionStatus: vi.fn(),
  loadBackupStatus: vi.fn(),
  markSecurityKeyConfigured: vi.fn()
})
mocks.store = encryptionState as unknown as Record<string, unknown>

describe('useSecuritySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    encryptionState.encryptionEnabled = false
    encryptionState.backupEnabled = false
    encryptionState.backupVersion = ''
    encryptionState.backupKeyCount = 0
  })

  it('未开启备份时不给出备份摘要', () => {
    const { backupInfo } = useSecuritySettings()
    expect(backupInfo.value).toBeNull()
  })

  it('开启备份后汇总版本与密钥条数，空版本归一为 null', () => {
    encryptionState.backupEnabled = true
    encryptionState.backupVersion = '7'
    encryptionState.backupKeyCount = 42

    const { backupInfo } = useSecuritySettings()
    expect(backupInfo.value).toEqual({ version: '7', count: 42 })

    encryptionState.backupVersion = ''
    expect(backupInfo.value).toEqual({ version: null, count: 42 })
  })

  it('未开启加密时直接返回 encryption-disabled，且不触发 SDK 导出', async () => {
    const { exportRecoveryKeys } = useSecuritySettings()
    await expect(exportRecoveryKeys('keys.json')).resolves.toEqual({
      ok: false,
      reason: 'encryption-disabled'
    })
    expect(mocks.exportKeys).not.toHaveBeenCalled()
  })

  it('加密开启但 SDK 无内容时返回 empty', async () => {
    encryptionState.encryptionEnabled = true
    mocks.exportKeys.mockResolvedValue('')

    const { exportRecoveryKeys } = useSecuritySettings()
    await expect(exportRecoveryKeys('keys.json')).resolves.toEqual({ ok: false, reason: 'empty' })
    expect(mocks.exportKeys).toHaveBeenCalledWith('keys.json')
  })

  it('导出成功返回 ok', async () => {
    encryptionState.encryptionEnabled = true
    mocks.exportKeys.mockResolvedValue('{"rooms":{}}')

    const { exportRecoveryKeys } = useSecuritySettings()
    await expect(exportRecoveryKeys('keys.json')).resolves.toEqual({ ok: true })
  })

  it('SDK 异常向上抛出，由调用方决定提示', async () => {
    encryptionState.encryptionEnabled = true
    mocks.exportKeys.mockRejectedValue(new Error('boom'))

    const { exportRecoveryKeys } = useSecuritySettings()
    await expect(exportRecoveryKeys('keys.json')).rejects.toThrow('boom')
  })
})
