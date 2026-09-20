import type { MatrixClient } from 'matrix-js-sdk'
import { CryptoEvent, VerificationPhase } from 'matrix-js-sdk/crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
import {
  type SasVerificationView,
  VerificationService,
  type VerificationTransaction
} from '../MatrixVerificationService'

/**
 * 回归测试：验证事务查询必须走服务自己登记的 SDK VerificationRequest 注册表。
 *
 * 历史缺陷：getExistingVerificationRequest 读取 `crypto.verificationRequests`，
 * 该成员在 vendored matrix-js-sdk 中并不存在（仅存在于自造类型与单测 mock 中），
 * 导致 accept/confirm/cancel 必然抛错，用户永远无法完成设备验证。
 */

interface FakeVerifier {
  verify: ReturnType<typeof vi.fn>
  getShowSasCallbacks: ReturnType<typeof vi.fn>
}

interface FakeSdkRequest {
  transactionId: string
  userId: string
  deviceId: string
  methods: string[]
  phase: VerificationPhase
  accept: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  startVerification: ReturnType<typeof vi.fn>
  verifier: FakeVerifier | undefined
  /** SDK VerificationRequest 继承 TypedEventEmitter，服务靠它订阅阶段变化 */
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
}

function makeSdkRequest(overrides: Partial<FakeSdkRequest> = {}): FakeSdkRequest {
  const verifier: FakeVerifier = {
    verify: vi.fn(async () => undefined),
    getShowSasCallbacks: vi.fn(() => null)
  }

  return {
    transactionId: 'txn-1',
    userId: '@alice:example.com',
    deviceId: 'ALICE_DEVICE',
    methods: ['m.sas.v1'],
    phase: VerificationPhase.Requested,
    accept: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    startVerification: vi.fn(async () => verifier),
    verifier: undefined,
    on: vi.fn(),
    off: vi.fn(),
    ...overrides
  }
}

describe('VerificationService 事务注册表', () => {
  let service: VerificationService
  let mockClient: Partial<MatrixClient>
  let receivedHandler: ((request: unknown) => void) | undefined

  beforeEach(() => {
    service = new VerificationService()
    receivedHandler = undefined

    mockClient = {
      getCrypto: vi.fn(() => ({}) as never),
      on: vi.fn((event: string, handler: (request: unknown) => void) => {
        if (event === CryptoEvent.VerificationRequestReceived) {
          receivedHandler = handler
        }
      }),
      off: vi.fn(),
      getUserId: vi.fn(() => '@test:example.com'),
      getDeviceId: vi.fn(() => 'TEST_DEVICE')
    }

    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as MatrixClient)
    service.initialize()
  })

  /** 模拟 SDK 抛出一个验证请求（这是服务登记事务的唯一入口） */
  function emitRequest(request: FakeSdkRequest): void {
    receivedHandler?.(request)
  }

  it('acceptVerification 对已登记的请求调用 SDK accept', async () => {
    const request = makeSdkRequest()
    emitRequest(request)

    await service.acceptVerification('txn-1')

    expect(request.accept).toHaveBeenCalledTimes(1)
  })

  it('confirmSas 调用 ShowSas 回调的 confirm', async () => {
    const confirm = vi.fn(async () => undefined)
    const showSas = {
      sas: { emoji: [['🐶', 'Dog']] },
      confirm,
      mismatch: vi.fn(),
      cancel: vi.fn()
    }
    const verifier: FakeVerifier = {
      verify: vi.fn(async () => undefined),
      getShowSasCallbacks: vi.fn(() => showSas)
    }
    const request = makeSdkRequest({
      phase: VerificationPhase.Started,
      verifier,
      startVerification: vi.fn(async () => verifier)
    })
    emitRequest(request)

    await service.confirmSas('txn-1')

    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('confirmSas 在没有 SAS 可确认时抛错，而不是静默成功', async () => {
    const request = makeSdkRequest({ phase: VerificationPhase.Requested })
    emitRequest(request)

    await expect(service.confirmSas('txn-1')).rejects.toThrow()
  })

  it('cancelVerification 对已登记的请求调用 SDK cancel', async () => {
    const request = makeSdkRequest()
    emitRequest(request)

    await service.cancelVerification('txn-1', 'user declined')

    expect(request.cancel).toHaveBeenCalledTimes(1)
  })

  it('未登记的 transactionId 抛「未找到」，而不是「不可用」', async () => {
    await expect(service.acceptVerification('txn-unknown')).rejects.toThrow(/was not found/)
  })

  it('验证完成后事务从注册表移除', async () => {
    const request = makeSdkRequest()
    emitRequest(request)

    await service.cancelVerification('txn-1', 'done')

    await expect(service.acceptVerification('txn-1')).rejects.toThrow(/was not found/)
  })
})

describe('VerificationService SAS 视图', () => {
  let service: VerificationService
  let receivedHandler: ((request: unknown) => void) | undefined

  beforeEach(() => {
    service = new VerificationService()
    receivedHandler = undefined

    const mockClient: Partial<MatrixClient> = {
      getCrypto: vi.fn(() => ({}) as never),
      on: vi.fn((event: string, handler: (request: unknown) => void) => {
        if (event === CryptoEvent.VerificationRequestReceived) {
          receivedHandler = handler
        }
      }),
      off: vi.fn(),
      getUserId: vi.fn(() => '@test:example.com'),
      getDeviceId: vi.fn(() => 'TEST_DEVICE')
    }

    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as MatrixClient)
    service.initialize()
  })

  it('确认后返回可展示的 emoji 与 decimal', async () => {
    const verifier: FakeVerifier = {
      verify: vi.fn(async () => undefined),
      getShowSasCallbacks: vi.fn(() => ({
        sas: {
          emoji: [
            ['🐶', 'Dog'],
            ['🐱', 'Cat']
          ] as Array<[string, string]>,
          decimal: [1234, 5678, 9012] as [number, number, number]
        },
        confirm: vi.fn(async () => undefined),
        mismatch: vi.fn(),
        cancel: vi.fn()
      }))
    }
    const request = makeSdkRequest({
      phase: VerificationPhase.Started,
      verifier,
      startVerification: vi.fn(async () => verifier)
    })
    receivedHandler?.(request)

    const view: SasVerificationView = await service.getSasView('txn-1')

    expect(view.emoji).toEqual([
      ['🐶', 'Dog'],
      ['🐱', 'Cat']
    ])
    expect(view.decimal).toEqual([1234, 5678, 9012])
  })

  it('getSasView 对未开始验证的请求抛错', async () => {
    const request = makeSdkRequest({ phase: VerificationPhase.Requested })
    receivedHandler?.(request)

    await expect(service.getSasView('txn-1')).rejects.toThrow()
  })
})

describe('VerificationService 事务列表', () => {
  it('未登记的 id 不会出现在列表中', async () => {
    const service = new VerificationService()
    const list: VerificationTransaction[] = await service.getPendingVerifications()
    expect(list).toEqual([])
  })
})
