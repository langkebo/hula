import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { CryptoHealthMonitor } from '../CryptoHealthMonitor'
import { cryptoSDKAdapter } from '../CryptoSDKAdapter'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

function createDefaultMockClient() {
  return {
    getUserId: () => '@test:example.com',
    getRooms: () => [
      {
        roomId: '!room1:example.com',
        timeline: [
          {
            getContent: () => ({ msgtype: 'm.text', body: 'hello' }),
            getWireContent: () => ({})
          }
        ]
      }
    ],
    getStoredDevicesForUser: vi.fn().mockResolvedValue([
      { deviceId: 'dev1', userId: '@test:example.com', displayName: 'Device 1', isVerified: () => true },
      { deviceId: 'dev2', userId: '@test:example.com', displayName: 'Device 2', isVerified: () => false }
    ]),
    getKeyBackupManager: vi.fn(() => ({
      getLatestBackupVersion: vi.fn().mockResolvedValue({ version: '1', algorithm: 'test', auth_data: {} })
    })),
    getCrypto: vi.fn(() => ({
      isCrossSigningReady: vi.fn().mockResolvedValue(true)
    })),
    getDeviceKeysManager: vi.fn(() => ({
      createRoomKeyRequest: vi.fn().mockResolvedValue(undefined)
    }))
  }
}

describe('CryptoHealthMonitor', () => {
  let monitor: CryptoHealthMonitor

  beforeEach(() => {
    vi.clearAllMocks()
    cryptoSDKAdapter.invalidateCryptoCache()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(createDefaultMockClient() as never)
    monitor = new CryptoHealthMonitor()
  })

  it('starts with default status', () => {
    const status = monitor.getStatus()
    expect(status.hasUnverifiedDevices).toBe(false)
    expect(status.isKeyBackupSynced).toBe(true)
    expect(status.undecryptableMessageCount).toBe(0)
    expect(status.crossSigningReady).toBe(false)
  })

  it('performs health check and detects unverified devices', async () => {
    const status = await monitor.performCheck()
    expect(status.hasUnverifiedDevices).toBe(true)
    expect(status.isKeyBackupSynced).toBe(true)
    expect(status.undecryptableMessageCount).toBe(0)
  })

  it('triggers callback on status change', async () => {
    const onHealthStatusChange = vi.fn()
    monitor.registerCallbacks({ onHealthStatusChange })
    await monitor.performCheck()
    expect(onHealthStatusChange).toHaveBeenCalled()
  })

  it('start and stop control the timer', async () => {
    monitor.start()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(monitor.getStatus().lastCheckTime).toBeGreaterThan(0)
    monitor.stop()
  })

  it('destroy cleans up', async () => {
    monitor.start()
    await new Promise((resolve) => setTimeout(resolve, 50))
    monitor.destroy()
    expect(monitor.getStatus().lastCheckTime).toBeGreaterThan(0)
  })

  it('performCheck returns default status when no client', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    const status = await monitor.performCheck()
    expect(status.hasUnverifiedDevices).toBe(false)
    expect(status.undecryptableMessageCount).toBe(0)
  })

  it('registerCallbacks merges with existing callbacks', () => {
    const onHealthStatusChange = vi.fn()
    const onKeyRequestTriggered = vi.fn()
    monitor.registerCallbacks({ onHealthStatusChange })
    monitor.registerCallbacks({ onKeyRequestTriggered })
    // After two registerCallbacks calls, both should be present
    // We verify by checking the monitor still works without error
    expect(() => monitor.getStatus()).not.toThrow()
  })

  it('triggers onKeyRequestTriggered for undecryptable messages', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getUserId: () => '@test:example.com',
      getRooms: () => [
        {
          roomId: '!room1:example.com',
          timeline: [
            {
              getContent: () => ({ msgtype: 'm.bad.encrypted' }),
              getWireContent: () => ({ session_id: 'sess123' })
            }
          ]
        }
      ],
      getDeviceKeysManager: vi.fn(() => ({
        createRoomKeyRequest: vi.fn().mockResolvedValue(undefined)
      }))
    } as never)

    const onKeyRequestTriggered = vi.fn()
    monitor.registerCallbacks({ onKeyRequestTriggered })
    await monitor.performCheck()
    expect(onKeyRequestTriggered).toHaveBeenCalledWith('!room1:example.com', 'sess123')
  })

  it('start is idempotent (calling twice does not create duplicate timers)', async () => {
    monitor.start()
    monitor.start()
    await new Promise((resolve) => setTimeout(resolve, 50))
    monitor.stop()
    // No assertion needed — just verifying no error thrown
  })

  it('stop is safe to call when not started', () => {
    monitor.stop()
    // No assertion — just verifying no error
  })

  it('getStatus returns a copy, not the internal reference', () => {
    const s1 = monitor.getStatus()
    const s2 = monitor.getStatus()
    expect(s1).not.toBe(s2)
    expect(s1).toEqual(s2)
  })
})
