import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

import { calculateCompressionRatio, compressAudioToMp3 } from '../AudioCompression'

describe('calculateCompressionRatio', () => {
  it('压缩后比原始小 50% 时返回 50', () => {
    expect(calculateCompressionRatio(1000, 500)).toBe(50)
  })

  it('完全未压缩（相等）时返回 0', () => {
    expect(calculateCompressionRatio(800, 800)).toBe(0)
  })

  it('压缩到 0 字节时返回 100', () => {
    expect(calculateCompressionRatio(1000, 0)).toBe(100)
  })

  it('压缩后比原始大时返回负数（按 Math.round 截断）', () => {
    // (1 - 1200/1000) * 100 = -20
    expect(calculateCompressionRatio(1000, 1200)).toBe(-20)
    // (1 - 2000/1000) * 100 = -100
    expect(calculateCompressionRatio(1000, 2000)).toBe(-100)
  })

  it('使用 Math.round 进行四舍五入', () => {
    // 1 - 1/3 ≈ 0.6667 → 67
    expect(calculateCompressionRatio(3000, 1000)).toBe(67)
    // 1 - 2/3 ≈ 0.3333 → 33
    expect(calculateCompressionRatio(3000, 2000)).toBe(33)
  })
})

describe('compressAudioToMp3 · 错误路径', () => {
  it('AudioContext 不可用时抛出包含 i18n key 的错误', async () => {
    // 临时移除 AudioContext 以模拟环境不支持
    const originalAudioContext = globalThis.AudioContext
    // @ts-expect-error 测试用：删除全局 AudioContext
    delete globalThis.AudioContext

    try {
      await expect(compressAudioToMp3(new ArrayBuffer(8))).rejects.toThrow('utils.audio_compression_failed')
    } finally {
      if (originalAudioContext) {
        globalThis.AudioContext = originalAudioContext
      }
    }
  })
})
