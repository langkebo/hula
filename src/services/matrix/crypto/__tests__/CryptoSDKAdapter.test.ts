import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { cryptoSDKAdapter } from '../CryptoSDKAdapter'

// 使用 vi.hoisted 创建 logSpy，确保在 vi.mock 工厂执行前就已存在
const { logSpy } = vi.hoisted(() => ({
  logSpy: vi.fn()
}))

// Mock Logger，使 error 方法指向 logSpy 以便断言 catch 块是否记录日志
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: logSpy,
    log: vi.fn(),
    child: vi.fn(),
    setLevel: vi.fn(),
    getLevel: vi.fn(),
    time: vi.fn(),
    timeEnd: vi.fn(),
    group: vi.fn(),
    groupEnd: vi.fn(),
    table: vi.fn()
  })
}))

type MockFn = ReturnType<typeof vi.fn>

interface MockExtendedClient {
  getUserId: MockFn
  getDeviceId: MockFn
  getRoom: MockFn
  sendStateEvent: MockFn
  getCrypto: MockFn
  getDeviceTrustManager: MockFn
  getSecureBackupManager: MockFn
  getKeyBackupManager: MockFn
  getDeviceKeysManager: MockFn
  getSDKKeyBackupManager: MockFn
  getKeyVerificationManager: MockFn
  setDeviceBlocked: MockFn
  setDeviceVerified: MockFn
  checkDeviceTrust: MockFn
  getStoredDevicesForUser: MockFn
  getStoredDevice: MockFn
  isCrossSigningReady: MockFn
}

function createMockExtendedClient(): MockExtendedClient {
  return {
    getUserId: vi.fn(() => '@user:example.com'),
    getDeviceId: vi.fn(() => 'DEVICE_1'),
    getRoom: vi.fn(),
    sendStateEvent: vi.fn(),
    getCrypto: vi.fn(() => null),
    getDeviceTrustManager: vi.fn(() => null),
    getSecureBackupManager: vi.fn(() => null),
    getKeyBackupManager: vi.fn(() => null),
    getDeviceKeysManager: vi.fn(() => null),
    getSDKKeyBackupManager: vi.fn(() => null),
    getKeyVerificationManager: vi.fn(() => null),
    setDeviceBlocked: vi.fn(),
    setDeviceVerified: vi.fn(),
    checkDeviceTrust: vi.fn(),
    getStoredDevicesForUser: vi.fn(),
    getStoredDevice: vi.fn(),
    isCrossSigningReady: vi.fn(() => false)
  }
}

describe('CryptoSDKAdapter', () => {
  let mockClient: MockExtendedClient

  beforeEach(() => {
    mockClient = createMockExtendedClient()
    vi.spyOn(matrixClientService, 'getClient').mockReset()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)
    cryptoSDKAdapter.invalidateCryptoCache()
  })

  describe('getCrypto', () => {
    it('should return null when no crypto available', () => {
      mockClient.getCrypto = vi.fn(() => null)
      expect(cryptoSDKAdapter.getCrypto()).toBeNull()
    })

    it('should return crypto instance and cache it', () => {
      const mockCrypto = { isEncryptionAvailable: true }
      mockClient.getCrypto = vi.fn(() => mockCrypto)
      const result = cryptoSDKAdapter.getCrypto()
      expect(result).toBe(mockCrypto)
      const cached = cryptoSDKAdapter.getCrypto()
      expect(cached).toBe(mockCrypto)
    })
  })

  describe('invalidateCryptoCache', () => {
    it('should clear cached crypto', () => {
      const mockCrypto = { isEncryptionAvailable: true }
      mockClient.getCrypto = vi.fn(() => mockCrypto)
      cryptoSDKAdapter.getCrypto()
      cryptoSDKAdapter.invalidateCryptoCache()
      mockClient.getCrypto = vi.fn(() => null)
      expect(cryptoSDKAdapter.getCrypto()).toBeNull()
    })
  })

  describe('isEncryptionAvailable', () => {
    it('should return true when crypto is available', async () => {
      mockClient.getCrypto = vi.fn(() => ({ isEncryptionAvailable: true }))
      const result = await cryptoSDKAdapter.isEncryptionAvailable()
      expect(result).toBe(true)
    })

    it('should return false when no crypto', async () => {
      mockClient.getCrypto = vi.fn(() => null)
      const result = await cryptoSDKAdapter.isEncryptionAvailable()
      expect(result).toBe(false)
    })
  })

  describe('blockDevice', () => {
    it('should use legacy setDeviceBlocked when available', async () => {
      mockClient.getCrypto = vi.fn(() => null)
      mockClient.setDeviceBlocked = vi.fn().mockResolvedValue(undefined)
      await cryptoSDKAdapter.blockDevice('@user:server', 'DEVICE1')
      expect(mockClient.setDeviceBlocked).toHaveBeenCalledWith('@user:server', 'DEVICE1', true)
    })

    it('should fall back to CryptoApi.setDeviceVerified(false) when no legacy', async () => {
      const mockCrypto = { setDeviceVerified: vi.fn().mockResolvedValue(undefined) }
      mockClient.getCrypto = vi.fn(() => mockCrypto)
      delete (mockClient as unknown as Record<string, unknown>).setDeviceBlocked
      await cryptoSDKAdapter.blockDevice('@user:server', 'DEVICE1')
      expect(mockCrypto.setDeviceVerified).toHaveBeenCalledWith('@user:server', 'DEVICE1', false)
    })

    it('should warn when no interface available', async () => {
      mockClient.getCrypto = vi.fn(() => null)
      delete (mockClient as unknown as Record<string, unknown>).setDeviceBlocked
      await cryptoSDKAdapter.blockDevice('@user:server', 'DEVICE1')
    })
  })

  describe('unblockDevice', () => {
    it('should use legacy setDeviceBlocked with false when available', async () => {
      mockClient.getCrypto = vi.fn(() => null)
      mockClient.setDeviceBlocked = vi.fn().mockResolvedValue(undefined)
      await cryptoSDKAdapter.unblockDevice('@user:server', 'DEVICE1')
      expect(mockClient.setDeviceBlocked).toHaveBeenCalledWith('@user:server', 'DEVICE1', false)
    })

    it('should fall back to CryptoApi.setDeviceVerified(false) when no legacy', async () => {
      const mockCrypto = { setDeviceVerified: vi.fn().mockResolvedValue(undefined) }
      mockClient.getCrypto = vi.fn(() => mockCrypto)
      delete (mockClient as unknown as Record<string, unknown>).setDeviceBlocked
      await cryptoSDKAdapter.unblockDevice('@user:server', 'DEVICE1')
      expect(mockCrypto.setDeviceVerified).toHaveBeenCalledWith('@user:server', 'DEVICE1', false)
    })
  })

  describe('getDevices', () => {
    it('should use DeviceTrustManager when available', async () => {
      const mockTrustManager = {
        getDeviceTrustList: vi.fn().mockResolvedValue([
          {
            device_id: 'D1',
            user_id: '@user:server',
            display_name: 'Phone',
            last_seen_ts: 123,
            last_seen_ip: '1.2.3.4',
            trust_level: 'verified'
          }
        ])
      }
      mockClient.getDeviceTrustManager = vi.fn(() => mockTrustManager)
      const result = await cryptoSDKAdapter.getDevices('@user:server')
      expect(result).toEqual([
        {
          deviceId: 'D1',
          userId: '@user:server',
          displayName: 'Phone',
          lastSeenTs: 123,
          lastSeenIp: '1.2.3.4',
          isVerified: true
        }
      ])
    })

    it('should map trust_level correctly for unverified devices', async () => {
      const mockTrustManager = {
        getDeviceTrustList: vi.fn().mockResolvedValue([
          {
            device_id: 'D2',
            user_id: '@user:server',
            trust_level: 'unverified'
          }
        ])
      }
      mockClient.getDeviceTrustManager = vi.fn(() => mockTrustManager)
      const result = await cryptoSDKAdapter.getDevices('@user:server')
      expect(result[0].isVerified).toBe(false)
    })

    it('should fall back to getStoredDevicesForUser when no Manager', async () => {
      mockClient.getDeviceTrustManager = vi.fn(() => null)
      mockClient.getStoredDevicesForUser = vi
        .fn()
        .mockResolvedValue([
          { deviceId: 'D1', userId: '@user:server', displayName: 'Phone', isVerified: vi.fn(() => true) }
        ])
      const result = await cryptoSDKAdapter.getDevices('@user:server')
      expect(result).toEqual([
        {
          deviceId: 'D1',
          userId: '@user:server',
          displayName: 'Phone',
          isVerified: true
        }
      ])
    })

    it('should return empty array when no method available', async () => {
      mockClient.getDeviceTrustManager = vi.fn(() => null)
      delete (mockClient as unknown as Record<string, unknown>).getStoredDevicesForUser
      const result = await cryptoSDKAdapter.getDevices('@user:server')
      expect(result).toEqual([])
    })
  })

  describe('verifyDevice', () => {
    it('should use DeviceTrustManager when available', async () => {
      const mockTrustManager = {
        requestVerification: vi.fn().mockResolvedValue({ token: 'tok123' }),
        respondToVerification: vi.fn().mockResolvedValue(undefined)
      }
      mockClient.getDeviceTrustManager = vi.fn(() => mockTrustManager)
      await cryptoSDKAdapter.verifyDevice('@user:server', 'DEVICE1')
      expect(mockTrustManager.requestVerification).toHaveBeenCalled()
      expect(mockTrustManager.respondToVerification).toHaveBeenCalledWith('tok123', true)
    })

    it('should use CryptoApi.setDeviceVerified when no Manager', async () => {
      mockClient.getDeviceTrustManager = vi.fn(() => null)
      const mockCrypto = { setDeviceVerified: vi.fn().mockResolvedValue(undefined) }
      mockClient.getCrypto = vi.fn(() => mockCrypto)
      await cryptoSDKAdapter.verifyDevice('@user:server', 'DEVICE1')
      expect(mockCrypto.setDeviceVerified).toHaveBeenCalledWith('@user:server', 'DEVICE1')
    })

    it('should fall back to legacy setDeviceVerified', async () => {
      mockClient.getDeviceTrustManager = vi.fn(() => null)
      mockClient.getCrypto = vi.fn(() => null)
      mockClient.setDeviceVerified = vi.fn().mockResolvedValue(undefined)
      await cryptoSDKAdapter.verifyDevice('@user:server', 'DEVICE1')
      expect(mockClient.setDeviceVerified).toHaveBeenCalledWith('@user:server', 'DEVICE1')
    })
  })

  describe('unverifyDevice', () => {
    it('should use CryptoApi.setDeviceVerified(false) when available', async () => {
      const mockCrypto = { setDeviceVerified: vi.fn().mockResolvedValue(undefined) }
      mockClient.getCrypto = vi.fn(() => mockCrypto)
      await cryptoSDKAdapter.unverifyDevice('@user:server', 'DEVICE1')
      expect(mockCrypto.setDeviceVerified).toHaveBeenCalledWith('@user:server', 'DEVICE1', false)
    })

    it('should fall back to legacy setDeviceVerified(false)', async () => {
      mockClient.getCrypto = vi.fn(() => null)
      mockClient.setDeviceVerified = vi.fn().mockResolvedValue(undefined)
      await cryptoSDKAdapter.unverifyDevice('@user:server', 'DEVICE1')
      expect(mockClient.setDeviceVerified).toHaveBeenCalledWith('@user:server', 'DEVICE1', false)
    })
  })

  describe('getDeviceVerificationStatus', () => {
    it('should use CryptoApi when available', async () => {
      const mockCrypto = {
        getDeviceVerificationStatus: vi.fn().mockResolvedValue({
          isVerified: vi.fn(() => true),
          crossSigningVerified: true
        })
      }
      mockClient.getCrypto = vi.fn(() => mockCrypto)
      const result = await cryptoSDKAdapter.getDeviceVerificationStatus('@user:server', 'DEVICE1')
      expect(result).toEqual({
        verified: true,
        crossSigningVerified: true,
        devicesCrossSigningVerified: true
      })
    })

    it('should handle null return from getDeviceVerificationStatus', async () => {
      const mockCrypto = {
        getDeviceVerificationStatus: vi.fn().mockResolvedValue(null)
      }
      mockClient.getCrypto = vi.fn(() => mockCrypto)
      const result = await cryptoSDKAdapter.getDeviceVerificationStatus('@user:server', 'DEVICE1')
      expect(result).toEqual({
        verified: false,
        crossSigningVerified: false,
        devicesCrossSigningVerified: false
      })
    })

    it('should fall back to legacy checkDeviceTrust', async () => {
      mockClient.getCrypto = vi.fn(() => null)
      mockClient.checkDeviceTrust = vi.fn().mockResolvedValue({
        isVerified: vi.fn(() => false),
        crossSigningVerified: false
      })
      const result = await cryptoSDKAdapter.getDeviceVerificationStatus('@user:server', 'DEVICE1')
      expect(result).toEqual({
        verified: false,
        crossSigningVerified: false,
        devicesCrossSigningVerified: false
      })
    })

    it('should return default when no method available', async () => {
      mockClient.getCrypto = vi.fn(() => null)
      delete (mockClient as unknown as Record<string, unknown>).checkDeviceTrust
      const result = await cryptoSDKAdapter.getDeviceVerificationStatus('@user:server', 'DEVICE1')
      expect(result).toEqual({
        verified: false,
        crossSigningVerified: false,
        devicesCrossSigningVerified: false
      })
    })
  })

  describe('isRoomEncrypted', () => {
    it('should return false when room not found', async () => {
      mockClient.getRoom = vi.fn(() => null)
      const result = await cryptoSDKAdapter.isRoomEncrypted('!room:server')
      expect(result).toBe(false)
    })

    it('should return true when encryption state event exists', async () => {
      const mockRoom = {
        currentState: {
          getStateEvents: vi.fn(() => ({
            getContent: () => ({ algorithm: 'm.megolm.v1.aes-sha2' })
          }))
        }
      }
      mockClient.getRoom = vi.fn(() => mockRoom)
      mockClient.getCrypto = vi.fn(() => null)
      const result = await cryptoSDKAdapter.isRoomEncrypted('!room:server')
      expect(result).toBe(true)
    })

    it('should return false when no encryption event', async () => {
      const mockRoom = {
        currentState: {
          getStateEvents: vi.fn(() => null)
        }
      }
      mockClient.getRoom = vi.fn(() => mockRoom)
      mockClient.getCrypto = vi.fn(() => null)
      const result = await cryptoSDKAdapter.isRoomEncrypted('!room:server')
      expect(result).toBe(false)
    })
  })

  describe('enableEncryption', () => {
    it('should send encryption state event', async () => {
      mockClient.sendStateEvent = vi.fn().mockResolvedValue({})
      await cryptoSDKAdapter.enableEncryption('!room:server')
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith('!room:server', 'm.room.encryption', {
        algorithm: 'm.megolm.v1.aes-sha2'
      })
    })

    it('should use custom algorithm when provided', async () => {
      mockClient.sendStateEvent = vi.fn().mockResolvedValue({})
      await cryptoSDKAdapter.enableEncryption('!room:server', 'custom.algo')
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith('!room:server', 'm.room.encryption', {
        algorithm: 'custom.algo'
      })
    })
  })

  describe('exportKeys', () => {
    it('should export keys via CryptoApi', async () => {
      const mockKeys = [{ algorithm: 'm.megolm.v1.aes-sha2' }]
      const mockCrypto = { exportRoomKeys: vi.fn().mockResolvedValue(mockKeys) }
      mockClient.getCrypto = vi.fn(() => mockCrypto)
      const result = await cryptoSDKAdapter.exportKeys()
      expect(result.count).toBe(1)
      expect(result.data).toBe(JSON.stringify(mockKeys))
    })

    it('should return empty when no crypto', async () => {
      mockClient.getCrypto = vi.fn(() => null)
      const result = await cryptoSDKAdapter.exportKeys()
      expect(result).toEqual({ data: '', count: 0 })
    })
  })

  describe('importKeys', () => {
    it('should import keys via CryptoApi and return count from input array', async () => {
      const mockCrypto = {
        importRoomKeys: vi.fn().mockResolvedValue(undefined)
      }
      mockClient.getCrypto = vi.fn(() => mockCrypto)
      const inputKeys = [{ algorithm: 'test' }, { algorithm: 'test2' }]
      const result = await cryptoSDKAdapter.importKeys(JSON.stringify(inputKeys))
      expect(mockCrypto.importRoomKeys).toHaveBeenCalledWith(inputKeys)
      expect(result).toEqual({ imported: 2, total: 2 })
    })

    it('should return empty when no crypto', async () => {
      mockClient.getCrypto = vi.fn(() => null)
      const result = await cryptoSDKAdapter.importKeys(JSON.stringify([]))
      expect(result).toEqual({ imported: 0, total: 0 })
    })
  })

  describe('requireSDKDeviceKeysManager', () => {
    it('should throw when manager not available', () => {
      mockClient.getDeviceKeysManager = vi.fn(() => null)
      expect(() => cryptoSDKAdapter.requireSDKDeviceKeysManager()).toThrow('DeviceKeysManager not available')
    })

    it('should return manager when available', () => {
      const mockManager = { uploadKeys: vi.fn() }
      mockClient.getDeviceKeysManager = vi.fn(() => mockManager)
      expect(cryptoSDKAdapter.requireSDKDeviceKeysManager()).toBe(mockManager)
    })
  })

  describe('getManagerAccessors', () => {
    it('should return accessor functions', () => {
      const accessors = cryptoSDKAdapter.getManagerAccessors()
      expect(typeof accessors.deviceTrust).toBe('function')
      expect(typeof accessors.secureBackup).toBe('function')
      expect(typeof accessors.keyBackup).toBe('function')
      expect(typeof accessors.sdkDeviceKeys).toBe('function')
      expect(typeof accessors.sdkKeyBackup).toBe('function')
      expect(typeof accessors.sdkKeyVerification).toBe('function')
    })
  })

  describe('getCrossSigningStatus', () => {
    it('should return default when no crypto', async () => {
      mockClient.getCrypto = vi.fn(() => null)
      const result = await cryptoSDKAdapter.getCrossSigningStatus()
      expect(result).toEqual({
        privateKeysCached: false,
        crossSigningVerified: false,
        isSetup: false
      })
    })

    it('should return status from CryptoApi', async () => {
      const mockCrypto = {
        getCrossSigningStatus: vi.fn().mockResolvedValue({ privateKeysInSecretStorage: true }),
        isCrossSigningReady: vi.fn().mockResolvedValue(true)
      }
      mockClient.getCrypto = vi.fn(() => mockCrypto)
      const result = await cryptoSDKAdapter.getCrossSigningStatus()
      expect(result.privateKeysCached).toBe(true)
      expect(result.crossSigningVerified).toBe(true)
      expect(result.isSetup).toBe(true)
    })
  })

  describe('isCrossSigningReady', () => {
    beforeEach(() => {
      logSpy.mockClear()
    })

    it('应在 client.isCrossSigningReady 抛错时记录 error 日志并返回 false (R-11)', async () => {
      // 模拟 isCrossSigningReady 方法抛错
      mockClient.isCrossSigningReady = vi.fn(() => {
        throw new Error('cross-signing check failed')
      })

      const result = await cryptoSDKAdapter.isCrossSigningReady()

      // 返回值仍为 false（不变）
      expect(result).toBe(false)
      // catch 块必须记录 error 日志，不能静默吞没
      expect(logSpy).toHaveBeenCalledTimes(1)
    })
  })

  // ==================== setupKeyBackupWithOptions ====================
  // 修复验证：安全密钥生成 + bootstrapSecretStorage 上传
  describe('setupKeyBackupWithOptions', () => {
    const mockEncodedKey = 'ES9X ABC4 DEFG HIJK LMNO PQRS TUVW XYZ1 2345'

    function createMockCrypto() {
      return {
        createRecoveryKeyFromPassphrase: vi.fn().mockResolvedValue({
          privateKey: new Uint8Array([1, 2, 3, 4]),
          encodedPrivateKey: mockEncodedKey
        }),
        bootstrapSecretStorage: vi.fn().mockResolvedValue(undefined),
        restoreKeyBackup: vi.fn().mockResolvedValue(undefined),
        resetKeyBackup: vi.fn().mockResolvedValue(undefined)
      }
    }

    beforeEach(() => {
      logSpy.mockClear()
    })

    it('should generate random key + bootstrapSecretStorage when no input (generate mode)', async () => {
      const mockCrypto = createMockCrypto()
      mockClient.getCrypto = vi.fn(() => mockCrypto)

      const result = await cryptoSDKAdapter.setupKeyBackupWithOptions()

      // 验证：生成随机密钥（无密码）
      expect(mockCrypto.createRecoveryKeyFromPassphrase).toHaveBeenCalledTimes(1)
      expect(mockCrypto.createRecoveryKeyFromPassphrase).toHaveBeenCalledWith(undefined)

      // 验证：调用 bootstrapSecretStorage（仅 SSSS，不含 keyBackup）— 后台立即启动
      expect(mockCrypto.bootstrapSecretStorage).toHaveBeenCalledTimes(1)
      expect(mockCrypto.bootstrapSecretStorage).toHaveBeenCalledWith({
        createSecretStorageKey: expect.any(Function),
        setupNewSecretStorage: true,
        setupNewKeyBackup: false
      })

      // 验证：返回 encodedPrivateKey
      expect(result).toBe(mockEncodedKey)

      // 验证：后台 resetKeyBackup 被调用（fire-and-forget，需等待微任务完成）
      await vi.waitFor(() => {
        expect(mockCrypto.resetKeyBackup).toHaveBeenCalledTimes(1)
      })
    })

    it('should generate key from password + bootstrapSecretStorage (passphrase mode)', async () => {
      const mockCrypto = createMockCrypto()
      mockClient.getCrypto = vi.fn(() => mockCrypto)

      const password = 'MySecurePassphrase123!'
      const result = await cryptoSDKAdapter.setupKeyBackupWithOptions({ password })

      // 验证：使用密码创建密钥（修复的关键：密码现在被传递）
      expect(mockCrypto.createRecoveryKeyFromPassphrase).toHaveBeenCalledTimes(1)
      expect(mockCrypto.createRecoveryKeyFromPassphrase).toHaveBeenCalledWith(password)

      // 验证：调用 bootstrapSecretStorage
      expect(mockCrypto.bootstrapSecretStorage).toHaveBeenCalledTimes(1)

      // 验证：返回 encodedPrivateKey
      expect(result).toBe(mockEncodedKey)
    })

    it('should restore key backup when recoveryKey is provided', async () => {
      const mockCrypto = createMockCrypto()
      mockClient.getCrypto = vi.fn(() => mockCrypto)

      const existingKey = 'ES9X OLD-KEY-RESTORE-12345'
      const result = await cryptoSDKAdapter.setupKeyBackupWithOptions(existingKey)

      // 验证：调用 restoreKeyBackup（不生成新密钥，不 bootstrap）
      expect(mockCrypto.restoreKeyBackup).toHaveBeenCalledTimes(1)
      expect(mockCrypto.createRecoveryKeyFromPassphrase).not.toHaveBeenCalled()
      expect(mockCrypto.bootstrapSecretStorage).not.toHaveBeenCalled()

      // 验证：返回原密钥
      expect(result).toBe(existingKey)
    })

    it('should throw when crypto is not available', async () => {
      mockClient.getCrypto = vi.fn(() => null)

      await expect(cryptoSDKAdapter.setupKeyBackupWithOptions()).rejects.toThrow('CryptoApi 不可用')
    })

    it('should handle bootstrapSecretStorage failure gracefully', async () => {
      const mockCrypto = createMockCrypto()
      mockCrypto.bootstrapSecretStorage = vi.fn().mockRejectedValue(new Error('Server error'))
      mockClient.getCrypto = vi.fn(() => mockCrypto)

      // SSSS 失败时仍返回密钥（降级处理，用户可稍后重试）
      const result = await cryptoSDKAdapter.setupKeyBackupWithOptions()
      expect(result).toBe(mockEncodedKey)
    })

    it('should fallback to resetKeyBackup when bootstrapSecretStorage is not available', async () => {
      const mockCrypto = {
        createRecoveryKeyFromPassphrase: vi.fn().mockResolvedValue({
          privateKey: new Uint8Array([1, 2, 3, 4]),
          encodedPrivateKey: mockEncodedKey
        }),
        // bootstrapSecretStorage 不存在（旧 SDK 兼容）
        resetKeyBackup: vi.fn().mockResolvedValue(undefined)
      }
      mockClient.getCrypto = vi.fn(() => mockCrypto)

      const result = await cryptoSDKAdapter.setupKeyBackupWithOptions()

      // 验证：生成了密钥
      expect(mockCrypto.createRecoveryKeyFromPassphrase).toHaveBeenCalledTimes(1)
      // 验证：回退到 resetKeyBackup
      expect(mockCrypto.resetKeyBackup).toHaveBeenCalledTimes(1)
      // 验证：返回密钥
      expect(result).toBe(mockEncodedKey)
    })
  })
})
