import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixVerificationService } from '../MatrixVerificationService'

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn()
  }
}))

describe('MatrixVerificationService', () => {
  let mockClient: Partial<MatrixClient>
  let mockCrypto: {
    requestDeviceVerification: ReturnType<typeof vi.fn>
    getDeviceVerificationStatus: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockCrypto = {
      requestDeviceVerification: vi.fn(),
      getDeviceVerificationStatus: vi.fn()
    }

    mockClient = {
      getCrypto: vi.fn(() => mockCrypto as unknown as MatrixClient['crypto']),
      on: vi.fn(), // 添加 on 方法用于事件监听
      off: vi.fn(),
      getUserId: vi.fn(() => '@test:example.com'),
      getDeviceId: vi.fn(() => 'TEST_DEVICE')
    }

    vi.mocked(matrixClientService.getClient).mockReset()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)
    matrixVerificationService.initialize()
    ;(matrixVerificationService as unknown as { pendingRequests: Map<string, unknown> }).pendingRequests.clear()
    ;(matrixVerificationService as unknown as { observedClient: unknown }).observedClient = mockClient
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
      mockClient.getCrypto = vi.fn(() => null)

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
      mockClient.getCrypto = vi.fn(() => null)

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
})
