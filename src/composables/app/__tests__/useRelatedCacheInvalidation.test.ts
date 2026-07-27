import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRelatedCacheInvalidation } from '@/composables/app/useRelatedCacheInvalidation'

describe('useRelatedCacheInvalidation — 关联缓存失效 (§9.2)', () => {
  let invalidation: ReturnType<typeof useRelatedCacheInvalidation>

  beforeEach(() => {
    invalidation = useRelatedCacheInvalidation()
  })

  describe('注册失效关系', () => {
    it('注册好友→DM 的关联失效', () => {
      const friendInvalidate = vi.fn()
      const dmInvalidate = vi.fn()

      invalidation.registerRelation({
        source: 'friend',
        target: 'dm',
        invalidate: dmInvalidate
      })
      invalidation.registerRelation({
        source: 'dm',
        target: 'friend',
        invalidate: friendInvalidate
      })

      invalidation.notifySourceChanged('friend', 'user1')

      expect(dmInvalidate).toHaveBeenCalledWith('user1')
      expect(friendInvalidate).not.toHaveBeenCalled()
    })

    it('注册 DM→好友 的关联失效', () => {
      const friendInvalidate = vi.fn()

      invalidation.registerRelation({
        source: 'dm',
        target: 'friend',
        invalidate: friendInvalidate
      })

      invalidation.notifySourceChanged('dm', 'room1')

      expect(friendInvalidate).toHaveBeenCalledWith('room1')
    })
  })

  describe('批量失效', () => {
    it('一个 source 变更触发多个 target 失效', () => {
      const dmInvalidate = vi.fn()
      const widgetInvalidate = vi.fn()

      invalidation.registerRelation({
        source: 'friend',
        target: 'dm',
        invalidate: dmInvalidate
      })
      invalidation.registerRelation({
        source: 'friend',
        target: 'widget',
        invalidate: widgetInvalidate
      })

      invalidation.notifySourceChanged('friend', 'user1')

      expect(dmInvalidate).toHaveBeenCalledWith('user1')
      expect(widgetInvalidate).toHaveBeenCalledWith('user1')
    })
  })

  describe('注销关系', () => {
    it('unregisterRelation 后不再触发失效', () => {
      const dmInvalidate = vi.fn()

      invalidation.registerRelation({
        source: 'friend',
        target: 'dm',
        invalidate: dmInvalidate
      })

      invalidation.unregisterRelation('friend', 'dm')
      invalidation.notifySourceChanged('friend', 'user1')

      expect(dmInvalidate).not.toHaveBeenCalled()
    })
  })

  describe('清除所有关系', () => {
    it('clear 后所有失效不再触发', () => {
      const dmInvalidate = vi.fn()
      const friendInvalidate = vi.fn()

      invalidation.registerRelation({
        source: 'friend',
        target: 'dm',
        invalidate: dmInvalidate
      })
      invalidation.registerRelation({
        source: 'dm',
        target: 'friend',
        invalidate: friendInvalidate
      })

      invalidation.clear()

      invalidation.notifySourceChanged('friend', 'user1')
      invalidation.notifySourceChanged('dm', 'room1')

      expect(dmInvalidate).not.toHaveBeenCalled()
      expect(friendInvalidate).not.toHaveBeenCalled()
    })
  })

  describe('预定义关联（好友↔DM）', () => {
    it('registerFriendDmRelation 建立双向关联', () => {
      const onFriendRemoved = vi.fn()
      const onDmLeft = vi.fn()

      invalidation.registerFriendDmRelation({
        onFriendRemoved,
        onDmLeft
      })

      // 删除好友 → 触发 DM 缓存失效
      invalidation.notifySourceChanged('friend', 'user1')
      expect(onFriendRemoved).toHaveBeenCalledWith('user1')

      // 离开 DM → 触发好友缓存失效
      invalidation.notifySourceChanged('dm', 'room1')
      expect(onDmLeft).toHaveBeenCalledWith('room1')
    })
  })
})
