import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackupInfo, KeyBackupManager, SecureBackupManager } from '@/types/matrix-extensions'
import matrixClientService from '../../MatrixClientService'
import { matrixKeyBackupService } from '../MatrixKeyBackupService'

describe('MatrixKeyBackupService', () => {
  let mockClient: Partial<MatrixClient>
  let mockKeyBackupManager: Partial<KeyBackupManager>
  let mockSecureBackupManager: Partial<SecureBackupManager>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient')
    mockKeyBackupManager = {
      checkKeyBackup: vi.fn(),
      prepareKeyBackupVersion: vi.fn(),
      createKeyBackupVersion: vi.fn(),
      deleteKeyBackupVersion: vi.fn(),
      restoreKeyBackupWithRecoveryKey: vi.fn(),
      scheduleKeyBackupSend: vi.fn(),
      getLatestBackupVersion: vi.fn(),
      getBackupVersion: vi.fn(),
      createBackupVersion: vi.fn(),
      updateBackupVersion: vi.fn(),
      deleteBackupVersion: vi.fn(),
      getAllRoomKeys: vi.fn(),
      putAllRoomKeys: vi.fn(),
      getRoomKeys: vi.fn(),
      putRoomKeys: vi.fn(),
      deleteAllRoomKeys: vi.fn(),
      deleteRoomKeys: vi.fn(),
      getSessionKey: vi.fn(),
      putSessionKey: vi.fn(),
      deleteSessionKey: vi.fn(),
      recoverKeys: vi.fn(),
      getRecoveryProgress: vi.fn(),
      verifyBackup: vi.fn(),
      batchRecover: vi.fn(),
      recoverRoomKeys: vi.fn(),
      recoverSessionKey: vi.fn(),
      exportKeys: vi.fn(),
      importKeys: vi.fn()
    }

    mockSecureBackupManager = {
      createSecureBackup: vi.fn(),
      getSecureBackup: vi.fn(),
      deleteSecureBackup: vi.fn(),
      addKeysToSecureBackup: vi.fn(),
      restoreFromSecureBackup: vi.fn(),
      verifySecureBackup: vi.fn(),
      clearCache: vi.fn()
    }

    mockClient = {
      getKeyBackupManager: vi.fn(() => mockKeyBackupManager as KeyBackupManager),
      getSecureBackupManager: vi.fn(() => mockSecureBackupManager as SecureBackupManager)
    } as unknown as Partial<MatrixClient>

    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)
    matrixKeyBackupService.initialize(mockClient as MatrixClient)
  })

  describe('checkKeyBackup', () => {
    it('应该通过 KeyBackupManager.getLatestBackupVersion 检查备份', async () => {
      const mockBackupInfo: BackupInfo = {
        version: 'v1',
        algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
        auth_data: { public_key: 'test_key' }
      }

      mockKeyBackupManager.getLatestBackupVersion = vi.fn().mockResolvedValue(mockBackupInfo)

      const result = await matrixKeyBackupService.checkKeyBackup()

      expect(result).toEqual(mockBackupInfo)
      expect(mockKeyBackupManager.getLatestBackupVersion).toHaveBeenCalled()
    })

    it('应该在没有备份时返回 null', async () => {
      const error = Object.assign(new Error('Not found'), { httpStatus: 404 })
      mockKeyBackupManager.getLatestBackupVersion = vi.fn().mockRejectedValue(error)

      const result = await matrixKeyBackupService.checkKeyBackup()

      expect(result).toBeNull()
    })

    it('应该在 KeyBackupManager 不可用时抛出错误', async () => {
      mockClient.getKeyBackupManager = vi.fn(() => null)

      await expect(matrixKeyBackupService.checkKeyBackup()).rejects.toThrow('[KeyBackup] KeyBackupManager 不可用')
    })
  })

  describe('createKeyBackupVersion', () => {
    it('应该创建密钥备份版本', async () => {
      const mockVersion = { version: 'v1' }
      mockKeyBackupManager.createBackupVersion = vi.fn().mockResolvedValue(mockVersion)

      const result = await matrixKeyBackupService.createKeyBackupVersion({
        algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
        auth_data: { public_key: 'test_key' }
      })

      expect(result).toEqual(mockVersion)
      expect(mockKeyBackupManager.createBackupVersion).toHaveBeenCalledWith('m.megolm_backup.v1.curve25519-aes-sha2', {
        public_key: 'test_key'
      })
    })

    it('应该处理创建失败', async () => {
      mockKeyBackupManager.createBackupVersion = vi.fn().mockRejectedValue(new Error('Failed to create'))

      await expect(
        matrixKeyBackupService.createKeyBackupVersion({
          algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
          auth_data: { public_key: 'test_key' }
        })
      ).rejects.toThrow('Failed to create')
    })
  })

  describe('deleteKeyBackupVersion', () => {
    it('应该删除密钥备份版本', async () => {
      mockKeyBackupManager.deleteBackupVersion = vi.fn().mockResolvedValue({ deleted: true, version: 'v1' })

      await matrixKeyBackupService.deleteKeyBackupVersion('v1')

      expect(mockKeyBackupManager.deleteBackupVersion).toHaveBeenCalledWith('v1')
    })
  })

  describe('restoreKeyBackup', () => {
    it('应该恢复备份', async () => {
      const mockResult = { total_keys: 10, recovered_keys: 10, rooms: {} }
      mockKeyBackupManager.recoverKeys = vi.fn().mockResolvedValue(mockResult)

      const result = await matrixKeyBackupService.restoreKeyBackup('v1')

      expect(result).toEqual({ total: 10, imported: 10 })
      expect(mockKeyBackupManager.recoverKeys).toHaveBeenCalledWith('v1', undefined)
    })

    it('应该恢复指定房间的备份', async () => {
      const mockResult = { total_keys: 5, recovered_keys: 5, rooms: {} }
      mockKeyBackupManager.recoverKeys = vi.fn().mockResolvedValue(mockResult)

      const result = await matrixKeyBackupService.restoreKeyBackup('v1', ['!room:example.com'])

      expect(result).toEqual({ total: 5, imported: 5 })
      expect(mockKeyBackupManager.recoverKeys).toHaveBeenCalledWith('v1', ['!room:example.com'])
    })
  })

  describe('scheduleKeyBackup', () => {
    it('应该调度密钥备份', () => {
      mockKeyBackupManager.scheduleKeyBackupSend = vi.fn()

      matrixKeyBackupService.scheduleKeyBackup()

      expect(mockKeyBackupManager.scheduleKeyBackupSend).toHaveBeenCalled()
    })
  })

  describe('getBackupKeysByVersion', () => {
    it('应该获取指定版本的备份密钥', async () => {
      const mockKeys = { rooms: {}, etag: 'etag1' }
      mockKeyBackupManager.getAllRoomKeys = vi.fn().mockResolvedValue(mockKeys)

      const result = await matrixKeyBackupService.getBackupKeysByVersion('v1')

      expect(result).toEqual(mockKeys)
      expect(mockKeyBackupManager.getAllRoomKeys).toHaveBeenCalledWith('v1')
    })

    it('应该处理获取失败', async () => {
      mockKeyBackupManager.getAllRoomKeys = vi.fn().mockRejectedValue(new Error('Not found'))

      await expect(matrixKeyBackupService.getBackupKeysByVersion('v99')).rejects.toThrow('Not found')
    })
  })

  describe('uploadKeysToVersion', () => {
    it('应该上传密钥到指定版本', async () => {
      const keys = { rooms: { '!room:example.com': { sessions: {} } } }
      mockKeyBackupManager.putAllRoomKeys = vi.fn().mockResolvedValue({ count: 1, etag: 'etag1' })

      await matrixKeyBackupService.uploadKeysToVersion('v1', keys)

      expect(mockKeyBackupManager.putAllRoomKeys).toHaveBeenCalledWith('v1', keys)
    })
  })

  describe('getRoomBackupKeys', () => {
    it('应该获取房间备份密钥', async () => {
      const mockRoomKeys = { sessions: {} }
      mockKeyBackupManager.getRoomKeys = vi.fn().mockResolvedValue(mockRoomKeys)

      const result = await matrixKeyBackupService.getRoomBackupKeys('v1', '!room:example.com')

      expect(result).toEqual(mockRoomKeys)
      expect(mockKeyBackupManager.getRoomKeys).toHaveBeenCalledWith('v1', '!room:example.com')
    })
  })

  describe('getSessionBackupKey', () => {
    it('应该获取会话备份密钥', async () => {
      const mockSessionKey = { session_data: {} }
      mockKeyBackupManager.getSessionKey = vi.fn().mockResolvedValue(mockSessionKey)

      const result = await matrixKeyBackupService.getSessionBackupKey('v1', '!room:example.com', 'session-1')

      expect(result).toEqual(mockSessionKey)
      expect(mockKeyBackupManager.getSessionKey).toHaveBeenCalledWith('v1', '!room:example.com', 'session-1')
    })
  })

  describe('batchRecover', () => {
    it('应该批量恢复密钥', async () => {
      const mockResult = { rooms: {}, total_sessions: 10, has_more: false }
      mockKeyBackupManager.batchRecover = vi.fn().mockResolvedValue(mockResult)

      const result = await matrixKeyBackupService.batchRecover('v1', { rooms: ['!room:example.com'], limit: 50 })

      expect(result).toEqual(mockResult)
      expect(mockKeyBackupManager.batchRecover).toHaveBeenCalledWith('v1', ['!room:example.com'], 50)
    })

    it('应该不带选项批量恢复', async () => {
      const mockResult = { rooms: {}, total_sessions: 0, has_more: false }
      mockKeyBackupManager.batchRecover = vi.fn().mockResolvedValue(mockResult)

      const result = await matrixKeyBackupService.batchRecover('v1')

      expect(result).toEqual(mockResult)
      expect(mockKeyBackupManager.batchRecover).toHaveBeenCalledWith('v1', [], undefined)
    })
  })

  describe('recoverRoomKeys', () => {
    it('应该恢复房间级密钥', async () => {
      const mockResult = { recovered: 5 }
      mockKeyBackupManager.recoverRoomKeys = vi.fn().mockResolvedValue(mockResult)

      const result = await matrixKeyBackupService.recoverRoomKeys('v1', '!room:example.com')

      expect(result).toEqual(mockResult)
      expect(mockKeyBackupManager.recoverRoomKeys).toHaveBeenCalledWith('v1', '!room:example.com')
    })
  })

  describe('recoverSessionKey', () => {
    it('应该恢复会话级密钥', async () => {
      const mockResult = { session_data: {} }
      mockKeyBackupManager.recoverSessionKey = vi.fn().mockResolvedValue(mockResult)

      const result = await matrixKeyBackupService.recoverSessionKey('v1', '!room:example.com', 'session-1')

      expect(result).toEqual(mockResult)
      expect(mockKeyBackupManager.recoverSessionKey).toHaveBeenCalledWith('v1', '!room:example.com', 'session-1')
    })
  })

  describe('exportKeysByVersion', () => {
    it('应该按版本导出密钥', async () => {
      const mockExport = { room_keys: [], version: 'v1' }
      mockKeyBackupManager.exportKeys = vi.fn().mockResolvedValue(mockExport)

      const result = await matrixKeyBackupService.exportKeysByVersion('v1')

      expect(result).toEqual(mockExport)
      expect(mockKeyBackupManager.exportKeys).toHaveBeenCalledWith('v1')
    })
  })

  describe('importKeysToVersion', () => {
    it('应该按版本导入密钥', async () => {
      const keys = { room_keys: [], version: 'v1' }
      const mockResult = { count: 10, failed: 0, total: 10 }
      mockKeyBackupManager.importKeys = vi.fn().mockResolvedValue(mockResult)

      const result = await matrixKeyBackupService.importKeysToVersion('v1', keys)

      expect(result).toEqual(mockResult)
      expect(mockKeyBackupManager.importKeys).toHaveBeenCalledWith([], 'v1')
    })
  })

  describe('Secure Backup', () => {
    describe('createSecureBackup', () => {
      it('应该创建安全备份', async () => {
        const mockSecureInfo = {
          backup_id: 'backup-1',
          algorithm: 'm.megolm_backup.v1',
          version: 'v1',
          auth_data: {},
          created_ts: 123,
          key_count: 0
        }
        mockSecureBackupManager.createSecureBackup = vi.fn().mockResolvedValue(mockSecureInfo)

        const result = await matrixKeyBackupService.createSecureBackup('my-passphrase')

        expect(result).toEqual({ id: 'backup-1', algorithm: 'm.megolm_backup.v1' })
        expect(mockSecureBackupManager.createSecureBackup).toHaveBeenCalledWith('my-passphrase')
      })
    })

    describe('getSecureBackup', () => {
      it('应该获取安全备份', async () => {
        const mockBackup = {
          backup_id: 'backup-1',
          algorithm: 'm.megolm_backup.v1',
          version: 'v1',
          auth_data: {},
          created_ts: 123,
          key_count: 0
        }
        mockSecureBackupManager.getSecureBackup = vi.fn().mockResolvedValue(mockBackup)

        const result = await matrixKeyBackupService.getSecureBackup('backup-1')

        expect(result).toEqual(mockBackup)
        expect(mockSecureBackupManager.getSecureBackup).toHaveBeenCalledWith('backup-1')
      })

      it('应该在获取失败时返回 null', async () => {
        mockSecureBackupManager.getSecureBackup = vi.fn().mockRejectedValue(new Error('Not found'))

        const result = await matrixKeyBackupService.getSecureBackup('nonexistent')

        expect(result).toBeNull()
      })
    })

    describe('deleteSecureBackup', () => {
      it('应该删除安全备份', async () => {
        mockSecureBackupManager.deleteSecureBackup = vi.fn().mockResolvedValue(undefined)

        await matrixKeyBackupService.deleteSecureBackup('backup-1')

        expect(mockSecureBackupManager.deleteSecureBackup).toHaveBeenCalledWith('backup-1')
      })

      it('应该处理删除失败', async () => {
        mockSecureBackupManager.deleteSecureBackup = vi.fn().mockRejectedValue(new Error('Delete failed'))

        await expect(matrixKeyBackupService.deleteSecureBackup('backup-1')).rejects.toThrow('Delete failed')
      })
    })

    describe('addKeysToSecureBackup', () => {
      it('应该写入密钥到安全备份', async () => {
        const sessionKeys = [{ session_id: 's1', session_data: {} }]
        mockSecureBackupManager.addKeysToSecureBackup = vi.fn().mockResolvedValue({ count: 1 })

        await matrixKeyBackupService.addKeysToSecureBackup('backup-1', 'passphrase', sessionKeys)

        expect(mockSecureBackupManager.addKeysToSecureBackup).toHaveBeenCalledWith(
          'backup-1',
          'passphrase',
          sessionKeys
        )
      })
    })

    describe('restoreFromSecureBackup', () => {
      it('应该从安全备份恢复', async () => {
        const mockRestoreResult = { recovered_keys: 10, total_keys: 10 }
        mockSecureBackupManager.restoreFromSecureBackup = vi.fn().mockResolvedValue(mockRestoreResult)

        const result = await matrixKeyBackupService.restoreFromSecureBackup('backup-1', 'passphrase')

        expect(result).toEqual({ count: 10, failed: 0, total: 10 })
        expect(mockSecureBackupManager.restoreFromSecureBackup).toHaveBeenCalledWith('backup-1', 'passphrase')
      })
    })

    describe('verifySecureBackup', () => {
      it('应该校验安全备份', async () => {
        const mockVerifyResult = { valid: true }
        mockSecureBackupManager.verifySecureBackup = vi.fn().mockResolvedValue(mockVerifyResult)

        const result = await matrixKeyBackupService.verifySecureBackup('backup-1', 'passphrase')

        expect(result.valid).toBe(true)
        expect(mockSecureBackupManager.verifySecureBackup).toHaveBeenCalledWith('backup-1', 'passphrase')
      })
    })
  })
})
