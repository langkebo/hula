import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import type { SessionItem } from '../chat'
import { useSessionUnreadStore } from '../sessionUnread'

const makeSession = (overrides: Partial<SessionItem> & { roomId: string }): SessionItem =>
  ({
    unreadCount: 0,
    activeTime: 0,
    ...overrides
  }) as SessionItem

describe('useSessionUnreadStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('set', () => {
    it('persists count under the user namespace', () => {
      const store = useSessionUnreadStore()
      store.set('uid-1', 'room-a', 3)
      expect(store.cacheStore['uid-1']?.['room-a']).toBe(3)
    })

    it('sanitizes negative and NaN values to 0', () => {
      const store = useSessionUnreadStore()
      store.set('uid-1', 'room-a', -5)
      store.set('uid-1', 'room-b', NaN)
      expect(store.cacheStore['uid-1']?.['room-a']).toBe(0)
      expect(store.cacheStore['uid-1']?.['room-b']).toBe(0)
    })

    it('floors fractional counts', () => {
      const store = useSessionUnreadStore()
      store.set('uid-1', 'room-a', 4.9)
      expect(store.cacheStore['uid-1']?.['room-a']).toBe(4)
    })

    it('is a no-op when uid is missing', () => {
      const store = useSessionUnreadStore()
      store.set(undefined, 'room-a', 5)
      expect(store.cacheStore).toEqual({})
    })
  })

  describe('setLastRead', () => {
    it('records the activeTime when none was tracked', () => {
      const store = useSessionUnreadStore()
      store.setLastRead('uid-1', 'room-a', 100)
      expect(store.lastReadActiveTimeStore['uid-1']?.['room-a']).toBe(100)
    })

    it('keeps the larger of new vs existing activeTime', () => {
      const store = useSessionUnreadStore()
      store.setLastRead('uid-1', 'room-a', 100)
      store.setLastRead('uid-1', 'room-a', 50)
      expect(store.lastReadActiveTimeStore['uid-1']?.['room-a']).toBe(100)
      store.setLastRead('uid-1', 'room-a', 200)
      expect(store.lastReadActiveTimeStore['uid-1']?.['room-a']).toBe(200)
    })

    it('ignores zero activeTime', () => {
      const store = useSessionUnreadStore()
      store.setLastRead('uid-1', 'room-a', 0)
      expect(store.lastReadActiveTimeStore['uid-1']?.['room-a']).toBeUndefined()
    })
  })

  describe('remove', () => {
    it('removes a single roomId from a user', () => {
      const store = useSessionUnreadStore()
      store.set('uid-1', 'room-a', 3)
      store.set('uid-1', 'room-b', 2)
      store.remove('uid-1', 'room-a')
      expect(store.cacheStore['uid-1']).toEqual({ 'room-b': 2 })
    })

    it('purges the user namespace once empty', () => {
      const store = useSessionUnreadStore()
      store.set('uid-1', 'room-a', 3)
      store.setLastRead('uid-1', 'room-a', 100)
      store.remove('uid-1', 'room-a')
      expect(store.cacheStore['uid-1']).toBeUndefined()
      expect(store.lastReadActiveTimeStore['uid-1']).toBeUndefined()
    })

    it('is a no-op when room not tracked', () => {
      const store = useSessionUnreadStore()
      store.set('uid-1', 'room-a', 3)
      store.remove('uid-1', 'unknown')
      expect(store.cacheStore['uid-1']?.['room-a']).toBe(3)
    })
  })

  describe('apply', () => {
    it('returns empty updates for missing uid or empty sessions', () => {
      const store = useSessionUnreadStore()
      expect(store.apply(undefined, [makeSession({ roomId: 'a' })])).toEqual({})
      expect(store.apply('uid-1', [])).toEqual({})
    })

    it('caches and surfaces server count when no prior state exists', () => {
      const store = useSessionUnreadStore()
      const sessions = [makeSession({ roomId: 'room-a', unreadCount: 5, activeTime: 100 })]
      const updates = store.apply('uid-1', sessions)
      expect(updates).toEqual({})
      expect(store.cacheStore['uid-1']?.['room-a']).toBe(5)
    })

    it('zeroes unread when activeTime <= lastReadTime', () => {
      const store = useSessionUnreadStore()
      store.setLastRead('uid-1', 'room-a', 200)
      const sessions = [makeSession({ roomId: 'room-a', unreadCount: 5, activeTime: 100 })]
      const updates = store.apply('uid-1', sessions)
      expect(updates).toEqual({ 'room-a': 0 })
      expect(store.cacheStore['uid-1']?.['room-a']).toBe(0)
    })

    it('trusts server count when activeTime > lastReadTime', () => {
      const store = useSessionUnreadStore()
      store.set('uid-1', 'room-a', 99)
      store.setLastRead('uid-1', 'room-a', 100)
      const sessions = [makeSession({ roomId: 'room-a', unreadCount: 7, activeTime: 200 })]
      const updates = store.apply('uid-1', sessions)
      expect(updates).toEqual({ 'room-a': 7 })
      expect(store.cacheStore['uid-1']?.['room-a']).toBe(7)
    })

    it('zeroes unread when activeTime is 0 with a recorded lastReadTime', () => {
      const store = useSessionUnreadStore()
      store.setLastRead('uid-1', 'room-a', 100)
      const sessions = [makeSession({ roomId: 'room-a', unreadCount: 3, activeTime: 0 })]
      const updates = store.apply('uid-1', sessions)
      expect(updates).toEqual({ 'room-a': 0 })
    })

    it('uses Math.max(cached, server) when no lastReadTime', () => {
      const store = useSessionUnreadStore()
      store.set('uid-1', 'room-a', 10)
      const sessions = [makeSession({ roomId: 'room-a', unreadCount: 3, activeTime: 500 })]
      const updates = store.apply('uid-1', sessions)
      expect(updates).toEqual({ 'room-a': 10 })
      expect(store.cacheStore['uid-1']?.['room-a']).toBe(10)
    })
  })
})
