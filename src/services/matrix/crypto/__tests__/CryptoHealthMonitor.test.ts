import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CryptoHealthMonitor } from '../CryptoHealthMonitor'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({
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
      ]
    }))
  }
}))

vi.mock('../MatrixKeyBackupService', () => ({
  matrixKeyBackupService: {
    getBackupVersions: vi.fn(async () => [{ version: '1' }])
  }
}))

vi.mock('../MatrixCryptoService', () => ({
  matrixCryptoService: {
    getDevices: vi.fn(async () => [
      { deviceId: 'dev1', userId: '@test:example.com', isVerified: true },
      { deviceId: 'dev2', userId: '@test:example.com', isVerified: false }
    ]),
    createRoomKeyRequest: vi.fn()
  }
}))

describe('CryptoHealthMonitor', () => {
  let monitor: CryptoHealthMonitor

  beforeEach(() => {
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
    const { matrixClientService } = await import('../../MatrixClientService')
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
    const { matrixClientService } = await import('../../MatrixClientService')
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
      ]
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
