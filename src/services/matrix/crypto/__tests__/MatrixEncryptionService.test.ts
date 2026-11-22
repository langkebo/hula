import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { matrixEncryptionService } from '../MatrixEncryptionService'

// 使用 vi.hoisted 创建 logger spy，确保在模块加载前可用
const loggerSpy = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => loggerSpy
}))

describe('MatrixEncryptionService', () => {
  let mockClient: Partial<MatrixClient>
  let mockRotationManager: ReturnType<MatrixClient['getKeyRotationManager']>

  beforeEach(() => {
    const rotationManager = {
      getStatus: vi.fn().mockResolvedValue({
        enabled: true,
        status: {},
        user_last_rotation: null
      }),
      postStatus: vi.fn().mockResolvedValue({
        enabled: true,
        status: { current_key_id: 'key_1' }
      }),
      postCheck: vi.fn().mockResolvedValue({
        interval_ms: 604800000,
        last_rotation: null,
        needs_rotation: false
      }),
      checkKeyValidity: vi.fn().mockResolvedValue({
        interval_ms: 604800000,
        last_rotation: 1700000000,
        needs_rotation: true
      }),
      rotateKey: vi.fn().mockResolvedValue({
        success: true,
        key_id: 'key_1',
        rotated_at: 1234567890
      }),
      getRotationHistory: vi.fn().mockResolvedValue({ rotations: [] }),
      revokeKey: vi.fn().mockResolvedValue({ revoked: 1 }),
      updateConfig: vi.fn().mockResolvedValue({}),
      postConfig: vi.fn().mockResolvedValue({})
    }
    mockRotationManager = rotationManager as unknown as ReturnType<MatrixClient['getKeyRotationManager']>

    mockClient = {
      getUserId: vi.fn(() => '@user:example.com'),
      deviceId: 'DEVICE_1',
      getRoom: vi.fn(),
      getKeyRotationManager: vi.fn(() => rotationManager) as unknown as MatrixClient['getKeyRotationManager']
    }

    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as MatrixClient)
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
        needsRotation: false,
        currentKeyId: 'key_1'
      })
      // ROOM-06：状态读取必须走 POST 变体，绕过 SDK 的 30s 本地缓存
      expect(vi.mocked(mockRotationManager.postStatus)).toHaveBeenCalled()
      expect(vi.mocked(mockRotationManager.getStatus)).not.toHaveBeenCalled()
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

  describe('configureKeyRotation', () => {
    it('should write config through postConfig', async () => {
      await matrixEncryptionService.configureKeyRotation(true, 14)

      expect(vi.mocked(mockRotationManager.postConfig)).toHaveBeenCalledWith({
        enabled: true,
        interval_ms: 14 * 24 * 60 * 60 * 1000
      })
      expect(vi.mocked(mockRotationManager.updateConfig)).not.toHaveBeenCalled()
    })

    it('should swallow forbidden errors (admin-only endpoint)', async () => {
      vi.mocked(mockRotationManager.postConfig).mockRejectedValueOnce({
        errcode: 'M_FORBIDDEN'
      })

      await expect(matrixEncryptionService.configureKeyRotation(false)).resolves.toBeUndefined()
    })
  })

  describe('checkKeyValidity', () => {
    it('should map the key validity response', async () => {
      const result = await matrixEncryptionService.checkKeyValidity('key_1')

      expect(vi.mocked(mockRotationManager.checkKeyValidity)).toHaveBeenCalledWith('key_1')
      expect(result).toEqual({
        keyId: 'key_1',
        needsRotation: true,
        lastRotation: 1700000000,
        intervalMs: 604800000
      })
    })

    it('should return null on request failure so callers never treat it as valid', async () => {
      vi.mocked(mockRotationManager.checkKeyValidity).mockRejectedValueOnce(new Error('boom'))

      await expect(matrixEncryptionService.checkKeyValidity('key_1')).resolves.toBeNull()
    })

    it('should return null when client is not available', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as unknown as MatrixClient)

      await expect(matrixEncryptionService.checkKeyValidity('key_1')).resolves.toBeNull()
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

  // R-07~R-10: getClient() 失败时不应静默吞没错误，必须记录 error 日志
  describe('getClient 失败时的错误日志记录 (R-07~R-10)', () => {
    beforeEach(() => {
      // 让 getClient 返回 null，BaseMatrixService.getClient() 会抛出错误，触发各方法的 catch 块
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as unknown as MatrixClient)
      // 清除 logger spy 的调用记录，确保断言只反映本次测试行为
      loggerSpy.error.mockClear()
    })

    it('R-07: getEncryptionSettings 在 getClient 失败时记录 error 日志', async () => {
      const result = await matrixEncryptionService.getEncryptionSettings('!room:example.com')
      expect(result).toBeNull()
      expect(loggerSpy.error).toHaveBeenCalled()
    })

    it('R-08: checkNeedsRotation 在 getClient 失败时记录 error 日志', async () => {
      const result = await matrixEncryptionService.checkNeedsRotation()
      expect(result).toBe(false)
      expect(loggerSpy.error).toHaveBeenCalled()
    })

    it('R-09: getCurrentDeviceId 在 getClient 失败时记录 error 日志', () => {
      const result = matrixEncryptionService.getCurrentDeviceId()
      expect(result).toBeNull()
      expect(loggerSpy.error).toHaveBeenCalled()
    })

    it('R-10: getRotationHistory 在 getClient 失败时记录 error 日志', async () => {
      const result = await matrixEncryptionService.getRotationHistory('DEVICE_1')
      expect(result).toEqual([])
      expect(loggerSpy.error).toHaveBeenCalled()
    })
  })
})
