import { beforeEach, describe, expect, it } from 'vitest'
import { setTrayMenuShow } from '@/common/globalUiState'

describe('globalUiState', () => {
  describe('setTrayMenuShow', () => {
    beforeEach(() => {
      // 重置为已知状态，避免模块级状态在测试间互相影响
      setTrayMenuShow(false)
    })

    it('setTrayMenuShow(true) 返回 true', () => {
      expect(setTrayMenuShow(true)).toBe(true)
    })

    it('setTrayMenuShow(false) 返回 false', () => {
      expect(setTrayMenuShow(false)).toBe(false)
    })

    it('多次调用状态正确切换', () => {
      expect(setTrayMenuShow(true)).toBe(true)
      expect(setTrayMenuShow(false)).toBe(false)
      expect(setTrayMenuShow(true)).toBe(true)
      expect(setTrayMenuShow(true)).toBe(true)
      expect(setTrayMenuShow(false)).toBe(false)
    })
  })
})
