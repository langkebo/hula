import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 使用 vi.hoisted 创建 logSpy，使其在模块加载（vi.mock 工厂执行）时即可用
const logSpy = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }))
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => logSpy
}))

import matrixClientService from '../../MatrixClientService'
import { matrixVerificationService } from '../MatrixVerificationService'

describe('MatrixVerificationService', () => {
  let mockClient: Partial<MatrixClient>
  let mockCrypto: {
    requestDeviceVerification: ReturnType<typeof vi.fn>
    getDeviceVerificationStatus: ReturnType<typeof vi.fn>
    verificationRequests: Map<
      string,
      {
        accept: ReturnType<typeof vi.fn>
        cancel: ReturnType<typeof vi.fn>
        verifier?: { verify: ReturnType<typeof vi.fn> }
      }
    >
  }

  beforeEach(() => {
    mockCrypto = {
      requestDeviceVerification: vi.fn(),
      getDeviceVerificationStatus: vi.fn(),
      verificationRequests: new Map()
    }

    mockClient = {
      getCrypto: vi.fn(() => mockCrypto as unknown as MatrixClient['crypto']),
      on: vi.fn(),
      off: vi.fn(),
      getUserId: vi.fn(() => '@test:example.com'),
      getDeviceId: vi.fn(() => 'TEST_DEVICE')
    }

    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as MatrixClient)
    matrixVerificationService.initialize()
    ;(matrixVerificationService as unknown as { pendingRequests: Map<string, unknown> }).pendingRequests.clear()
    ;(matrixVerificationService as unknown as { observedClient: unknown }).observedClient = mockClient

    // 重置 logSpy 调用记录，避免用例间相互污染
    logSpy.info.mockClear()
    logSpy.error.mockClear()
    logSpy.warn.mockClear()
    logSpy.debug.mockClear()
  })

  describe('startSasVerification', () => {
    it('应该在未调用 initialize 时回退到 matrixClientService 并补绑监听', async () => {
      ;(matrixVerificationService as unknown as { observedClient: unknown }).observedClient = null
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)

      mockCrypto.requestDeviceVerification.mockResolvedValue({
        transactionId: 'fallback-transaction'
      })

      const result = await matrixVerificationService.startSasVerification('@user:example.com', 'DEVICE123')

      expect(result).toBe('fallback-transaction')
      expect(matrixClientService.getClient).toHaveBeenCalled()
      expect(mockClient.on).toHaveBeenCalled()
    })

    it('应该成功开始 SAS 验证', async () => {
      const mockTransactionId = 'test-transaction-123'
      mockCrypto.requestDeviceVerification.mockResolvedValue({
        transactionId: mockTransactionId
      })

      const result = await matrixVerificationService.startSasVerification('@user:example.com', 'DEVICE123')

      expect(result).toBe(mockTransactionId)
      expect(mockCrypto.requestDeviceVerification).toHaveBeenCalledWith('@user:example.com', 'DEVICE123')
    })

    it('应该在加密未启用时抛出错误', async () => {
      mockClient.getCrypto = vi.fn(() => undefined)

      await expect(matrixVerificationService.startSasVerification('@user:example.com', 'DEVICE123')).rejects.toThrow(
        '加密未启用'
      )
    })

    it('应该处理验证请求失败', async () => {
      mockCrypto.requestDeviceVerification.mockRejectedValue(new Error('Network error'))

      await expect(matrixVerificationService.startSasVerification('@user:example.com', 'DEVICE123')).rejects.toThrow(
        'Network error'
      )
    })
  })

  describe('verification actions', () => {
    it('应该接受已有的验证请求，而不是重新发起事务', async () => {
      const accept = vi.fn().mockResolvedValue(undefined)
      mockCrypto.verificationRequests.set('txn-1', {
        accept,
        cancel: vi.fn()
      })

      await expect(matrixVerificationService.acceptVerification('txn-1')).resolves.toBeUndefined()
      expect(accept).toHaveBeenCalledTimes(1)
      expect(mockCrypto.requestDeviceVerification).not.toHaveBeenCalled()
    })

    it('应该在找不到现有验证请求时抛错，而不是重新发起验证', async () => {
      ;(matrixVerificationService as unknown as { pendingRequests: Map<string, unknown> }).pendingRequests.set(
        'txn-2',
        {
          transactionId: 'txn-2',
          userId: '@user:example.com',
          deviceId: 'DEVICE123',
          methods: ['m.sas.v1'],
          timestamp: Date.now()
        }
      )

      await expect(matrixVerificationService.acceptVerification('txn-2')).rejects.toThrow('txn-2')
      expect(mockCrypto.requestDeviceVerification).not.toHaveBeenCalled()
    })

    it('应该确认 SAS 并清理待处理请求', async () => {
      const verify = vi.fn().mockResolvedValue(undefined)
      mockCrypto.verificationRequests.set('txn-3', {
        accept: vi.fn(),
        cancel: vi.fn(),
        verifier: { verify }
      })
      ;(matrixVerificationService as unknown as { pendingRequests: Map<string, unknown> }).pendingRequests.set(
        'txn-3',
        {
          transactionId: 'txn-3',
          userId: '@user:example.com',
          deviceId: 'DEVICE123',
          methods: ['m.sas.v1'],
          timestamp: Date.now()
        }
      )

      await expect(matrixVerificationService.confirmSas('txn-3')).resolves.toBeUndefined()
      expect(verify).toHaveBeenCalledTimes(1)
      expect(
        (matrixVerificationService as unknown as { pendingRequests: Map<string, unknown> }).pendingRequests.has('txn-3')
      ).toBe(false)
    })

    it('应该取消现有验证并清理待处理请求', async () => {
      const cancel = vi.fn().mockResolvedValue(undefined)
      mockCrypto.verificationRequests.set('txn-4', {
        accept: vi.fn(),
        cancel
      })
      ;(matrixVerificationService as unknown as { pendingRequests: Map<string, unknown> }).pendingRequests.set(
        'txn-4',
        {
          transactionId: 'txn-4',
          userId: '@user:example.com',
          deviceId: 'DEVICE123',
          methods: ['m.sas.v1'],
          timestamp: Date.now()
        }
      )

      await expect(matrixVerificationService.cancelVerification('txn-4', 'user_cancelled')).resolves.toBeUndefined()
      expect(cancel).toHaveBeenCalledWith({ reason: 'user_cancelled' })
      expect(
        (matrixVerificationService as unknown as { pendingRequests: Map<string, unknown> }).pendingRequests.has('txn-4')
      ).toBe(false)
    })
  })

  describe('isDeviceVerified', () => {
    it('应该返回设备验证状态', async () => {
      const mockDeviceInfo = {
        isVerified: vi.fn(() => true)
      }
      mockCrypto.getDeviceVerificationStatus.mockResolvedValue(mockDeviceInfo)

      const result = await matrixVerificationService.isDeviceVerified('@user:example.com', 'DEVICE123')

      expect(result).toBe(true)
      expect(mockCrypto.getDeviceVerificationStatus).toHaveBeenCalledWith('@user:example.com', 'DEVICE123')
    })

    it('应该在加密未启用时返回 false', async () => {
      mockClient.getCrypto = vi.fn(() => undefined)

      const result = await matrixVerificationService.isDeviceVerified('@user:example.com', 'DEVICE123')

      expect(result).toBe(false)
    })

    it('应该在获取状态失败时返回 false', async () => {
      mockCrypto.getDeviceVerificationStatus.mockRejectedValue(new Error('Failed'))

      const result = await matrixVerificationService.isDeviceVerified('@user:example.com', 'DEVICE123')

      expect(result).toBe(false)
    })
  })

  describe('getPendingVerifications', () => {
    it('应该在没有缓存请求时返回空数组', async () => {
      const result = await matrixVerificationService.getPendingVerifications()

      expect(result).toEqual([])
    })

    it('应该返回内存中缓存的待处理验证请求', async () => {
      mockCrypto.requestDeviceVerification.mockResolvedValue({
        transactionId: 'pending-transaction'
      })

      await matrixVerificationService.startSasVerification('@user:example.com', 'DEVICE123')

      const result = await matrixVerificationService.getPendingVerifications()

      expect(result).toEqual([
        expect.objectContaining({
          transactionId: 'pending-transaction',
          userId: '@user:example.com',
          deviceId: 'DEVICE123',
          methods: ['m.sas.v1']
        })
      ])
    })
  })

  describe('getCurrentUserId / getCurrentDeviceId 错误吞没', () => {
    it('getCurrentUserId 在获取客户端失败时应返回 null 并记录 error 日志', () => {
      // 让 getClient 抛错，触发 getCurrentUserId 的 catch 块
      vi.mocked(matrixClientService.getClient).mockImplementation(() => {
        throw new Error('client not initialized')
      })

      const result = matrixVerificationService.getCurrentUserId()

      expect(result).toBeNull()
      expect(logSpy.error).toHaveBeenCalledTimes(1)
    })

    it('getCurrentDeviceId 在获取客户端失败时应返回 null 并记录 error 日志', () => {
      vi.mocked(matrixClientService.getClient).mockImplementation(() => {
        throw new Error('client not initialized')
      })

      const result = matrixVerificationService.getCurrentDeviceId()

      expect(result).toBeNull()
      expect(logSpy.error).toHaveBeenCalledTimes(1)
    })
  })
})
