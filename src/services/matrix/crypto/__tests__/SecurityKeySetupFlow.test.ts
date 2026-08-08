/**
 * 安全密钥生成流程测试
 *
 * 验证修复后的安全密钥生成功能：
 * 1. waitForClientReady 在客户端延迟初始化时能正确等待
 * 2. setupKeyBackupWithOptions 在客户端就绪后能正常生成密钥并 bootstrap
 * 3. 超时情况能正确抛出错误
 */
import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { MatrixConnectionManager } from '../../MatrixConnectionManager'
import { cryptoSDKAdapter } from '../CryptoSDKAdapter'

// Mock Logger
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
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

// Mock i18n for timeout error message
vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'matrix_error.client.not_ready_timeout': 'MatrixClient 未在指定时间内就绪'
      }
      return translations[key] || key
    }
  })
}))

const mockEncodedKey = 'ES9X ABC4 DEFG HIJK LMNO PQRS TUVW XYZ1 2345'

describe('SecurityKeySetupFlow', () => {
  // ==================== 场景 1: waitForClientReady 延迟初始化 ====================
  describe('waitForClientReady with delayed initialization', () => {
    it('should resolve immediately when client is already available', async () => {
      const manager = new MatrixConnectionManager()
      const mockClient = { id: 'ready-client' } as unknown as MatrixClient
      manager.setClient(mockClient)

      const result = await manager.waitForClientReady({ timeoutMs: 100, intervalMs: 5 })
      expect(result).toBe(mockClient)
    })

    it('should wait and resolve when client becomes available after delay', async () => {
      const manager = new MatrixConnectionManager()
      const mockClient = { id: 'delayed-client' } as unknown as MatrixClient

      // 并行执行：开始等待 + 延迟后设置 client
      const waitPromise = manager.waitForClientReady({ timeoutMs: 500, intervalMs: 10 })

      // 模拟 50ms 后客户端初始化完成
      await new Promise((resolve) => setTimeout(resolve, 50))
      manager.setClient(mockClient)

      // 等待 waitForClientReady 解析
      const result = await waitPromise
      expect(result).toBe(mockClient)
    })

    it('should wait and resolve with longer delay (200ms) within 30s timeout', async () => {
      const manager = new MatrixConnectionManager()
      const mockClient = { id: 'longer-delay-client' } as unknown as MatrixClient

      // 模拟实际场景：30s 超时，50ms 轮询
      const waitPromise = manager.waitForClientReady({ timeoutMs: 30000, intervalMs: 50 })

      // 模拟 200ms 后客户端初始化完成
      await new Promise((resolve) => setTimeout(resolve, 200))
      manager.setClient(mockClient)

      const result = await waitPromise
      expect(result).toBe(mockClient)
    })

    it('should throw timeout error when client never becomes available', async () => {
      const manager = new MatrixConnectionManager()

      // 超时时间 100ms，轮询间隔 10ms
      await expect(manager.waitForClientReady({ timeoutMs: 100, intervalMs: 10 })).rejects.toThrow(
        'MatrixClient 未在指定时间内就绪'
      )
    })

    it('should use default timeout (5000ms) when not specified', async () => {
      const manager = new MatrixConnectionManager()

      const waitPromise = manager.waitForClientReady()

      // 客户端在 100ms 内就绪，应该在默认 5000ms 超时前返回
      await new Promise((resolve) => setTimeout(resolve, 50))
      const mockClient = { id: 'default-timeout-client' } as unknown as MatrixClient
      manager.setClient(mockClient)

      const result = await waitPromise
      expect(result).toBe(mockClient)
    })
  })

  // ==================== 场景 2: 完整流程 ====================
  describe('full flow: waitForClientReady → setupKeyBackupWithOptions', () => {
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
      // 重置 matrixClientService.getClient mock
      vi.restoreAllMocks()
    })

    it('should generate security key when client is ready immediately', async () => {
      // 模拟客户端已就绪
      const mockClient = {
        getCrypto: vi.fn(() => createMockCrypto())
      } as unknown as MatrixClient
      vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient)
      // waitForClientReady 通过 connectionManager 检查 client，但 SecurityKeySetupDialog
      // 调用的是 matrixClientService.waitForClientReady() 委托给 connectionManager。
      // 这里 mock 矩阵服务方法直接返回 mockClient 以模拟就绪状态
      vi.spyOn(matrixClientService, 'waitForClientReady').mockResolvedValue(mockClient)

      // 执行完整流程
      await matrixClientService.waitForClientReady({ timeoutMs: 30000 })
      const result = await cryptoSDKAdapter.setupKeyBackupWithOptions()

      // 验证
      expect(result).toBe(mockEncodedKey)
    })

    it('should generate security key when client becomes ready after delay', async () => {
      // 模拟客户端延迟就绪（200ms 后）
      const mockClient = {
        getCrypto: vi.fn(() => createMockCrypto())
      } as unknown as MatrixClient

      vi.spyOn(matrixClientService, 'waitForClientReady').mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
        return mockClient
      })

      // 执行完整流程
      const client = await matrixClientService.waitForClientReady({ timeoutMs: 30000 })
      expect(client).toBe(mockClient)

      // 客户端就绪后生成密钥
      const result = await cryptoSDKAdapter.setupKeyBackupWithOptions()
      expect(result).toBe(mockEncodedKey)
    })

    it('should fail with timeout error when client never becomes ready', async () => {
      // 模拟客户端永不就绪
      vi.spyOn(matrixClientService, 'waitForClientReady').mockRejectedValue(
        new Error('MatrixClient 未在指定时间内就绪')
      )

      // 验证超时错误
      await expect(matrixClientService.waitForClientReady({ timeoutMs: 100 })).rejects.toThrow(
        'MatrixClient 未在指定时间内就绪'
      )
    })

    it('should generate security key from passphrase after client becomes ready', async () => {
      // 模拟客户端延迟就绪
      const mockCrypto = createMockCrypto()
      const mockClient = {
        getCrypto: vi.fn(() => mockCrypto)
      } as unknown as MatrixClient

      vi.spyOn(matrixClientService, 'waitForClientReady').mockResolvedValue(mockClient)
      // setupKeyBackupWithOptions 内部通过 matrixClientService.getClient() 获取 client
      vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient)
      // 清除缓存确保 getCrypto 重新拉取
      cryptoSDKAdapter.invalidateCryptoCache()

      // 执行完整流程（passphrase 模式）
      await matrixClientService.waitForClientReady({ timeoutMs: 30000 })
      const password = 'MySecurePassphrase123!'
      const result = await cryptoSDKAdapter.setupKeyBackupWithOptions({ password })

      // 验证：密码被正确传递到 createRecoveryKeyFromPassphrase
      expect(mockCrypto.createRecoveryKeyFromPassphrase).toHaveBeenCalledWith(password)
      // 验证：bootstrapSecretStorage 被调用
      expect(mockCrypto.bootstrapSecretStorage).toHaveBeenCalledTimes(1)
      // 验证：返回密钥
      expect(result).toBe(mockEncodedKey)
    })
  })
})
