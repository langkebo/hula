import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { cryptoSDKAdapter } from '../CryptoSDKAdapter'
import { matrixCryptoService } from '../MatrixCryptoService'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

describe('MatrixCryptoService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient')
    cryptoSDKAdapter.invalidateCryptoCache()
  })

  const createClient = (overrides: Record<string, unknown> = {}) =>
    ({
      http: {
        authedRequest: vi.fn()
      },
      ...overrides
    }) as unknown as MatrixClient

  const mockDeviceKeysManager = (methodOverrides: Record<string, unknown> = {}) => ({
    sendToDevice: vi.fn(() => Promise.resolve()),
    ...methodOverrides
  })

  describe('initializeCrypto', () => {
    it('should initialize when crypto is enabled', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        isCryptoEnabled: vi.fn(() => true),
        getCrypto: vi.fn(() => ({ isCrossSigningReady: vi.fn() }))
      } as unknown as MatrixClient)
      await expect(matrixCryptoService.initializeCrypto()).resolves.toBeUndefined()
    })

    it('should warn when crypto is not enabled', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        isCryptoEnabled: vi.fn(() => false),
        getCrypto: vi.fn(() => null)
      } as unknown as MatrixClient)
      await expect(matrixCryptoService.initializeCrypto()).resolves.toBeUndefined()
    })
  })

  describe('getCryptoStatus', () => {
    it('should return null when no crypto', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getCrypto: vi.fn(() => null)
      } as unknown as MatrixClient)
      const result = await matrixCryptoService.getCryptoStatus()
      expect(result).toBeNull()
    })

    it('should return crypto status with defaults when methods missing', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getCrypto: vi.fn(() => ({}))
      } as unknown as MatrixClient)
      const result = await matrixCryptoService.getCryptoStatus()
      expect(result).toEqual({ crossSigningReady: false, keyBackupEnabled: false })
    })

    it('should return crypto status', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getCrypto: vi.fn(() => ({
            isCrossSigningReady: vi.fn(() => Promise.resolve(true))
          })),
          getKeyBackupManager: vi.fn(() => ({
            checkKeyBackup: vi.fn(() => Promise.resolve({ version: '1' }))
          }))
        })
      )
      const result = await matrixCryptoService.getCryptoStatus()
      expect(result?.crossSigningReady).toBe(true)
      expect(result?.keyBackupEnabled).toBe(true)
    })
  })

  describe('getDevices', () => {
    it('无 DeviceKeysManager 时显式失败，而不是谎称「没有设备」', async () => {
      // 历史缺陷：曾退化为不存在的 client.getStoredDevicesForUser 并返回 []，
      // 使「能力缺失」看起来像「该用户没有设备」。契约详情见
      // CryptoDeviceAdapter.test.ts 与 CryptoSDKAdapter.test.ts。
      vi.mocked(matrixClientService.getClient).mockReturnValue({} as unknown as MatrixClient)

      await expect(matrixCryptoService.getDevices('@user:server')).rejects.toThrow(/DeviceKeysManager/)
    })
  })

  describe('isRoomEncrypted', () => {
    it('should return false when room not found', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => null)
      } as unknown as MatrixClient)
      const result = await matrixCryptoService.isRoomEncrypted('!room:server')
      expect(result).toBe(false)
    })

    it('should return encrypted status', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getCrypto: vi.fn(() => ({})),
          getRoom: vi.fn(() => ({
            hasEncryptionStateEvent: () => true
          }))
        })
      )
      const result = await matrixCryptoService.isRoomEncrypted('!room:server')
      expect(result).toBe(true)
    })
  })

  describe('enableEncryption', () => {
    it('should send encryption state event', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue({})
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        sendStateEvent
      } as unknown as MatrixClient)
      await matrixCryptoService.enableEncryption('!room:server')
      expect(sendStateEvent).toHaveBeenCalledWith('!room:server', 'm.room.encryption', {
        algorithm: 'm.megolm.v1.aes-sha2'
      })
    })
  })

  describe('exportKeys', () => {
    it('should return empty string when no crypto', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getCrypto: vi.fn(() => null)
      } as unknown as MatrixClient)
      const result = await matrixCryptoService.exportKeys('pass')
      expect(result).toBe('')
    })

    it('should return empty string when crypto has no exportRoomKeys method', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getCrypto: vi.fn(() => ({}))
      } as unknown as MatrixClient)
      const result = await matrixCryptoService.exportKeys('pass')
      expect(result).toBe('')
    })

    it('should export keys as JSON', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getCrypto: vi.fn(() => ({
          exportRoomKeys: vi.fn(() => Promise.resolve([{ algorithm: 'm.megolm.v1.aes-sha2' }]))
        }))
      } as unknown as MatrixClient)
      const result = await matrixCryptoService.exportKeys('pass')
      const parsed = JSON.parse(result)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].algorithm).toBe('m.megolm.v1.aes-sha2')
    })
  })

  describe('createRoomKeyRequest', () => {
    /**
     * P0-① 回归：必须是标准 `m.room_key_request`（to-device 广播），而不是自建的
     * `POST /room_keys/request`。只有标准消息才会被其它设备的 rust-crypto 响应。
     */
    it('发送标准 m.room_key_request（to-device，广播给本账号所有设备）', async () => {
      const manager = mockDeviceKeysManager()
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getUserId: vi.fn(() => '@me:server'),
          getDeviceId: vi.fn(() => 'DEV1'),
          getDeviceKeysManager: vi.fn(() => manager)
        })
      )

      await expect(
        matrixCryptoService.createRoomKeyRequest('!room:server', 'session1', 'm.megolm.v1.aes-sha2', 'SENDERKEY')
      ).resolves.toBeUndefined()

      expect(manager.sendToDevice).toHaveBeenCalledTimes(1)
      const call = manager.sendToDevice.mock.calls[0] as unknown as [string, string, unknown]
      expect(call[0]).toBe('m.room_key_request')
      // 广播给本账号所有设备（'*'），同一 session 复用同一 request_id 以便去重
      expect(call[2]).toEqual({
        '@me:server': {
          '*': {
            action: 'request',
            requesting_device_id: 'DEV1',
            request_id: 'mkr_session1',
            body: {
              algorithm: 'm.megolm.v1.aes-sha2',
              room_id: '!room:server',
              session_id: 'session1',
              sender_key: 'SENDERKEY'
            }
          }
        }
      })
    })

    it('should throw on error', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getUserId: vi.fn(() => '@me:server'),
          getDeviceId: vi.fn(() => 'DEV1'),
          getDeviceKeysManager: vi.fn(() =>
            mockDeviceKeysManager({
              sendToDevice: vi.fn(() => Promise.reject(new Error('fail')))
            })
          )
        })
      )
      await expect(matrixCryptoService.createRoomKeyRequest('!room:server', 's1', 'algo')).rejects.toThrow('fail')
    })
  })
})
