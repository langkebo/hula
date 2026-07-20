import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { cryptoSDKAdapter } from '../CryptoSDKAdapter'
import { matrixCryptoService } from '../MatrixCryptoService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
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
    uploadKeys: vi.fn(() => Promise.resolve({ one_time_key_counts: { signed_curve25519: 50 } })),
    queryKeys: vi.fn(() => Promise.resolve({ device_keys: {} })),
    claimKeys: vi.fn(() => Promise.resolve({ one_time_keys: {} })),
    getKeyChanges: vi.fn(() => Promise.resolve({ changed: ['@u1:server'], left: ['@u2:server'] })),
    sendToDevice: vi.fn(() => Promise.resolve()),
    uploadSignatures: vi.fn(() => Promise.resolve()),
    uploadDeviceSigning: vi.fn(() => Promise.resolve()),
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
    it('should return empty array when method not available', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({} as unknown as MatrixClient)
      const result = await matrixCryptoService.getDevices('@user:server')
      expect(result).toEqual([])
    })

    it('should map device info', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getStoredDevicesForUser: vi.fn(() => [
          { deviceId: 'DEV1', userId: '@user:server', getDisplayName: () => 'My Device', isVerified: () => true }
        ])
      } as unknown as MatrixClient)
      const result = await matrixCryptoService.getDevices('@user:server')
      expect(result).toHaveLength(1)
      expect(result[0].deviceId).toBe('DEV1')
      expect(result[0].isVerified).toBe(true)
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

  describe('getCrossSigningStatus', () => {
    it('should return false values when no crypto', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getCrypto: vi.fn(() => null)
      } as unknown as MatrixClient)
      const result = await matrixCryptoService.getCrossSigningStatus()
      expect(result.privateKeysCached).toBe(false)
      expect(result.crossSigningVerified).toBe(false)
    })

    it('should return cross signing status with defaults', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getCrypto: vi.fn(() => ({}))
      } as unknown as MatrixClient)
      const result = await matrixCryptoService.getCrossSigningStatus()
      expect(result.privateKeysCached).toBe(false)
      expect(result.crossSigningVerified).toBe(false)
    })

    it('should return cross signing status from crypto', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getCrypto: vi.fn(() => ({
            getCrossSigningStatus: vi.fn(() => Promise.resolve({ privateKeysInSecretStorage: true })),
            isCrossSigningReady: vi.fn(() => Promise.resolve(true))
          }))
        })
      )
      const result = await matrixCryptoService.getCrossSigningStatus()
      expect(result.privateKeysCached).toBe(true)
      expect(result.crossSigningVerified).toBe(true)
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

  describe('secure backup restore', () => {
    it('should return secure backup restore result with recovered_keys and total_keys', async () => {
      const restoreFromSecureBackup = vi.fn().mockResolvedValue({
        recovered_keys: 2,
        total_keys: 3
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getSecureBackupManager: vi.fn(() => ({
            restoreFromSecureBackup
          }))
        })
      )

      const result = await matrixCryptoService.restoreFromSecureBackup('backup-1', 'passphrase')

      expect(result).toEqual({
        recovered_keys: 2,
        total_keys: 3
      })
      expect(restoreFromSecureBackup).toHaveBeenCalledWith('backup-1', 'passphrase')
    })

    it('should restore secure backup keys without relying on legacy success fields', async () => {
      const restoreFromSecureBackup = vi.fn().mockResolvedValue({
        recovered_keys: 1,
        total_keys: 1
      })
      const mockKeyBackupManager = {
        getBackupVersions: vi.fn(() => Promise.resolve({ versions: [{ version: '1' }] }))
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getSecureBackupManager: vi.fn(() => ({
            restoreFromSecureBackup
          })),
          getSDKKeyBackupManager: vi.fn(() => mockKeyBackupManager)
        })
      )

      await expect(matrixCryptoService.restoreKeys('recovery-key')).resolves.toBeUndefined()
      expect(restoreFromSecureBackup).toHaveBeenCalledWith('1', 'recovery-key')
    })
  })

  describe('uploadKeys', () => {
    it('should upload keys and return counts', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getDeviceKeysManager: vi.fn(() => mockDeviceKeysManager())
        })
      )
      const result = await matrixCryptoService.uploadKeys({ key: 'value' })
      expect(result.oneTimeKeyCounts.signed_curve25519).toBe(50)
    })

    it('should throw on error', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getDeviceKeysManager: vi.fn(() =>
            mockDeviceKeysManager({
              uploadKeys: vi.fn(() => Promise.reject(new Error('fail')))
            })
          )
        })
      )
      await expect(matrixCryptoService.uploadKeys()).rejects.toThrow('fail')
    })
  })

  describe('queryKeys', () => {
    it('should query keys for users', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getDeviceKeysManager: vi.fn(() => mockDeviceKeysManager())
        })
      )
      const result = await matrixCryptoService.queryKeys(['@user:server'])
      expect(result).toBeDefined()
    })
  })

  describe('claimKeys', () => {
    it('should claim keys', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getDeviceKeysManager: vi.fn(() => mockDeviceKeysManager())
        })
      )
      const result = await matrixCryptoService.claimKeys({ '@user:server': { DEV1: 'signed_curve25519' } })
      expect(result).toBeDefined()
    })
  })

  describe('getKeyChanges', () => {
    it('should get key changes', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getDeviceKeysManager: vi.fn(() => mockDeviceKeysManager())
        })
      )
      const result = await matrixCryptoService.getKeyChanges('token1', 'token2')
      expect(result.changed).toHaveLength(1)
      expect(result.left).toHaveLength(1)
    })

    it('should return empty on error', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getDeviceKeysManager: vi.fn(() =>
            mockDeviceKeysManager({
              getKeyChanges: vi.fn(() => Promise.reject(new Error('fail')))
            })
          )
        })
      )
      const result = await matrixCryptoService.getKeyChanges('t1', 't2')
      expect(result.changed).toEqual([])
    })
  })

  describe('sendToDevice', () => {
    it('should send to device message', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getDeviceKeysManager: vi.fn(() => mockDeviceKeysManager())
        })
      )
      await expect(matrixCryptoService.sendToDevice('m.room.encrypted', {})).resolves.toBeUndefined()
    })

    it('should throw on error', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getDeviceKeysManager: vi.fn(() =>
            mockDeviceKeysManager({
              sendToDevice: vi.fn(() => Promise.reject(new Error('fail')))
            })
          )
        })
      )
      await expect(matrixCryptoService.sendToDevice('m.room.encrypted', {})).rejects.toThrow('fail')
    })
  })

  describe('uploadSignatures', () => {
    it('should upload signatures', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getDeviceKeysManager: vi.fn(() => mockDeviceKeysManager())
        })
      )
      await expect(matrixCryptoService.uploadSignatures({})).resolves.toBeUndefined()
    })
  })

  describe('uploadDeviceSigningKeys', () => {
    it('should upload device signing keys', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        createClient({
          getDeviceKeysManager: vi.fn(() => mockDeviceKeysManager())
        })
      )
      await expect(matrixCryptoService.uploadDeviceSigningKeys({ key: 'master' })).resolves.toBeUndefined()
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
