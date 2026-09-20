import type { MatrixClient } from 'matrix-js-sdk'
import { CryptoEvent, VerificationPhase } from 'matrix-js-sdk/crypto'
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
import { VerificationService } from '../MatrixVerificationService'

/**
 * SDK VerificationRequest 的真身形状（仅取本服务实际使用的成员）。
 *
 * 注意：不接受 `verificationRequests` 这类幻影成员——它在本仓的
 * vendored matrix-js-sdk 中并不存在，服务改为在自己的注册表中登记真身对象。
 */
interface FakeSdkRequest {
  transactionId: string
  /** SDK 对端用户字段名为 otherUserId（不是 userId） */
  otherUserId: string
  /** SDK 对端设备字段名为 otherDeviceId（不是 deviceId） */
  otherDeviceId: string
  methods: string[]
  phase: VerificationPhase
  accept: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  verifier: { getShowSasCallbacks: ReturnType<typeof vi.fn> } | undefined
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
}

function makeSdkRequest(overrides: Partial<FakeSdkRequest> = {}): FakeSdkRequest {
  return {
    transactionId: 'txn-1',
    otherUserId: '@user:example.com',
    otherDeviceId: 'DEVICE123',
    methods: ['m.sas.v1'],
    phase: VerificationPhase.Requested,
    accept: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    verifier: undefined,
    on: vi.fn(),
    off: vi.fn(),
    ...overrides
  }
}

describe('MatrixVerificationService', () => {
  let service: VerificationService
  let mockClient: Partial<MatrixClient>
  let mockCrypto: {
    requestDeviceVerification: ReturnType<typeof vi.fn>
    getDeviceVerificationStatus: ReturnType<typeof vi.fn>
  }
  let receivedHandler: ((request: FakeSdkRequest) => void) | undefined

  beforeEach(() => {
    service = new VerificationService()
    receivedHandler = undefined

    mockCrypto = {
      requestDeviceVerification: vi.fn(),
      getDeviceVerificationStatus: vi.fn()
    }

    mockClient = {
      getCrypto: vi.fn(() => mockCrypto as unknown as MatrixClient['crypto']),
      getUserId: vi.fn(() => '@test:example.com'),
      getDeviceId: vi.fn(() => 'TEST_DEVICE')
    }

    // on/off 用宽签名 stub：本测试只关心服务是否订阅了 CryptoEvent.VerificationRequestReceived
    const onStub = vi.fn((event: string, handler: (request: FakeSdkRequest) => void) => {
      if (event === CryptoEvent.VerificationRequestReceived) {
        receivedHandler = handler
      }
    })
    mockClient.on = onStub as unknown as MatrixClient['on']
    mockClient.off = vi.fn() as unknown as MatrixClient['off']

    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as MatrixClient)
    service.initialize()

    // 重置 logSpy 调用记录，避免用例间相互污染
    logSpy.info.mockClear()
    logSpy.error.mockClear()
    logSpy.warn.mockClear()
    logSpy.debug.mockClear()
  })

  describe('startSasVerification', () => {
    it('应该在未调用 initialize 时回退到 matrixClientService 并补绑监听', async () => {
      const bare = new VerificationService()
      mockCrypto.requestDeviceVerification.mockResolvedValue(makeSdkRequest({ transactionId: 'fallback-transaction' }))

      const result = await bare.startSasVerification('@user:example.com', 'DEVICE123')

      expect(result).toBe('fallback-transaction')
      expect(matrixClientService.getClient).toHaveBeenCalled()
      expect(mockClient.on).toHaveBeenCalled()
    })

    it('应该成功开始 SAS 验证', async () => {
      mockCrypto.requestDeviceVerification.mockResolvedValue(makeSdkRequest({ transactionId: 'test-transaction-123' }))

      const result = await service.startSasVerification('@user:example.com', 'DEVICE123')

      expect(result).toBe('test-transaction-123')
      expect(mockCrypto.requestDeviceVerification).toHaveBeenCalledWith('@user:example.com', 'DEVICE123')
    })

    it('应该在加密未启用时抛出错误', async () => {
      mockClient.getCrypto = vi.fn(() => undefined)

      await expect(service.startSasVerification('@user:example.com', 'DEVICE123')).rejects.toThrow('加密未启用')
    })

    it('应该处理验证请求失败', async () => {
      mockCrypto.requestDeviceVerification.mockRejectedValue(new Error('Network error'))

      await expect(service.startSasVerification('@user:example.com', 'DEVICE123')).rejects.toThrow('Network error')
    })
  })

  describe('verification actions', () => {
    it('应该接受已有的验证请求，而不是重新发起事务', async () => {
      const request = makeSdkRequest()
      receivedHandler?.(request)

      await expect(service.acceptVerification('txn-1')).resolves.toBeUndefined()
      expect(request.accept).toHaveBeenCalledTimes(1)
      expect(mockCrypto.requestDeviceVerification).not.toHaveBeenCalled()
    })

    it('应该在找不到现有验证请求时抛错，而不是重新发起验证', async () => {
      await expect(service.acceptVerification('txn-2')).rejects.toThrow('txn-2')
      expect(mockCrypto.requestDeviceVerification).not.toHaveBeenCalled()
    })

    it('应该确认 SAS 并调用 ShowSas 回调的 confirm', async () => {
      const confirm = vi.fn(async () => undefined)
      const request = makeSdkRequest({
        transactionId: 'txn-3',
        phase: VerificationPhase.Started,
        verifier: {
          getShowSasCallbacks: vi.fn(() => ({
            sas: { emoji: [['🐶', 'Dog']] },
            confirm,
            mismatch: vi.fn(),
            cancel: vi.fn()
          }))
        }
      })
      receivedHandler?.(request)

      await expect(service.confirmSas('txn-3')).resolves.toBeUndefined()
      expect(confirm).toHaveBeenCalledTimes(1)
    })

    it('应该在取消现有验证时清理注册表', async () => {
      const request = makeSdkRequest({ transactionId: 'txn-4' })
      receivedHandler?.(request)

      await expect(service.cancelVerification('txn-4', 'user_cancelled')).resolves.toBeUndefined()
      expect(request.cancel).toHaveBeenCalledWith({ reason: 'user_cancelled' })

      // 已注销：再次操作必须报「未找到」
      await expect(service.acceptVerification('txn-4')).rejects.toThrow(/was not found/)
    })
  })

  describe('isDeviceVerified', () => {
    it('应该返回设备验证状态', async () => {
      mockCrypto.getDeviceVerificationStatus.mockResolvedValue({
        isVerified: vi.fn(() => true)
      })

      const result = await service.isDeviceVerified('@user:example.com', 'DEVICE123')

      expect(result).toBe(true)
      expect(mockCrypto.getDeviceVerificationStatus).toHaveBeenCalledWith('@user:example.com', 'DEVICE123')
    })

    it('应该在加密未启用时返回 false', async () => {
      mockClient.getCrypto = vi.fn(() => undefined)

      const result = await service.isDeviceVerified('@user:example.com', 'DEVICE123')

      expect(result).toBe(false)
    })

    it('应该在获取状态失败时返回 false', async () => {
      mockCrypto.getDeviceVerificationStatus.mockRejectedValue(new Error('Failed'))

      const result = await service.isDeviceVerified('@user:example.com', 'DEVICE123')

      expect(result).toBe(false)
    })
  })

  describe('getPendingVerifications', () => {
    it('应该在没有缓存请求时返回空数组', async () => {
      const result = await service.getPendingVerifications()

      expect(result).toEqual([])
    })

    it('应该返回已登记的待处理验证请求', async () => {
      receivedHandler?.(
        makeSdkRequest({
          transactionId: 'pending-transaction',
          otherUserId: '@user:example.com',
          otherDeviceId: 'DEVICE123',
          methods: ['m.sas.v1']
        })
      )

      const result = await service.getPendingVerifications()

      // 视图把 SDK 的 otherUserId/otherDeviceId 归一化为 userId/deviceId
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
      vi.mocked(matrixClientService.getClient).mockImplementation(() => {
        throw new Error('client not initialized')
      })

      const result = service.getCurrentUserId()

      expect(result).toBeNull()
      expect(logSpy.error).toHaveBeenCalledTimes(1)
    })

    it('getCurrentDeviceId 在获取客户端失败时应返回 null 并记录 error 日志', () => {
      vi.mocked(matrixClientService.getClient).mockImplementation(() => {
        throw new Error('client not initialized')
      })

      const result = service.getCurrentDeviceId()

      expect(result).toBeNull()
      expect(logSpy.error).toHaveBeenCalledTimes(1)
    })
  })
})
