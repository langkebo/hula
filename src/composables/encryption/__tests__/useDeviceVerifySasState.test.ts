import { describe, expect, it, vi } from 'vitest'
import { useDeviceVerifySasState } from '../useDeviceVerifySasState'

/**
 * SAS 状态机的安全不变量：
 * **没有真实 SAS 就不可确认**，且过期事务的结果必须被丢弃。
 */

const SAS_VIEW = {
  emoji: [
    ['🐶', 'Dog'],
    ['🐱', 'Cat']
  ] as Array<readonly [string, string]>,
  decimal: [1, 2, 3] as readonly number[]
}

describe('useDeviceVerifySasState', () => {
  it('载入成功后 sasReady 为 true，但 canConfirm 仍要求用户勾选', async () => {
    const sas = useDeviceVerifySasState({
      waitForSasView: vi.fn(async () => SAS_VIEW),
      onUnavailable: vi.fn()
    })

    await expect(sas.load('txn-1', () => true)).resolves.toBe(true)
    expect(sas.sasReady.value).toBe(true)
    expect(sas.sasEmojis.value).toEqual([
      { emoji: '🐶', description: 'Dog' },
      { emoji: '🐱', description: 'Cat' }
    ])
    expect(sas.sasDecimal.value).toEqual([1, 2, 3])
    expect(sas.canConfirm.value).toBe(false)

    sas.sasConfirmed.value = true
    expect(sas.canConfirm.value).toBe(true)
  })

  it('无 SAS 时触发 onUnavailable 并保持不可确认', async () => {
    const onUnavailable = vi.fn()
    const sas = useDeviceVerifySasState({
      waitForSasView: vi.fn(async () => {
        throw new Error('no SAS yet')
      }),
      onUnavailable
    })

    await expect(sas.load('txn-1', () => true)).resolves.toBe(false)
    expect(onUnavailable).toHaveBeenCalledTimes(1)
    expect(sas.sasReady.value).toBe(false)
    expect(sas.canConfirm.value).toBe(false)
  })

  it('事务已不是当前事务时丢弃结果，不触发错误回调', async () => {
    const onUnavailable = vi.fn()
    let current = true
    const sas = useDeviceVerifySasState({
      waitForSasView: vi.fn(async () => {
        current = false // 等待期间用户取消/切换
        return SAS_VIEW
      }),
      onUnavailable
    })

    await expect(sas.load('txn-1', () => current)).resolves.toBe(false)
    expect(sas.sasReady.value).toBe(false)
    expect(onUnavailable).not.toHaveBeenCalled()
  })

  it('reset 会清空全部 SAS 状态（切回 intro / 关闭对话框）', async () => {
    const sas = useDeviceVerifySasState({
      waitForSasView: vi.fn(async () => SAS_VIEW),
      onUnavailable: vi.fn()
    })
    await sas.load('txn-1', () => true)
    sas.sasConfirmed.value = true

    sas.reset()

    expect(sas.sasReady.value).toBe(false)
    expect(sas.sasEmojis.value).toEqual([])
    expect(sas.sasDecimal.value).toEqual([])
    expect(sas.sasConfirmed.value).toBe(false)
    expect(sas.canConfirm.value).toBe(false)
  })
})
