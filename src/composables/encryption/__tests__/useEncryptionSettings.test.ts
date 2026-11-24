import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEncryptionSettings } from '../useEncryptionSettings'

const mocks = vi.hoisted(() => ({
  loadOverview: vi.fn(),
  loadDevices: vi.fn(),
  deleteDevice: vi.fn(),
  startVerification: vi.fn(),
  getDeviceFingerprint: vi.fn(),
  getPendingVerifications: vi.fn(),
  cancelVerification: vi.fn(),
  setStrictMode: vi.fn(),
  loggerError: vi.fn(),
  devicesRef: null as unknown as {
    value: Array<{ deviceId: string; isVerified: boolean; crossSigningVerified: boolean }>
  }
}))

vi.mock('../useEncryptionOverview', async () => {
  const { ref: refImpl } = await import('vue')
  return {
    useEncryptionOverview: () => ({
      encryptionEnabled: refImpl(false),
      deviceVerified: refImpl(false),
      backupEnabled: refImpl(false),
      backupVersion: refImpl(''),
      crossSigningSetup: refImpl(false),
      needsRotation: refImpl(false),
      e2eeFullySetup: refImpl(false),
      loadOverview: mocks.loadOverview,
      refreshBackup: vi.fn(),
      refreshRotationStatus: vi.fn(),
      markSecurityKeyConfigured: vi.fn()
    })
  }
})

vi.mock('../useDeviceSessions', async () => {
  const { ref: refImpl } = await import('vue')
  mocks.devicesRef = refImpl([])
  return {
    useDeviceSessions: () => ({
      loading: refImpl(false),
      devices: mocks.devicesRef,
      currentDeviceId: refImpl('CURRENT'),
      loadDevices: mocks.loadDevices,
      deleteDevice: mocks.deleteDevice,
      startVerification: mocks.startVerification
    })
  }
})

vi.mock('../useGlobalStrictMode', async () => {
  const { ref: refImpl } = await import('vue')
  return {
    useGlobalStrictMode: () => ({
      enabled: refImpl(false),
      setEnabled: mocks.setStrictMode
    })
  }
})

vi.mock('../useEncryption', () => ({
  useEncryption: () => ({
    getDeviceFingerprint: mocks.getDeviceFingerprint,
    getPendingVerifications: mocks.getPendingVerifications,
    cancelVerification: mocks.cancelVerification
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: mocks.loggerError })
}))

const pendingTransaction = {
  transactionId: 'tx-1',
  deviceId: 'OTHER',
  userId: '@alice:example.com',
  methods: ['m.sas.v1' as const],
  timestamp: 1000
}

describe('useEncryptionSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.devicesRef.value = [
      { deviceId: 'CURRENT', isVerified: true, crossSigningVerified: true },
      { deviceId: 'OTHER', isVerified: false, crossSigningVerified: false },
      // 本机手动标记（isVerified=true）不等于身份已验证，不计入「已验证设备」
      { deviceId: 'THIRD', isVerified: true, crossSigningVerified: false }
    ]
    mocks.loadOverview.mockResolvedValue(true)
    mocks.loadDevices.mockResolvedValue(true)
    mocks.getDeviceFingerprint.mockResolvedValue('ABCD1234EFGH5678')
    mocks.getPendingVerifications.mockResolvedValue([pendingTransaction])
    mocks.cancelVerification.mockResolvedValue(undefined)
  })

  it('默认刷新只加载总览与设备列表，不触碰桌面端专属详情', async () => {
    const { refreshEncryptionSettings } = useEncryptionSettings()

    await expect(refreshEncryptionSettings()).resolves.toEqual({
      encryptionEnabled: true,
      devicesLoaded: true
    })
    expect(mocks.loadOverview).toHaveBeenCalledTimes(1)
    expect(mocks.loadDevices).toHaveBeenCalledTimes(1)
    expect(mocks.getDeviceFingerprint).not.toHaveBeenCalled()
    expect(mocks.getPendingVerifications).not.toHaveBeenCalled()
  })

  it('加密启用时按需加载并格式化本机指纹与待处理验证', async () => {
    const { refreshEncryptionSettings, deviceFingerprint, pendingVerifications } = useEncryptionSettings()

    await refreshEncryptionSettings({ includeDeviceDetails: true })

    expect(mocks.getDeviceFingerprint).toHaveBeenCalledTimes(1)
    expect(deviceFingerprint.value).toBe('ABCD 1234 EFGH 5678')
    expect(mocks.getPendingVerifications).toHaveBeenCalledTimes(1)
    expect(pendingVerifications.value).toEqual([pendingTransaction])
  })

  it('加密未启用时跳过设备详情，但仍刷新设备列表', async () => {
    mocks.loadOverview.mockResolvedValue(false)
    const { refreshEncryptionSettings, deviceFingerprint } = useEncryptionSettings()

    await expect(refreshEncryptionSettings({ includeDeviceDetails: true })).resolves.toEqual({
      encryptionEnabled: false,
      devicesLoaded: true
    })
    expect(mocks.getDeviceFingerprint).not.toHaveBeenCalled()
    expect(mocks.getPendingVerifications).not.toHaveBeenCalled()
    expect(deviceFingerprint.value).toBe('')
    expect(mocks.loadDevices).toHaveBeenCalledTimes(1)
  })

  it('设备详情加载失败时记录错误，不影响设备列表刷新', async () => {
    mocks.getPendingVerifications.mockRejectedValue(new Error('crypto store unavailable'))
    const { refreshEncryptionSettings } = useEncryptionSettings()

    await expect(refreshEncryptionSettings({ includeDeviceDetails: true })).resolves.toEqual({
      encryptionEnabled: true,
      devicesLoaded: true
    })
    expect(mocks.loggerError).toHaveBeenCalledTimes(1)
    expect(mocks.loadDevices).toHaveBeenCalledTimes(1)
  })

  it('设备统计与设备列表同源，且只统计交叉签名已验证', () => {
    const { verifiedDevicesCount, unverifiedDevicesCount } = useEncryptionSettings()

    expect(verifiedDevicesCount.value).toBe(1)
    expect(unverifiedDevicesCount.value).toBe(2)
  })

  it('取消待处理验证后从列表移除对应事务', async () => {
    const { pendingVerifications, cancelPendingVerification } = useEncryptionSettings()
    pendingVerifications.value = [pendingTransaction]

    await cancelPendingVerification('tx-1')

    expect(mocks.cancelVerification).toHaveBeenCalledWith('tx-1', 'User cancelled verification')
    expect(pendingVerifications.value).toEqual([])
  })

  it('取消失败时抛出并保留列表', async () => {
    mocks.cancelVerification.mockRejectedValue(new Error('sdk failure'))
    const { pendingVerifications, cancelPendingVerification } = useEncryptionSettings()
    pendingVerifications.value = [pendingTransaction]

    await expect(cancelPendingVerification('tx-1')).rejects.toThrow('sdk failure')
    expect(pendingVerifications.value).toEqual([pendingTransaction])
  })

  it('设备会话动作与严格模式原样透出', () => {
    const { startDeviceVerification, deleteDevice, setStrictMode, strictModeEnabled } = useEncryptionSettings()

    expect(startDeviceVerification).toBe(mocks.startVerification)
    expect(deleteDevice).toBe(mocks.deleteDevice)
    expect(setStrictMode).toBe(mocks.setStrictMode)
    expect(strictModeEnabled.value).toBe(false)
  })
})
