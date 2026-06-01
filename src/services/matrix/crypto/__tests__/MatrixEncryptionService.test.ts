import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixEncryptionService } from '../MatrixEncryptionService'

const { getClientMock } = vi.hoisted(() => ({
  getClientMock: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: getClientMock
  },
  default: {
    getClient: getClientMock
  }
}))

describe('MatrixEncryptionService', () => {
  let mockClient: Partial<MatrixClient>

  beforeEach(() => {
    mockClient = {
      getUserId: vi.fn(() => '@user:example.com'),
      deviceId: 'DEVICE_1',
      getRoom: vi.fn(),
      getKeyRotationManager: vi.fn(() => ({
        postCheck: vi.fn().mockResolvedValue({
          enabled: true,
          interval_ms: 604800000,
          needs_rotation: false
        }),
        rotateKey: vi.fn().mockResolvedValue({
          success: true,
          key_id: 'key_1',
          rotated_at: 1234567890
        }),
        getRotationHistory: vi.fn().mockResolvedValue({ rotations: [] }),
        revokeKey: vi.fn().mockResolvedValue({ revoked: 1 }),
        updateConfig: vi.fn().mockResolvedValue({})
      }))
    }

    vi.mocked(matrixClientService.getClient).mockReset()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)
  })

  describe('getEncryptionSettings', () => {
    it('should return null when room is not found', async () => {
      mockClient.getRoom = vi.fn(() => null)

      const result = await matrixEncryptionService.getEncryptionSettings('!room:example.com')
      expect(result).toBeNull()
    })

    it('should return null when client is not available', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as unknown as MatrixClient)

      const result = await matrixEncryptionService.getEncryptionSettings('!room:example.com')
      expect(result).toBeNull()
    })

    it('should return encryption settings from room state', async () => {
      const mockRoom = {
        currentState: {
          getStateEvents: vi.fn(() => ({
            getContent: () => ({
              algorithm: 'm.megolm.v1.aes-sha2',
              rotation_period_ms: 86400000,
              rotation_period_msgs: 50
            })
          }))
        }
      }
      mockClient.getRoom = vi.fn(
        () => mockRoom as unknown as MatrixClient['getRoom'] extends (...args: unknown[]) => infer R ? R : never
      )

      const result = await matrixEncryptionService.getEncryptionSettings('!room:example.com')
      expect(result).toEqual({
        algorithm: 'm.megolm.v1.aes-sha2',
        rotationPeriodMs: 86400000,
        rotationPeriodMsgs: 50
      })
    })
  })

  describe('getKeyRotationStatus', () => {
    it('should return rotation status from key rotation manager', async () => {
      const result = await matrixEncryptionService.getKeyRotationStatus()
      expect(result).toEqual({
        enabled: true,
        intervalMs: 604800000,
        lastRotation: undefined,
        needsRotation: false
      })
    })

    it('should return default when client is not available', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as unknown as MatrixClient)

      const result = await matrixEncryptionService.getKeyRotationStatus()
      expect(result).toEqual({
        enabled: false,
        intervalMs: 0,
        needsRotation: false
      })
    })
  })

  describe('getCurrentDeviceId', () => {
    it('should return device id', () => {
      const result = matrixEncryptionService.getCurrentDeviceId()
      expect(result).toBe('DEVICE_1')
    })

    it('should return null when client is not available', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as unknown as MatrixClient)

      const result = matrixEncryptionService.getCurrentDeviceId()
      expect(result).toBeNull()
    })
  })
})
