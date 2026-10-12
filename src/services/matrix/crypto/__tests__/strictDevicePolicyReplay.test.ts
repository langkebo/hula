import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `strictDevicePolicyReplay` 的单元测试。
 *
 * 两个契约：
 * 1. **尽力而为** —— 重放失败必须只记日志、绝不抛错（调用方在 `ensureCrypto` 末尾
 *    顺手调用，失败不得改变 crypto 初始化的结论）；
 * 2. **用动态 import 取 bootstrap** —— 静态导入会形成模块环，使
 *    `MatrixClientService` 的类字段初始化在求值期拿到 TDZ 绑定而整文件崩。
 *    该契约的端到端证据在 `MatrixCryptoStateTracker.test.ts`（修复前整文件
 *    "MatrixCryptoStateTracker is not a constructor"）。
 */

const hoisted = vi.hoisted(() => ({
  reapplyPersistedStrictness: vi.fn(),
  logSpies: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('@/services/matrix/crypto/strictDevicePolicyBootstrap', () => ({
  reapplyPersistedStrictness: (...args: unknown[]) => hoisted.reapplyPersistedStrictness(...(args as [])) as unknown
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => hoisted.logSpies
}))

import { replayPersistedStrictness } from '../strictDevicePolicyReplay'

describe('replayPersistedStrictness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.reapplyPersistedStrictness.mockReturnValue({ applied: 0, skipped: 0 })
  })

  it('成功路径：调用 bootstrap 的重放函数且不记 warn', async () => {
    await replayPersistedStrictness()

    expect(hoisted.reapplyPersistedStrictness).toHaveBeenCalledTimes(1)
    expect(hoisted.logSpies.warn).not.toHaveBeenCalled()
  })

  it('失败路径：吞掉异常并记 warn（绝不向外抛）', async () => {
    hoisted.reapplyPersistedStrictness.mockImplementation(() => {
      throw new Error('room store not ready')
    })

    await expect(replayPersistedStrictness()).resolves.toBeUndefined()

    expect(hoisted.logSpies.warn).toHaveBeenCalledTimes(1)
    const [message] = hoisted.logSpies.warn.mock.calls[0]
    expect(String(message)).toContain('严格模式偏好重放失败')
    expect(String(message)).toContain('room store not ready')
  })

  it('非 Error 抛出物也能被格式化（不出现 [object Object] 之外的二次异常）', async () => {
    hoisted.reapplyPersistedStrictness.mockImplementation(() => {
      throw 'plain-string-failure'
    })

    await expect(replayPersistedStrictness()).resolves.toBeUndefined()

    const [message] = hoisted.logSpies.warn.mock.calls[0]
    expect(String(message)).toContain('plain-string-failure')
  })

  it('重复调用每次都重放（不做一次性缓存，避免换账号后漏重放）', async () => {
    await replayPersistedStrictness()
    await replayPersistedStrictness()

    expect(hoisted.reapplyPersistedStrictness).toHaveBeenCalledTimes(2)
  })
})
