import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeviceSessions } from '../useDeviceSessions'

const {
  getCurrentSessionContextMock,
  getDevicesMock,
  getCurrentDeviceIdMock,
  deleteDeviceMock,
  deleteDevicesMock,
  updateDeviceMock,
  isDeviceVerifiedMock,
  startSasVerificationMock
} = vi.hoisted(() => ({
  getCurrentSessionContextMock: vi.fn(),
  getDevicesMock: vi.fn(),
  getCurrentDeviceIdMock: vi.fn(),
  deleteDeviceMock: vi.fn(),
  deleteDevicesMock: vi.fn(),
  updateDeviceMock: vi.fn(),
  isDeviceVerifiedMock: vi.fn(),
  startSasVerificationMock: vi.fn()
}))

vi.mock('@/services/matrix/crypto/MatrixEncryptionContextService', () => ({
  matrixEncryptionContextService: {
    getCurrentSessionContext: () => getCurrentSessionContextMock()
  }
}))

vi.mock('@/services/matrix/crypto/MatrixVerificationService', () => ({
  matrixVerificationService: {
    isDeviceVerified: (...args: unknown[]) => isDeviceVerifiedMock(...args),
    startSasVerification: (...args: unknown[]) => startSasVerificationMock(...args)
  }
}))

vi.mock('@/services/matrix/user/MatrixDeviceService', () => ({
  matrixDeviceService: {
    getDevices: () => getDevicesMock(),
    getCurrentDeviceId: () => getCurrentDeviceIdMock(),
    deleteDevice: (deviceId: string) => deleteDeviceMock(deviceId),
    deleteDevices: (deviceIds: string[]) => deleteDevicesMock(deviceIds),
    updateDevice: (deviceId: string, displayName: string) => updateDeviceMock(deviceId, displayName)
  }
}))

describe('useDeviceSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentSessionContextMock.mockReturnValue({ userId: '@alice:example.com', deviceId: 'CURRENT' })
    getCurrentDeviceIdMock.mockReturnValue('CURRENT')
    getDevicesMock.mockResolvedValue([
      { device_id: 'CURRENT', display_name: 'This device', last_seen_ts: 1000, last_seen_ip: '10.0.0.1' },
      { deviceId: 'OTHER', displayName: 'Laptop', lastSeenTs: 2000, lastSeenIp: '10.0.0.2' }
    ])
    isDeviceVerifiedMock.mockImplementation(async (_userId: string, deviceId: string) => deviceId === 'CURRENT')
  })

  it('把会话行归一化为统一字段并补全验证状态', async () => {
    const { devices, currentDeviceId, otherDevices, isCurrentDevice, loadDevices } = useDeviceSessions()

    await expect(loadDevices()).resolves.toBe(true)

    expect(currentDeviceId.value).toBe('CURRENT')
    expect(devices.value).toEqual([
      {
        deviceId: 'CURRENT',
        displayName: 'This device',
        lastSeenTs: 1000,
        lastSeenIp: '10.0.0.1',
        isVerified: true
      },
      {
        deviceId: 'OTHER',
        displayName: 'Laptop',
        lastSeenTs: 2000,
        lastSeenIp: '10.0.0.2',
        isVerified: false
      }
    ])
    expect(otherDevices.value.map((device) => device.deviceId)).toEqual(['OTHER'])
    expect(isCurrentDevice('CURRENT')).toBe(true)
    expect(isCurrentDevice('OTHER')).toBe(false)
  })

  it('会话拉取失败时返回 false 并清空列表', async () => {
    getDevicesMock.mockRejectedValue(new Error('network down'))
    const { devices, loadDevices } = useDeviceSessions()

    await expect(loadDevices()).resolves.toBe(false)
    expect(devices.value).toEqual([])
  })

  it('单设备验证状态读取失败时按未验证处理', async () => {
    isDeviceVerifiedMock.mockRejectedValue(new Error('crypto unavailable'))
    const { devices, loadDevices } = useDeviceSessions()

    await expect(loadDevices()).resolves.toBe(true)
    expect(devices.value.every((device) => device.isVerified === false)).toBe(true)
  })

  it('无会话用户时不查验证状态，发起验证会拒绝', async () => {
    getCurrentSessionContextMock.mockReturnValue({ userId: null, deviceId: null })
    const { devices, loadDevices, startVerification } = useDeviceSessions()

    await expect(loadDevices()).resolves.toBe(true)
    expect(devices.value.every((device) => device.isVerified === false)).toBe(true)
    expect(isDeviceVerifiedMock).not.toHaveBeenCalled()
    await expect(startVerification('OTHER')).rejects.toThrow()
  })

  it('删除/重命名设备后重新加载列表', async () => {
    const { loadDevices, deleteDevice, deleteDevices, renameDevice } = useDeviceSessions()
    await loadDevices()

    deleteDeviceMock.mockResolvedValue(undefined)
    await deleteDevice('OTHER')
    expect(deleteDeviceMock).toHaveBeenCalledWith('OTHER')
    expect(getDevicesMock).toHaveBeenCalledTimes(2)

    await deleteDevices([])
    expect(deleteDevicesMock).not.toHaveBeenCalled()

    deleteDevicesMock.mockResolvedValue(undefined)
    await deleteDevices(['A', 'B'])
    expect(deleteDevicesMock).toHaveBeenCalledWith(['A', 'B'])

    updateDeviceMock.mockResolvedValue(undefined)
    await renameDevice('CURRENT', 'New name')
    expect(updateDeviceMock).toHaveBeenCalledWith('CURRENT', 'New name')
  })

  it('使用当前会话用户发起 SAS 验证', async () => {
    startSasVerificationMock.mockResolvedValue('tx-1')
    const { loadDevices, startVerification } = useDeviceSessions()
    await loadDevices()

    await expect(startVerification('OTHER')).resolves.toBe('tx-1')
    expect(startSasVerificationMock).toHaveBeenCalledWith('@alice:example.com', 'OTHER')
  })
})
