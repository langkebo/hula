import { beforeEach, describe, expect, it } from 'vitest'
import { getCurrentSessionRoomId, setCurrentSessionRoomId } from '@/common/currentSessionRoomState'

describe('currentSessionRoomState', () => {
  beforeEach(() => {
    // 重置为初始空值，避免模块级状态在测试间互相影响
    setCurrentSessionRoomId('')
  })

  describe('getCurrentSessionRoomId', () => {
    it('初始值为空字符串', () => {
      expect(getCurrentSessionRoomId()).toBe('')
    })

    it('返回已设置的值', () => {
      setCurrentSessionRoomId('!abc:matrix.org')
      expect(getCurrentSessionRoomId()).toBe('!abc:matrix.org')
    })
  })

  describe('setCurrentSessionRoomId', () => {
    it("setCurrentSessionRoomId('!room:server') 返回 '!room:server'", () => {
      expect(setCurrentSessionRoomId('!room:server')).toBe('!room:server')
    })

    it('设置后可通过 getCurrentSessionRoomId 读取', () => {
      setCurrentSessionRoomId('!room:server')
      expect(getCurrentSessionRoomId()).toBe('!room:server')
    })

    it('多次设置覆盖前值', () => {
      setCurrentSessionRoomId('!first:server')
      expect(getCurrentSessionRoomId()).toBe('!first:server')

      setCurrentSessionRoomId('!second:server')
      expect(getCurrentSessionRoomId()).toBe('!second:server')

      setCurrentSessionRoomId('!third:server')
      expect(getCurrentSessionRoomId()).toBe('!third:server')
    })

    it('设置为空字符串覆盖前值', () => {
      setCurrentSessionRoomId('!room:server')
      expect(getCurrentSessionRoomId()).toBe('!room:server')

      setCurrentSessionRoomId('')
      expect(getCurrentSessionRoomId()).toBe('')
    })
  })
})
