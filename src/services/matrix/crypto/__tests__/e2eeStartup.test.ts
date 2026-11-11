import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  bootstrapE2EE: vi.fn(),
  reset: vi.fn()
}))

vi.mock('../MatrixE2EEBootstrapService', () => ({
  matrixE2EEBootstrapService: {
    bootstrapE2EE: mocks.bootstrapE2EE,
    reset: mocks.reset
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

import { startE2EE, stopE2EE } from '../e2eeStartup'

describe('e2eeStartup', () => {
  beforeEach(() => {
    mocks.bootstrapE2EE.mockReset().mockResolvedValue(undefined)
    mocks.reset.mockReset()
  })

  it('启动时调用一次 bootstrapE2EE', async () => {
    await startE2EE()
    expect(mocks.bootstrapE2EE).toHaveBeenCalledTimes(1)
  })

  it('bootstrapE2EE 抛错时不向调用方冒泡', async () => {
    mocks.bootstrapE2EE.mockRejectedValueOnce(new Error('crypto unavailable'))
    await expect(startE2EE()).resolves.toBeUndefined()
  })

  it('停止时复位 E2EE 状态', () => {
    stopE2EE()
    expect(mocks.reset).toHaveBeenCalledTimes(1)
  })

  it('reset 抛错时不影响调用方', () => {
    mocks.reset.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    expect(() => stopE2EE()).not.toThrow()
  })
})
