import { describe, it, expect, vi, beforeEach } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixEncryptionService } from '../MatrixEncryptionService'
import type { MatrixClient } from 'matrix-js-sdk'

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn()
  }
}))

describe('MatrixEncryptionService', () => {
  let mockClient: Partial<MatrixClient>
  let mockCrypto: any

  beforeEach(() => {
    mockCrypto = {
      bootstrapCrossSigning: vi.fn(),
      getDeviceVerificationStatus: vi.fn(),
      prepareKeyBackupVersion: vi.fn()
    }

    mockClient = {
      isCryptoEnabled: vi.fn(() => true),
      getCrypto: vi.fn(() => mockCrypto),
      getUserId: vi.fn(() => '@user:example.com'),
      getDeviceId: vi.fn(() => 'DEVICE_1'),
      getRoom: vi.fn(),
      sendStateEvent: vi.fn(),
      isRoomEncrypted: vi.fn(() => false)
    }

    vi.mocked(matrixClientService.getClient).mockReset()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)

    matrixEncryptionService['crypto'] = null
  })

  describe('initialize', () => {
    it('should initialize with crypto enabled', async () => {
      await matrixEncryptionService.initialize()
      expect(matrixEncryptionService['crypto']).toBe(mockCrypto)
    })

    it('should handle crypto not enabled', async () => {
      mockClient.isCryptoEnabled = vi.fn(() => false)
      mockClient.getCrypto = vi.fn(() => undefined)

      await matrixEncryptionService.initialize()
      expect(matrixEncryptionService['crypto']).toBeNull()
    })

    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

      await expect(matrixEncryptionService.initialize()).rejects.toThrow()
    })
  })

  describe('isEncryptionAvailable', () => {
    it('should return true when crypto is available', async () => {
      matrixEncryptionService['crypto'] = mockCrypto

      const result = await matrixEncryptionService.isEncryptionAvailable()
      expect(result).toBe(true)
    })

    it('should return false when crypto is not available', async () => {
      matrixEncryptionService['crypto'] = null
      mockClient.getCrypto = vi.fn(() => null)

      const result = await matrixEncryptionService.isEncryptionAvailable()
      expect(result).toBe(false)
    })
  })

  describe('isRoomEncrypted', () => {
    it('should return false when client is not available', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

      const result = await matrixEncryptionService.isRoomEncrypted('!room:example.com')
      expect(result).toBe(false)
    })

    it('should return room encryption status', async () => {
      mockClient.isRoomEncrypted = vi.fn(() => true)

      const result = await matrixEncryptionService.isRoomEncrypted('!room:example.com')
      expect(result).toBe(true)
    })
  })

  describe('enableRoomEncryption', () => {
    it('should send encryption state event', async () => {
      mockClient.sendStateEvent = vi.fn().mockResolvedValue({})

      await matrixEncryptionService.enableRoomEncryption('!room:example.com')

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
        '!room:example.com',
        'm.room.encryption',
        expect.objectContaining({ algorithm: 'm.megolm.v1.aes-sha2' }),
        ''
      )
    })

    it('should include custom settings in state event', async () => {
      mockClient.sendStateEvent = vi.fn().mockResolvedValue({})

      await matrixEncryptionService.enableRoomEncryption('!room:example.com', {
        algorithm: 'm.megolm.v1.aes-sha2',
        rotationPeriodMs: 86400000,
        rotationPeriodMsgs: 50
      })

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
        '!room:example.com',
        'm.room.encryption',
        expect.objectContaining({
          algorithm: 'm.megolm.v1.aes-sha2',
          rotation_period_ms: 86400000,
          rotation_period_msgs: 50
        }),
        ''
      )
    })

    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

      await expect(matrixEncryptionService.enableRoomEncryption('!room:example.com')).rejects.toThrow()
    })
  })

  describe('getEncryptionSettings', () => {
    it('should return null when room is not found', async () => {
      mockClient.getRoom = vi.fn(() => null)

      const result = await matrixEncryptionService.getEncryptionSettings('!room:example.com')
      expect(result).toBeNull()
    })

    it('should return null when client is not available', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

      const result = await matrixEncryptionService.getEncryptionSettings('!room:example.com')
      expect(result).toBeNull()
    })
  })

  describe('getCrossSigningInfo', () => {
    it('should return isSetup false when crypto is not available', async () => {
      matrixEncryptionService['crypto'] = null
      mockClient.getCrypto = vi.fn(() => null)

      const result = await matrixEncryptionService.getCrossSigningInfo()
      expect(result.isSetup).toBe(false)
    })
  })
})
