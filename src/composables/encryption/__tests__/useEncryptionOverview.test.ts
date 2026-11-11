import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEncryptionOverview } from '../useEncryptionOverview'

const { storeRef, loadEncryptionStatusMock, loadDeviceVerificationMock, loadBackupStatusMock } = vi.hoisted(() => ({
  loadEncryptionStatusMock: vi.fn(),
  loadDeviceVerificationMock: vi.fn(),
  loadBackupStatusMock: vi.fn(),
  storeRef: { current: null as Record<string, any> | null }
}))

vi.mock('@/stores/domains/settings/encryption', async () => {
  const { reactive } = await import('vue')
  const store = reactive({
    encryptionEnabled: false,
    deviceVerified: false,
    backupEnabled: false,
    backupVersion: '',
    crossSigningSetup: false,
    needsRotation: false,
    e2eeFullySetup: false,
    loading: false,
    loadEncryptionStatus: loadEncryptionStatusMock,
    loadDeviceVerification: loadDeviceVerificationMock,
    loadBackupStatus: loadBackupStatusMock
  })
  storeRef.current = store
  return { useEncryptionStore: () => store }
})

describe('useEncryptionOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const store = storeRef.current!
    store.encryptionEnabled = false
    store.deviceVerified = false
    store.backupEnabled = false
    store.backupVersion = ''
    store.crossSigningSetup = false
    store.needsRotation = false
    store.e2eeFullySetup = false
    store.loading = false
  })

  it('加密未启用时只读加密状态，不再读设备验证', async () => {
    loadEncryptionStatusMock.mockResolvedValue(undefined)

    const { loadOverview } = useEncryptionOverview()

    await expect(loadOverview()).resolves.toBe(false)
    expect(loadEncryptionStatusMock).toHaveBeenCalledTimes(1)
    expect(loadDeviceVerificationMock).not.toHaveBeenCalled()
  })

  it('加密启用后继续读取当前设备验证状态', async () => {
    loadEncryptionStatusMock.mockImplementation(async () => {
      const store = storeRef.current!
      store.encryptionEnabled = true
      store.backupEnabled = true
      store.crossSigningSetup = true
    })
    loadDeviceVerificationMock.mockImplementation(async () => {
      storeRef.current!.deviceVerified = true
    })

    const overview = useEncryptionOverview()

    await expect(overview.loadOverview()).resolves.toBe(true)
    expect(loadDeviceVerificationMock).toHaveBeenCalledTimes(1)
    expect(overview.encryptionEnabled.value).toBe(true)
    expect(overview.deviceVerified.value).toBe(true)
    expect(overview.backupEnabled.value).toBe(true)
    expect(overview.crossSigningSetup.value).toBe(true)
  })

  it('状态字段与 store 保持同一引用来源', () => {
    const store = storeRef.current!
    store.backupVersion = 'v9'
    store.needsRotation = true
    store.e2eeFullySetup = true
    store.loading = true

    const overview = useEncryptionOverview()

    expect(overview.backupVersion.value).toBe('v9')
    expect(overview.needsRotation.value).toBe(true)
    expect(overview.e2eeFullySetup.value).toBe(true)
    expect(overview.loading.value).toBe(true)
  })

  it('备份与设备验证刷新分别调用 store 的对应动作', async () => {
    const overview = useEncryptionOverview()

    await overview.refreshBackup()
    await overview.refreshDeviceVerification()

    expect(loadBackupStatusMock).toHaveBeenCalledTimes(1)
    expect(loadDeviceVerificationMock).toHaveBeenCalledTimes(1)
  })
})
