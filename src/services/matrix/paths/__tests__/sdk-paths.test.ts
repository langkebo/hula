import { describe, expect, it } from 'vitest'
import { BURN_AFTER_READ_PATHS, FRIEND_PATHS, ROOM_PATHS, SDK_PATHS, validateTjgPath, WIDGET_PATHS } from '../sdk-paths'

describe('sdk-paths', () => {
  it('re-exports grouped route tables', () => {
    expect(Array.isArray(FRIEND_PATHS)).toBe(true)
    expect(Array.isArray(ROOM_PATHS)).toBe(true)
    expect(Array.isArray(WIDGET_PATHS)).toBe(true)
    expect(Array.isArray(BURN_AFTER_READ_PATHS)).toBe(true)
  })

  it('SDK_PATHS aggregates all route tables', () => {
    const total = FRIEND_PATHS.length + ROOM_PATHS.length + WIDGET_PATHS.length + BURN_AFTER_READ_PATHS.length
    expect(SDK_PATHS.length).toBe(total)
    SDK_PATHS.forEach((r) => {
      expect(typeof r.method).toBe('string')
      expect(typeof r.path).toBe('string')
    })
  })

  describe('validateTjgPath', () => {
    it('returns true for exact literal path', () => {
      expect(validateTjgPath('/_matrix/vendor/v1/friends')).toBe(true)
    })

    it('returns true for path with concrete param segment', () => {
      // 若路由模板含 {param}，则具体值应匹配
      const anyMatch = SDK_PATHS.some((r) => r.path.includes('{'))
      if (anyMatch) {
        // 构造一个具体值路径：取第一个含占位符的路由，替换第一个 {x} 为 'abc'
        const sample = SDK_PATHS.find((r) => r.path.includes('{'))!
        const concrete = sample.path.replace(/\{[^}]+\}/, 'abc')
        expect(validateTjgPath(concrete)).toBe(true)
      }
    })

    it('returns false for unknown path', () => {
      expect(validateTjgPath('/_matrix/client/v1/definitely/not/a/route')).toBe(false)
    })
  })
})
