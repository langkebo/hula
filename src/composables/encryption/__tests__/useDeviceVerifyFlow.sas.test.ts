import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('@/composables/common/useActionFeedback', () => ({ useActionFeedback: () => ({ showFeedback: vi.fn() }) }))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() })
}))

const svc = vi.hoisted(() => ({
  acceptVerification: vi.fn(),
  getSasView: vi.fn(),
  confirmSas: vi.fn(),
  mismatchSas: vi.fn(),
  cancelVerification: vi.fn(),
  getPendingVerifications: vi.fn(),
  startSasVerification: vi.fn()
}))

vi.mock('@/services/matrix/crypto/MatrixVerificationService', () => ({
  matrixVerificationService: svc
}))

import { useDeviceVerifyFlow } from '../useDeviceVerifyFlow'

/**
 * 安全回归：SAS 必须真实取自 SDK 并呈现给用户。
 *
 * 历史缺陷（V5）：`emojis` 被声明并重置为 []，但**从未赋值**——没有任何地方订阅
 * SDK 的 ShowSas 回调。移动端因此渲染一个空的 4x4 网格并要求用户点击"匹配"，
 * 用户确认了一个从未展示过的短认证字符串，形成假的安全信号。
 */

describe('useDeviceVerifyFlow SAS 生命周期', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.acceptVerification.mockResolvedValue(undefined)
    svc.confirmSas.mockResolvedValue(undefined)
    svc.mismatchSas.mockResolvedValue(undefined)
    svc.cancelVerification.mockResolvedValue(undefined)
  })

  it('接受验证请求后载入可展示的 SAS（emoji + decimal）', async () => {
    svc.getSasView.mockResolvedValue({
      emoji: [
        ['🐶', 'Dog'],
        ['🐱', 'Cat']
      ],
      decimal: [1234, 5678, 9012]
    })

    const flow = useDeviceVerifyFlow()
    await flow.acceptVerification('txn-1')

    expect(svc.getSasView).toHaveBeenCalledWith('txn-1')
    expect(flow.emojis.value).toHaveLength(2)
    // MobileDeviceVerifyDialog 读取的是 description 字段
    expect(flow.emojis.value[0]).toEqual({ emoji: '🐶', description: 'Dog' })
    expect(flow.sasDecimal.value).toEqual([1234, 5678, 9012])
  })

  it('SDK 无 SAS 可展示时进入失败态，不得让用户确认空白 SAS', async () => {
    svc.getSasView.mockRejectedValue(new Error('no SAS yet'))

    const flow = useDeviceVerifyFlow()
    const ok = await flow.acceptVerification('txn-1')

    expect(ok).toBe(false)
    expect(flow.step.value).toBe('failed')
    expect(flow.emojis.value).toEqual([])
  })

  it('用户判定不匹配时走 mismatchSas（发送 m.mismatched_sas），而非普通取消', async () => {
    svc.getSasView.mockResolvedValue({ emoji: [['🐶', 'Dog']], decimal: null })

    const flow = useDeviceVerifyFlow()
    await flow.acceptVerification('txn-1')
    await flow.confirmSas(false)

    expect(svc.mismatchSas).toHaveBeenCalledWith('txn-1')
    expect(flow.step.value).toBe('rejected')
  })

  it('用户确认匹配时调用 confirmSas 并进入成功态', async () => {
    svc.getSasView.mockResolvedValue({ emoji: [['🐶', 'Dog']], decimal: null })

    const flow = useDeviceVerifyFlow()
    await flow.acceptVerification('txn-1')
    await flow.confirmSas(true)

    expect(svc.confirmSas).toHaveBeenCalledWith('txn-1')
    expect(flow.step.value).toBe('success')
  })
})
