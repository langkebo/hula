import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getCurrentSessionContextMock,
  getCryptoStatusMock,
  getCrossSigningStatusMock,
  checkKeyBackupMock,
  getKeyRotationStatusMock,
  isDeviceVerifiedMock,
  storeCrossSigningKeysMock
} = vi.hoisted(() => ({
  getCurrentSessionContextMock: vi.fn(),
  getCryptoStatusMock: vi.fn(),
  getCrossSigningStatusMock: vi.fn(),
  checkKeyBackupMock: vi.fn(),
  getKeyRotationStatusMock: vi.fn(),
  isDeviceVerifiedMock: vi.fn(),
  storeCrossSigningKeysMock: vi.fn()
}))

vi.mock('@/services/matrix/crypto/CryptoSDKAdapter', () => ({
  cryptoSDKAdapter: {
    getCrossSigningStatus: getCrossSigningStatusMock,
    storeCrossSigningKeysInSecretStorage: storeCrossSigningKeysMock
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

// Batch 4.1：crypto 生命周期诊断需要经 MatrixClientService 才能到达 store
const { getRustCryptoDebugStateMock, getCryptoLifecycleDiagnosticsMock } = vi.hoisted(() => ({
  getRustCryptoDebugStateMock: vi.fn(),
  getCryptoLifecycleDiagnosticsMock: vi.fn()
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getRustCryptoDebugState: getRustCryptoDebugStateMock,
    getCryptoLifecycleDiagnostics: getCryptoLifecycleDiagnosticsMock
  }
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

  /**
   * R-2（2026-10-12）：「已建立交叉签名但私钥没进 4S」必须被单独识别出来，
   * 否则 UI 无法给出「立即存入密钥存储」的可操作提示。
   */
  it('R-2：私钥只在本机 ⇒ crossSigningKeysLocalOnly=true', async () => {
    getCrossSigningStatusMock.mockResolvedValue({
      isSetup: false,
      privateKeysInSecretStorage: false,
      privateKeysCachedLocally: true
    })
    const store = useEncryptionStore()
    await store.loadCrossSigningStatus()
    expect(store.crossSigningKeysInSecretStorage).toBe(false)
    expect(store.crossSigningKeysLocalOnly).toBe(true)
  })

  it('R-2：私钥已入 4S ⇒ crossSigningKeysLocalOnly=false（不误报）', async () => {
    getCrossSigningStatusMock.mockResolvedValue({
      isSetup: true,
      privateKeysInSecretStorage: true,
      privateKeysCachedLocally: true
    })
    const store = useEncryptionStore()
    await store.loadCrossSigningStatus()
    expect(store.crossSigningKeysInSecretStorage).toBe(true)
    expect(store.crossSigningKeysLocalOnly).toBe(false)
  })

  it('R-2：本机没有私钥（从未建立交叉签名）⇒ 不提示', async () => {
    getCrossSigningStatusMock.mockResolvedValue({
      isSetup: false,
      privateKeysInSecretStorage: false,
      privateKeysCachedLocally: false
    })
    const store = useEncryptionStore()
    await store.loadCrossSigningStatus()
    expect(store.crossSigningKeysLocalOnly).toBe(false)
  })

  it('R-2：查询失败时三个字段一并降级为 false（不报假警报）', async () => {
    getCrossSigningStatusMock.mockRejectedValue(new Error('x'))
    const store = useEncryptionStore()
    store.crossSigningKeysInSecretStorage = true
    store.crossSigningKeysLocalOnly = true
    await store.loadCrossSigningStatus()
    expect(store.crossSigningKeysInSecretStorage).toBe(false)
    expect(store.crossSigningKeysLocalOnly).toBe(false)
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

describe('useEncryptionStore · R-2 storeCrossSigningKeysInSecretStorage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('stored ⇒ 委托适配层并刷新交叉签名状态（否则警告会一直挂着）', async () => {
    storeCrossSigningKeysMock.mockResolvedValue('stored')
    getCrossSigningStatusMock.mockResolvedValue({
      isSetup: true,
      privateKeysInSecretStorage: true,
      privateKeysCachedLocally: true
    })
    const store = useEncryptionStore()
    store.crossSigningKeysLocalOnly = true

    await expect(store.storeCrossSigningKeysInSecretStorage()).resolves.toBe('stored')

    expect(getCrossSigningStatusMock).toHaveBeenCalled()
    expect(store.crossSigningKeysInSecretStorage).toBe(true)
    expect(store.crossSigningKeysLocalOnly).toBe(false)
  })

  it('already-stored ⇒ 同样刷新状态（幂等路径也要收敛警告）', async () => {
    storeCrossSigningKeysMock.mockResolvedValue('already-stored')
    getCrossSigningStatusMock.mockResolvedValue({
      isSetup: true,
      privateKeysInSecretStorage: true,
      privateKeysCachedLocally: true
    })
    const store = useEncryptionStore()

    await expect(store.storeCrossSigningKeysInSecretStorage()).resolves.toBe('already-stored')
    expect(store.crossSigningKeysInSecretStorage).toBe(true)
  })

  it('needs-setup ⇒ 原样返回且不重读状态（4S 尚未建立，重读没有意义）', async () => {
    storeCrossSigningKeysMock.mockResolvedValue('needs-setup')
    const store = useEncryptionStore()

    await expect(store.storeCrossSigningKeysInSecretStorage()).resolves.toBe('needs-setup')
    expect(getCrossSigningStatusMock).not.toHaveBeenCalled()
  })

  it('failed ⇒ 原样返回，且不得把状态改成"已存入"', async () => {
    storeCrossSigningKeysMock.mockResolvedValue('failed')
    const store = useEncryptionStore()
    store.crossSigningKeysInSecretStorage = false

    await expect(store.storeCrossSigningKeysInSecretStorage()).resolves.toBe('failed')
    expect(store.crossSigningKeysInSecretStorage).toBe(false)
    expect(getCrossSigningStatusMock).not.toHaveBeenCalled()
  })
})

/**
 * Batch 4.1（图谱 §8.5 A5）：crypto 生命周期失配必须**在 store 层可见**，
 * 而不是只在日志里。本组锁定该契约（验收：解绑被拒 / crypto 未就绪 ⇒ store 状态可见）。
 */
describe('useEncryptionStore · crypto 生命周期诊断（Batch 4.1）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    getRustCryptoDebugStateMock.mockReturnValue({
      attempted: false,
      initialized: false,
      skippedReason: null,
      error: null,
      usedIndexedDB: null,
      storeEncrypted: null
    })
    getCryptoLifecycleDiagnosticsMock.mockReturnValue({
      lastBindingReleaseRejection: null,
      stoppedBindingReleased: 0,
      staleCryptoReuseWarning: null
    })
  })

  it('初始 cryptoLifecycleWarning 为 null', () => {
    expect(useEncryptionStore().cryptoLifecycleWarning).toBeNull()
  })

  it('解绑被拒（lastBindingReleaseRejection）⇒ 可见（此前只在日志里）', () => {
    getCryptoLifecycleDiagnosticsMock.mockReturnValue({
      lastBindingReleaseRejection: 'crypto-not-stopped',
      stoppedBindingReleased: 0,
      staleCryptoReuseWarning: null
    })

    const store = useEncryptionStore()
    store.loadCryptoInitStatus()

    expect(store.cryptoLifecycleWarning).toBe('crypto-not-stopped')
  })

  it('A1 复发哨兵优先于拒绝记录（严重度更高：会静默失效）', () => {
    getCryptoLifecycleDiagnosticsMock.mockReturnValue({
      lastBindingReleaseRejection: 'crypto-not-stopped',
      stoppedBindingReleased: 0,
      staleCryptoReuseWarning: 'crypto-stopped-but-still-bound'
    })

    const store = useEncryptionStore()
    store.loadCryptoInitStatus()

    expect(store.cryptoLifecycleWarning).toBe('crypto-stopped-but-still-bound')
  })

  it('crypto 初始化失败仍走 cryptoInitFailed（两条告警面互不干扰）', () => {
    getRustCryptoDebugStateMock.mockReturnValue({
      attempted: true,
      initialized: false,
      skippedReason: null,
      error: 'account mismatch',
      usedIndexedDB: true,
      storeEncrypted: null
    })

    const store = useEncryptionStore()
    store.loadCryptoInitStatus()

    expect(store.cryptoInitFailed).toBe(true)
    expect(store.cryptoInitError).toBe('account mismatch')
    // 生命周期诊断此时为空 ⇒ 不产生额外告警
    expect(store.cryptoLifecycleWarning).toBeNull()
  })

  it('恢复正常后再次刷新 ⇒ 诊断清空（不留下过期告警）', () => {
    getCryptoLifecycleDiagnosticsMock.mockReturnValueOnce({
      lastBindingReleaseRejection: 'crypto-not-stopped',
      stoppedBindingReleased: 0,
      staleCryptoReuseWarning: null
    })
    const store = useEncryptionStore()
    store.loadCryptoInitStatus()
    expect(store.cryptoLifecycleWarning).toBe('crypto-not-stopped')

    store.loadCryptoInitStatus()

    expect(store.cryptoLifecycleWarning).toBeNull()
  })
})
