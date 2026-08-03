import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getCurrentSessionContextMock,
  getCryptoStatusMock,
  getCrossSigningStatusMock,
  checkKeyBackupMock,
  getKeyRotationStatusMock,
  isDeviceVerifiedMock
} = vi.hoisted(() => ({
  getCurrentSessionContextMock: vi.fn(),
  getCryptoStatusMock: vi.fn(),
  getCrossSigningStatusMock: vi.fn(),
  checkKeyBackupMock: vi.fn(),
  getKeyRotationStatusMock: vi.fn(),
  isDeviceVerifiedMock: vi.fn()
}))

vi.mock('@/services/matrix/crypto/CryptoSDKAdapter', () => ({
  cryptoSDKAdapter: {
    getCrossSigningStatus: getCrossSigningStatusMock
  }
}))

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  matrixCryptoService: {
    getCryptoStatus: getCryptoStatusMock
  }
}))

vi.mock('@/services/matrix/crypto/MatrixEncryptionContextService', () => ({
  matrixEncryptionContextService: {
    getCurrentSessionContext: getCurrentSessionContextMock
  }
}))

vi.mock('@/services/matrix/crypto/MatrixEncryptionService', () => ({
  matrixEncryptionService: {
    getKeyRotationStatus: getKeyRotationStatusMock
  }
}))

vi.mock('@/services/matrix/crypto/MatrixKeyBackupService', () => ({
  matrixKeyBackupService: {
    checkKeyBackup: checkKeyBackupMock
  }
}))

vi.mock('@/services/matrix/crypto/MatrixVerificationService', () => ({
  matrixVerificationService: {
    isDeviceVerified: isDeviceVerifiedMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

import { useEncryptionStore } from '../encryption'

describe('useEncryptionStore · 初始 state 与 getters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('初始状态全部为 false / 默认值', () => {
    const store = useEncryptionStore()
    expect(store.encryptionEnabled).toBe(false)
    expect(store.securityKeyConfigured).toBe(false)
    expect(store.crossSigningSetup).toBe(false)
    expect(store.backupEnabled).toBe(false)
    expect(store.backupVersion).toBe('')
    expect(store.backupKeyCount).toBe(0)
    expect(store.deviceVerified).toBe(false)
    expect(store.needsRotation).toBe(false)
    expect(store.loading).toBe(false)
    expect(store.loaded).toBe(false)
  })

  it('e2eeFullySetup 默认为 false', () => {
    const store = useEncryptionStore()
    expect(store.e2eeFullySetup).toBe(false)
  })

  it('setupProgress 默认进度 0/4 (0%)', () => {
    const store = useEncryptionStore()
    expect(store.setupProgress).toEqual({ completed: 0, total: 4, percentage: 0 })
  })

  it('e2eeFullySetup 仅当四个标志位均为 true 时为 true', async () => {
    const store = useEncryptionStore()
    store.markSecurityKeyConfigured()
    store.markCrossSigningSetup()
    store.markBackupEnabled('v1', 10)
    // 还差 encryptionEnabled
    expect(store.e2eeFullySetup).toBe(false)

    // 直接打开 encryptionEnabled（模拟 context 已加载）
    store.encryptionEnabled = true
    expect(store.e2eeFullySetup).toBe(true)
  })

  it('setupProgress 随各标志位累加，并按 25% 递增', () => {
    const store = useEncryptionStore()
    expect(store.setupProgress.percentage).toBe(0)

    store.encryptionEnabled = true
    expect(store.setupProgress).toEqual({ completed: 1, total: 4, percentage: 25 })

    store.securityKeyConfigured = true
    expect(store.setupProgress.percentage).toBe(50)

    store.crossSigningSetup = true
    expect(store.setupProgress.percentage).toBe(75)

    store.backupEnabled = true
    expect(store.setupProgress).toEqual({ completed: 4, total: 4, percentage: 100 })
  })
})

describe('useEncryptionStore · mark* actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('markSecurityKeyConfigured 置位 securityKeyConfigured', () => {
    const store = useEncryptionStore()
    expect(store.securityKeyConfigured).toBe(false)
    store.markSecurityKeyConfigured()
    expect(store.securityKeyConfigured).toBe(true)
  })

  it('markCrossSigningSetup 置位 crossSigningSetup', () => {
    const store = useEncryptionStore()
    expect(store.crossSigningSetup).toBe(false)
    store.markCrossSigningSetup()
    expect(store.crossSigningSetup).toBe(true)
  })

  it('markBackupEnabled 置位并可写入 version / count', () => {
    const store = useEncryptionStore()
    store.markBackupEnabled('v2', 42)
    expect(store.backupEnabled).toBe(true)
    expect(store.backupVersion).toBe('v2')
    expect(store.backupKeyCount).toBe(42)
  })

  it('markBackupEnabled 不传 version/count 时保留原值', () => {
    const store = useEncryptionStore()
    store.markBackupEnabled('v2', 42)
    store.markBackupEnabled()
    expect(store.backupVersion).toBe('v2')
    expect(store.backupKeyCount).toBe(42)
  })

  it('markDeviceVerified 置位 deviceVerified', () => {
    const store = useEncryptionStore()
    expect(store.deviceVerified).toBe(false)
    store.markDeviceVerified()
    expect(store.deviceVerified).toBe(true)
  })
})

describe('useEncryptionStore · loadEncryptionStatus', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('加密未开启时仅设置 encryptionEnabled 与 loaded，不调用子加载器', async () => {
    getCurrentSessionContextMock.mockReturnValue({ isCryptoEnabled: false })

    const store = useEncryptionStore()
    await store.loadEncryptionStatus()

    expect(store.encryptionEnabled).toBe(false)
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
    expect(getCryptoStatusMock).not.toHaveBeenCalled()
    expect(getCrossSigningStatusMock).not.toHaveBeenCalled()
    expect(checkKeyBackupMock).not.toHaveBeenCalled()
    expect(getKeyRotationStatusMock).not.toHaveBeenCalled()
  })

  it('加密开启时并行加载四项状态并设置 loaded', async () => {
    getCurrentSessionContextMock.mockReturnValue({ isCryptoEnabled: true })
    getCryptoStatusMock.mockResolvedValue({ crossSigningReady: true })
    getCrossSigningStatusMock.mockResolvedValue({ isSetup: true })
    checkKeyBackupMock.mockResolvedValue({ version: 'v1', count: 5 })
    getKeyRotationStatusMock.mockResolvedValue({ needsRotation: true })

    const store = useEncryptionStore()
    await store.loadEncryptionStatus()

    expect(store.encryptionEnabled).toBe(true)
    expect(store.securityKeyConfigured).toBe(true)
    expect(store.crossSigningSetup).toBe(true)
    expect(store.backupEnabled).toBe(true)
    expect(store.backupVersion).toBe('v1')
    expect(store.backupKeyCount).toBe(5)
    expect(store.needsRotation).toBe(true)
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('子加载器抛错时降级为 false，最终 loaded 仍为 true', async () => {
    getCurrentSessionContextMock.mockReturnValue({ isCryptoEnabled: true })
    getCryptoStatusMock.mockRejectedValue(new Error('boom'))
    getCrossSigningStatusMock.mockRejectedValue(new Error('boom'))
    checkKeyBackupMock.mockRejectedValue(new Error('boom'))
    getKeyRotationStatusMock.mockRejectedValue(new Error('boom'))

    const store = useEncryptionStore()
    await store.loadEncryptionStatus()

    expect(store.securityKeyConfigured).toBe(false)
    expect(store.crossSigningSetup).toBe(false)
    expect(store.backupEnabled).toBe(false)
    expect(store.needsRotation).toBe(false)
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('并发调用时通过 loading 标志去重（已加载时直接返回）', async () => {
    getCurrentSessionContextMock.mockReturnValue({ isCryptoEnabled: false })

    const store = useEncryptionStore()
    // 模拟正在加载中
    store.loading = true

    await store.loadEncryptionStatus()

    // 进入时 loading=true 应直接 return，不会调用 context
    expect(getCurrentSessionContextMock).not.toHaveBeenCalled()
  })
})

describe('useEncryptionStore · 子加载器', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loadSecurityKeyStatus 读取 cryptoStatus.crossSigningReady', async () => {
    getCryptoStatusMock.mockResolvedValue({ crossSigningReady: true })
    const store = useEncryptionStore()
    await store.loadSecurityKeyStatus()
    expect(store.securityKeyConfigured).toBe(true)
  })

  it('loadSecurityKeyStatus 失败时置 false', async () => {
    getCryptoStatusMock.mockRejectedValue(new Error('x'))
    const store = useEncryptionStore()
    store.securityKeyConfigured = true
    await store.loadSecurityKeyStatus()
    expect(store.securityKeyConfigured).toBe(false)
  })

  it('loadCrossSigningStatus 读取 isSetup 字段', async () => {
    getCrossSigningStatusMock.mockResolvedValue({ isSetup: true })
    const store = useEncryptionStore()
    await store.loadCrossSigningStatus()
    expect(store.crossSigningSetup).toBe(true)
  })

  it('loadCrossSigningStatus 失败时置 false', async () => {
    getCrossSigningStatusMock.mockRejectedValue(new Error('x'))
    const store = useEncryptionStore()
    store.crossSigningSetup = true
    await store.loadCrossSigningStatus()
    expect(store.crossSigningSetup).toBe(false)
  })

  it('loadBackupStatus 收到 backupInfo 时写入 version / count', async () => {
    checkKeyBackupMock.mockResolvedValue({ version: 'v9', count: 100 })
    const store = useEncryptionStore()
    await store.loadBackupStatus()
    expect(store.backupEnabled).toBe(true)
    expect(store.backupVersion).toBe('v9')
    expect(store.backupKeyCount).toBe(100)
  })

  it('loadBackupStatus 收到 null 时关闭 backupEnabled', async () => {
    checkKeyBackupMock.mockResolvedValue(null)
    const store = useEncryptionStore()
    store.backupEnabled = true
    store.backupVersion = 'old'
    store.backupKeyCount = 5
    await store.loadBackupStatus()
    expect(store.backupEnabled).toBe(false)
  })

  it('loadBackupStatus 失败时关闭 backupEnabled', async () => {
    checkKeyBackupMock.mockRejectedValue(new Error('x'))
    const store = useEncryptionStore()
    store.backupEnabled = true
    await store.loadBackupStatus()
    expect(store.backupEnabled).toBe(false)
  })

  it('loadRotationStatus 写入 needsRotation', async () => {
    getKeyRotationStatusMock.mockResolvedValue({ needsRotation: true })
    const store = useEncryptionStore()
    await store.loadRotationStatus()
    expect(store.needsRotation).toBe(true)
  })

  it('loadRotationStatus 失败时置 false', async () => {
    getKeyRotationStatusMock.mockRejectedValue(new Error('x'))
    const store = useEncryptionStore()
    store.needsRotation = true
    await store.loadRotationStatus()
    expect(store.needsRotation).toBe(false)
  })
})

describe('useEncryptionStore · loadDeviceVerification', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('context 含 userId/deviceId 时调用 isDeviceVerified', async () => {
    getCurrentSessionContextMock.mockReturnValue({ userId: '@u:home', deviceId: 'DEV1' })
    isDeviceVerifiedMock.mockResolvedValue(true)

    const store = useEncryptionStore()
    await store.loadDeviceVerification()

    expect(isDeviceVerifiedMock).toHaveBeenCalledWith('@u:home', 'DEV1')
    expect(store.deviceVerified).toBe(true)
  })

  it('context 缺少 userId/deviceId 时不调用 isDeviceVerified', async () => {
    getCurrentSessionContextMock.mockReturnValue({ userId: '', deviceId: '' })
    const store = useEncryptionStore()
    await store.loadDeviceVerification()
    expect(isDeviceVerifiedMock).not.toHaveBeenCalled()
  })

  it('isDeviceVerified 抛错时置 false', async () => {
    getCurrentSessionContextMock.mockReturnValue({ userId: '@u:home', deviceId: 'DEV1' })
    isDeviceVerifiedMock.mockRejectedValue(new Error('x'))
    const store = useEncryptionStore()
    store.deviceVerified = true
    await store.loadDeviceVerification()
    expect(store.deviceVerified).toBe(false)
  })
})
