import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackupInfo, KeyBackupManager } from '@/types/matrix-extensions'
import matrixClientService from '../../MatrixClientService'
import { matrixKeyBackupService } from '../MatrixKeyBackupService'

// Mock matrixClientService
vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn()
  }
}))

describe('MatrixKeyBackupService', () => {
  let mockClient: Partial<MatrixClient>
  let mockKeyBackupManager: Partial<KeyBackupManager>
  let mockHttp: { authedRequest: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockHttp = {
      authedRequest: vi.fn()
    }

    mockKeyBackupManager = {
      checkKeyBackup: vi.fn(),
      prepareKeyBackupVersion: vi.fn(),
      createKeyBackupVersion: vi.fn(),
      deleteKeyBackupVersion: vi.fn(),
      restoreKeyBackupWithRecoveryKey: vi.fn(),
      scheduleKeyBackupSend: vi.fn()
    }

    mockClient = {
      http: mockHttp as unknown as MatrixClient['http'],
      getKeyBackupManager: vi.fn(() => mockKeyBackupManager as KeyBackupManager)
    }

    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)
    matrixKeyBackupService.initialize(mockClient as MatrixClient)
  })

  describe('checkKeyBackup', () => {
    it('应该在未调用 initialize 时回退到 matrixClientService', async () => {
      ;(matrixKeyBackupService as unknown as { client: unknown }).client = null

      const mockBackupInfo: BackupInfo = {
        version: 'v1',
        algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
        auth_data: { public_key: 'test_key' }
      }

      mockKeyBackupManager.checkKeyBackup = vi.fn().mockResolvedValue(mockBackupInfo)

      const result = await matrixKeyBackupService.checkKeyBackup()

      expect(matrixClientService.getClient).toHaveBeenCalled()
      expect(result).toEqual(mockBackupInfo)
    })

    it('应该通过 KeyBackupManager 检查备份', async () => {
      const mockBackupInfo: BackupInfo = {
        version: 'v1',
        algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
        auth_data: { public_key: 'test_key' }
      }

      mockKeyBackupManager.checkKeyBackup = vi.fn().mockResolvedValue(mockBackupInfo)

      const result = await matrixKeyBackupService.checkKeyBackup()

      expect(result).toEqual(mockBackupInfo)
      expect(mockKeyBackupManager.checkKeyBackup).toHaveBeenCalled()
    })

    it('应该在没有备份时返回 null', async () => {
      mockKeyBackupManager.checkKeyBackup = vi.fn().mockResolvedValue(null)

      const result = await matrixKeyBackupService.checkKeyBackup()

      expect(result).toBeNull()
    })

    it('应该降级到 HTTP 调用', async () => {
      mockClient.getKeyBackupManager = vi.fn(() => null)

      const mockBackupInfo: BackupInfo = {
        version: 'v1',
        algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
        auth_data: { public_key: 'test_key' }
      }

      mockHttp.authedRequest.mockResolvedValue(mockBackupInfo)

      const result = await matrixKeyBackupService.checkKeyBackup()

      expect(result).toEqual(mockBackupInfo)
      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'GET',
        '/_matrix/client/v3/room_keys/version',
        undefined,
        undefined
      )
    })
  })

  describe('createKeyBackupVersion', () => {
    it('应该创建密钥备份版本', async () => {
      const mockVersion = { version: 'v1' }
      mockKeyBackupManager.createKeyBackupVersion = vi.fn().mockResolvedValue(mockVersion)

      const result = await matrixKeyBackupService.createKeyBackupVersion({
        algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
        auth_data: { public_key: 'test_key' }
      })

      expect(result).toEqual(mockVersion)
      expect(mockKeyBackupManager.createKeyBackupVersion).toHaveBeenCalled()
    })

    it('应该处理创建失败', async () => {
      mockKeyBackupManager.createKeyBackupVersion = vi.fn().mockRejectedValue(new Error('Failed to create'))

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
      mockKeyBackupManager.deleteKeyBackupVersion = vi.fn().mockResolvedValue(undefined)

      await matrixKeyBackupService.deleteKeyBackupVersion('v1')

      expect(mockKeyBackupManager.deleteKeyBackupVersion).toHaveBeenCalledWith('v1')
    })
  })

  describe('restoreKeyBackup', () => {
    it('应该使用恢复密钥恢复备份', async () => {
      const mockResult = { total: 10, imported: 10 }
      mockKeyBackupManager.restoreKeyBackupWithRecoveryKey = vi.fn().mockResolvedValue(mockResult)

      const result = await matrixKeyBackupService.restoreKeyBackup('recovery_key_123')

      expect(result).toEqual(mockResult)
      expect(mockKeyBackupManager.restoreKeyBackupWithRecoveryKey).toHaveBeenCalledWith(
        'recovery_key_123',
        undefined,
        undefined,
        undefined
      )
    })

    it('应该恢复特定房间的备份', async () => {
      const mockResult = { total: 5, imported: 5 }
      mockKeyBackupManager.restoreKeyBackupWithRecoveryKey = vi.fn().mockResolvedValue(mockResult)

      const result = await matrixKeyBackupService.restoreKeyBackup('recovery_key_123', '!room:example.com')

      expect(result).toEqual(mockResult)
      expect(mockKeyBackupManager.restoreKeyBackupWithRecoveryKey).toHaveBeenCalledWith(
        'recovery_key_123',
        '!room:example.com',
        undefined,
        undefined
      )
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
      mockHttp.authedRequest.mockResolvedValue(mockKeys)

      const result = await matrixKeyBackupService.getBackupKeysByVersion('v1')

      expect(result).toEqual(mockKeys)
      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'GET',
        expect.stringContaining('/_matrix/client/v3/room_keys/keys/v1'),
        undefined,
        undefined
      )
    })

    it('应该处理获取失败', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('Not found'))

      await expect(matrixKeyBackupService.getBackupKeysByVersion('v99')).rejects.toThrow('Not found')
    })
  })

  describe('uploadKeysToVersion', () => {
    it('应该上传密钥到指定版本', async () => {
      const keys = { rooms: { '!room:example.com': { sessions: {} } } }
      mockHttp.authedRequest.mockResolvedValue(undefined)

      await matrixKeyBackupService.uploadKeysToVersion('v1', keys)

      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'PUT',
        expect.stringContaining('/_matrix/client/v3/room_keys/keys/v1'),
        undefined,
        keys
      )
    })
  })

  describe('getRoomBackupKeys', () => {
    it('应该获取房间备份密钥', async () => {
      const mockRoomKeys = { sessions: {} }
      mockHttp.authedRequest.mockResolvedValue(mockRoomKeys)

      const result = await matrixKeyBackupService.getRoomBackupKeys('v1', '!room:example.com')

      expect(result).toEqual(mockRoomKeys)
      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'GET',
        expect.stringContaining('/_matrix/client/v3/room_keys/keys/v1/'),
        undefined,
        undefined
      )
    })
  })

  describe('getSessionBackupKey', () => {
    it('应该获取会话备份密钥', async () => {
      const mockSessionKey = { session_data: {} }
      mockHttp.authedRequest.mockResolvedValue(mockSessionKey)

      const result = await matrixKeyBackupService.getSessionBackupKey('v1', '!room:example.com', 'session-1')

      expect(result).toEqual(mockSessionKey)
      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'GET',
        expect.stringContaining('/session-1'),
        undefined,
        undefined
      )
    })
  })

  describe('batchRecover', () => {
    it('应该批量恢复密钥', async () => {
      const mockResult = { rooms: {}, total_sessions: 10, has_more: false }
      mockHttp.authedRequest.mockResolvedValue(mockResult)

      const result = await matrixKeyBackupService.batchRecover('v1', { rooms: ['!room:example.com'], limit: 50 })

      expect(result).toEqual(mockResult)
      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'POST',
        expect.stringContaining('/_matrix/client/v3/room_keys/batch_recover'),
        undefined,
        expect.objectContaining({ version: 'v1', rooms: ['!room:example.com'], limit: 50 })
      )
    })

    it('应该不带选项批量恢复', async () => {
      const mockResult = { rooms: {}, total_sessions: 0, has_more: false }
      mockHttp.authedRequest.mockResolvedValue(mockResult)

      const result = await matrixKeyBackupService.batchRecover('v1')

      expect(result).toEqual(mockResult)
      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'POST',
        expect.stringContaining('/_matrix/client/v3/room_keys/batch_recover'),
        undefined,
        expect.objectContaining({ version: 'v1' })
      )
    })
  })

  describe('recoverRoomKeys', () => {
    it('应该恢复房间级密钥', async () => {
      const mockResult = { recovered: 5 }
      mockHttp.authedRequest.mockResolvedValue(mockResult)

      const result = await matrixKeyBackupService.recoverRoomKeys('v1', '!room:example.com')

      expect(result).toEqual(mockResult)
      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'GET',
        expect.stringContaining('/_matrix/client/v3/room_keys/recover/v1/'),
        undefined,
        undefined
      )
    })
  })

  describe('recoverSessionKey', () => {
    it('应该恢复会话级密钥', async () => {
      const mockResult = { session_data: {} }
      mockHttp.authedRequest.mockResolvedValue(mockResult)

      const result = await matrixKeyBackupService.recoverSessionKey('v1', '!room:example.com', 'session-1')

      expect(result).toEqual(mockResult)
      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'GET',
        expect.stringContaining('/session-1'),
        undefined,
        undefined
      )
    })
  })

  describe('exportKeysByVersion', () => {
    it('应该按版本导出密钥', async () => {
      const mockExport = { room_keys: [], version: 'v1' }
      mockHttp.authedRequest.mockResolvedValue(mockExport)

      const result = await matrixKeyBackupService.exportKeysByVersion('v1')

      expect(result).toEqual(mockExport)
      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'GET',
        expect.stringContaining('/_matrix/client/v3/room_keys/export/v1'),
        undefined,
        undefined
      )
    })
  })

  describe('importKeysToVersion', () => {
    it('应该按版本导入密钥', async () => {
      const keys = { room_keys: [], version: 'v1' }
      const mockResult = { count: 10, failed: 0, total: 10 }
      mockHttp.authedRequest.mockResolvedValue(mockResult)

      const result = await matrixKeyBackupService.importKeysToVersion('v1', keys)

      expect(result).toEqual(mockResult)
      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'POST',
        expect.stringContaining('/_matrix/client/v3/room_keys/import/v1'),
        undefined,
        keys
      )
    })
  })

  describe('Secure Backup', () => {
    describe('createSecureBackup', () => {
      it('应该创建安全备份', async () => {
        const mockResult = { id: 'backup-1', algorithm: 'm.megolm_backup.v1' }
        mockHttp.authedRequest.mockResolvedValue(mockResult)

        const result = await matrixKeyBackupService.createSecureBackup({
          algorithm: 'm.megolm_backup.v1',
          auth_data: { public_key: 'key123' }
        })

        expect(result).toEqual(mockResult)
        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          'POST',
          '/_matrix/client/v3/keys/backup/secure',
          undefined,
          expect.objectContaining({
            algorithm: 'm.megolm_backup.v1',
            auth_data: { public_key: 'key123' }
          })
        )
      })

      it('应该创建不带可选参数的安全备份', async () => {
        const mockResult = { id: 'backup-2', algorithm: '' }
        mockHttp.authedRequest.mockResolvedValue(mockResult)

        const result = await matrixKeyBackupService.createSecureBackup({})

        expect(result).toEqual(mockResult)
        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          'POST',
          '/_matrix/client/v3/keys/backup/secure',
          undefined,
          {}
        )
      })
    })

    describe('getSecureBackup', () => {
      it('应该获取安全备份', async () => {
        const mockBackup = { id: 'backup-1', algorithm: 'm.megolm_backup.v1' }
        mockHttp.authedRequest.mockResolvedValue(mockBackup)

        const result = await matrixKeyBackupService.getSecureBackup('backup-1')

        expect(result).toEqual(mockBackup)
        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          'GET',
          expect.stringContaining('/_matrix/client/v3/keys/backup/secure/backup-1'),
          undefined,
          undefined
        )
      })

      it('应该在获取失败时返回 null', async () => {
        mockHttp.authedRequest.mockRejectedValue(new Error('Not found'))

        const result = await matrixKeyBackupService.getSecureBackup('nonexistent')

        expect(result).toBeNull()
      })
    })

    describe('deleteSecureBackup', () => {
      it('应该删除安全备份', async () => {
        mockHttp.authedRequest.mockResolvedValue(undefined)

        await matrixKeyBackupService.deleteSecureBackup('backup-1')

        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          'DELETE',
          expect.stringContaining('/_matrix/client/v3/keys/backup/secure/backup-1'),
          undefined,
          undefined
        )
      })

      it('应该处理删除失败', async () => {
        mockHttp.authedRequest.mockRejectedValue(new Error('Delete failed'))

        await expect(matrixKeyBackupService.deleteSecureBackup('backup-1')).rejects.toThrow('Delete failed')
      })
    })

    describe('addKeysToSecureBackup', () => {
      it('应该写入密钥到安全备份', async () => {
        const keys = { sessions: { 'session-1': {} } }
        mockHttp.authedRequest.mockResolvedValue(undefined)

        await matrixKeyBackupService.addKeysToSecureBackup('backup-1', keys)

        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          'POST',
          expect.stringContaining('/_matrix/client/v3/keys/backup/secure/backup-1/keys'),
          undefined,
          keys
        )
      })
    })

    describe('restoreFromSecureBackup', () => {
      it('应该从安全备份恢复', async () => {
        const mockResult = { count: 10, failed: 0, total: 10 }
        mockHttp.authedRequest.mockResolvedValue(mockResult)

        const result = await matrixKeyBackupService.restoreFromSecureBackup('backup-1', 'recovery_key_123')

        expect(result).toEqual(mockResult)
        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          'POST',
          expect.stringContaining('/_matrix/client/v3/keys/backup/secure/backup-1/restore'),
          undefined,
          { recovery_key: 'recovery_key_123' }
        )
      })
    })

    describe('verifySecureBackup', () => {
      it('应该校验安全备份', async () => {
        const mockResult = { valid: true, algorithm: 'm.megolm_backup.v1', auth_data: {}, key_count: 100 }
        mockHttp.authedRequest.mockResolvedValue(mockResult)

        const result = await matrixKeyBackupService.verifySecureBackup('backup-1')

        expect(result).toEqual(mockResult)
        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          'POST',
          expect.stringContaining('/_matrix/client/v3/keys/backup/secure/backup-1/verify'),
          undefined,
          undefined
        )
      })
    })
  })
})
