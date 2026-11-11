import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const mocks = vi.hoisted(() => {
  const store = {
    cryptoInitFailed: false,
    backupEnabled: true,
    crossSigningKeysLocalOnly: false,
    loaded: true,
    loadEncryptionStatus: vi.fn()
  }
  return {
    isRoomEncrypted: vi.fn(),
    loadEncryptionStatus: store.loadEncryptionStatus,
    store
  }
})

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  matrixCryptoService: { isRoomEncrypted: mocks.isRoomEncrypted }
}))

vi.mock('@/stores/domains/settings/encryption', () => ({
  useEncryptionStore: () => mocks.store
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

import { useRoomEncryptionStatus } from '../useRoomEncryptionStatus'

describe('useRoomEncryptionStatus', () => {
  beforeEach(() => {
    mocks.isRoomEncrypted.mockReset().mockResolvedValue(true)
    mocks.loadEncryptionStatus.mockReset().mockResolvedValue(undefined)
    Object.assign(mocks.store, {
      cryptoInitFailed: false,
      backupEnabled: true,
      crossSigningKeysLocalOnly: false,
      loaded: true
    })
  })

  it('已加密且备份就绪时不产生告警', async () => {
    const { warnings, reload } = useRoomEncryptionStatus(ref('!a:test'))
    await reload()
    expect(warnings.value).toEqual([])
  })

  it('备份未开启时产生 backup_disabled', async () => {
    mocks.store.backupEnabled = false
    const { warnings, reload } = useRoomEncryptionStatus(ref('!a:test'))
    await reload()
    expect(warnings.value).toContain('backup_disabled')
  })

  it('私钥仅存本机时产生 keys_local_only', async () => {
    mocks.store.crossSigningKeysLocalOnly = true
    const { warnings, reload } = useRoomEncryptionStatus(ref('!a:test'))
    await reload()
    expect(warnings.value).toContain('keys_local_only')
  })

  it('房间未加密时不产生任何告警', async () => {
    mocks.isRoomEncrypted.mockResolvedValue(false)
    mocks.store.backupEnabled = false
    const { warnings, reload, isEncrypted } = useRoomEncryptionStatus(ref('!a:test'))
    await reload()
    expect(isEncrypted.value).toBe(false)
    expect(warnings.value).toEqual([])
  })

  it('状态未加载时会触发一次 loadEncryptionStatus', async () => {
    mocks.store.loaded = false
    const { reload } = useRoomEncryptionStatus(ref('!a:test'))
    await reload()
    expect(mocks.loadEncryptionStatus).toHaveBeenCalledTimes(1)
  })
})
