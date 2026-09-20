import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
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
    createRoomKeyRequest: vi.fn(() => Promise.resolve()),
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
    it('should create room key request', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getDeviceId: vi.fn(() => 'DEV1'),
          getDeviceKeysManager: vi.fn(() => mockDeviceKeysManager())
        })
      )
      await expect(
        matrixCryptoService.createRoomKeyRequest('!room:server', 'session1', 'm.megolm.v1.aes-sha2', {})
      ).resolves.toBeUndefined()
    })

    it('should throw on error', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getDeviceId: vi.fn(() => 'DEV1'),
          getDeviceKeysManager: vi.fn(() =>
            mockDeviceKeysManager({
              createRoomKeyRequest: vi.fn(() => Promise.reject(new Error('fail')))
            })
          )
        })
      )
      await expect(matrixCryptoService.createRoomKeyRequest('!room:server', 's1', 'algo', {})).rejects.toThrow('fail')
    })
  })
})
