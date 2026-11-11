import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => {
  const store = {
    cryptoInitFailed: false,
    backupEnabled: true,
    crossSigningKeysLocalOnly: false,
    loaded: true,
    loadEncryptionStatus: vi.fn()
  }
  return {
    getRoomEncryptionState: vi.fn(),
    loadEncryptionStatus: store.loadEncryptionStatus,
    store
  }
})

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  matrixCryptoService: { getRoomEncryptionState: mocks.getRoomEncryptionState }
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
    mocks.getRoomEncryptionState.mockReset().mockResolvedValue('encrypted')
    mocks.loadEncryptionStatus.mockReset().mockResolvedValue(undefined)
    Object.assign(mocks.store, {
      cryptoInitFailed: false,
      backupEnabled: true,
      crossSigningKeysLocalOnly: false,
      loaded: true
    })
  })

  afterEach(() => {
    vi.useRealTimers()
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
    mocks.getRoomEncryptionState.mockResolvedValue('plaintext')
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

  it('状态已加载时不重复请求 loadEncryptionStatus', async () => {
    const { reload } = useRoomEncryptionStatus(ref('!a:test'))
    await reload()
    expect(mocks.loadEncryptionStatus).not.toHaveBeenCalled()
  })

  it('加密状态未加载时不误报备份/私钥告警', async () => {
    mocks.store.loaded = false
    mocks.store.backupEnabled = false
    mocks.store.crossSigningKeysLocalOnly = true
    const { warnings, reload } = useRoomEncryptionStatus(ref('!a:test'))
    await reload()
    expect(warnings.value).toEqual([])
  })

  it('加密状态未加载时仍可展示 crypto_init_failed', async () => {
    mocks.store.loaded = false
    mocks.store.cryptoInitFailed = true
    mocks.store.backupEnabled = false
    const { warnings, reload } = useRoomEncryptionStatus(ref('!a:test'))
    await reload()
    expect(warnings.value).toEqual(['crypto_init_failed'])
  })

  it('空 roomId 不发请求也不产生告警', async () => {
    const { warnings, reload } = useRoomEncryptionStatus(ref(''))
    await reload()
    expect(mocks.getRoomEncryptionState).not.toHaveBeenCalled()
    expect(warnings.value).toEqual([])
  })

  it('unknown 状态会有限重试，恢复 encrypted 后停止', async () => {
    vi.useFakeTimers()
    mocks.getRoomEncryptionState
      .mockResolvedValueOnce('unknown')
      .mockResolvedValueOnce('unknown')
      .mockResolvedValue('encrypted')

    const { warnings, reload } = useRoomEncryptionStatus(ref('!a:test'))
    await reload()
    expect(mocks.getRoomEncryptionState).toHaveBeenCalledTimes(1)
    expect(warnings.value).toEqual([])

    await vi.advanceTimersByTimeAsync(1000)
    expect(mocks.getRoomEncryptionState).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1000)
    expect(mocks.getRoomEncryptionState).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(5000)
    expect(mocks.getRoomEncryptionState).toHaveBeenCalledTimes(3)
  })

  it('切换房间会取消上一房间的待执行重试', async () => {
    vi.useFakeTimers()
    mocks.getRoomEncryptionState.mockImplementation(async (id: string) => (id === '!a:test' ? 'unknown' : 'encrypted'))

    const roomId = ref('!a:test')
    const { reload } = useRoomEncryptionStatus(roomId)
    await reload()
    expect(mocks.getRoomEncryptionState).toHaveBeenCalledTimes(1)

    roomId.value = '!b:test'
    await nextTick()
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.getRoomEncryptionState).toHaveBeenLastCalledWith('!b:test')

    const callCount = mocks.getRoomEncryptionState.mock.calls.length
    await vi.advanceTimersByTimeAsync(3000)
    expect(mocks.getRoomEncryptionState).toHaveBeenCalledTimes(callCount)
    expect(mocks.getRoomEncryptionState.mock.calls.filter(([id]) => id === '!a:test')).toHaveLength(1)
  })
})
