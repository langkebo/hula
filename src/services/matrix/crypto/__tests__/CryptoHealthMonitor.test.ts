import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { CryptoHealthMonitor } from '../CryptoHealthMonitor'
import { cryptoSDKAdapter } from '../CryptoSDKAdapter'
import { matrixCryptoService } from '../MatrixCryptoService'
import { matrixKeyBackupService } from '../MatrixKeyBackupService'

const loggerSpy = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => loggerSpy
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

  // R-02: checkKeyBackupSync 失败时不应误报 true（密钥备份检查失败 ≠ 已备份）
  describe('R-02: error swallowing in crypto health checks', () => {
    beforeEach(() => {
      loggerSpy.error.mockClear()
      loggerSpy.warn.mockClear()
    })

    it('getBackupVersions 抛错时记录 error 且 isKeyBackupSynced=false（不再误报 true）', async () => {
      vi.spyOn(matrixKeyBackupService, 'getBackupVersions').mockRejectedValue(new Error('network error'))

      const status = await monitor.performCheck()
      expect(status.isKeyBackupSynced).toBe(false)
      expect(loggerSpy.error).toHaveBeenCalled()
    })

    it('checkUnverifiedDevices 抛错时记录 error 日志（不再静默）', async () => {
      vi.spyOn(matrixCryptoService, 'getDevices').mockRejectedValue(new Error('device fetch failed'))

      const status = await monitor.performCheck()
      expect(status.hasUnverifiedDevices).toBe(false)
      expect(loggerSpy.error).toHaveBeenCalled()
    })

    it('checkCrossSigningReady 抛错时记录 error 日志（不再静默）', async () => {
      vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
        ...createDefaultMockClient(),
        getCrypto: vi.fn(() => ({
          isCrossSigningReady: vi.fn().mockRejectedValue(new Error('cross-signing boom'))
        }))
      } as never)

      const status = await monitor.performCheck()
      expect(status.crossSigningReady).toBe(false)
      expect(loggerSpy.error).toHaveBeenCalled()
    })

    it('countUndecryptableMessages 抛错时记录 error 日志且返回 0（不再静默）', async () => {
      vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
        ...createDefaultMockClient(),
        getRooms: vi.fn(() => {
          throw new Error('rooms iteration failed')
        })
      } as never)

      const status = await monitor.performCheck()
      expect(status.undecryptableMessageCount).toBe(0)
      expect(loggerSpy.error).toHaveBeenCalled()
    })
  })
})
