import { createPinia, setActivePinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, nextTick } from 'vue'
import { useSettingStore } from '@/stores/domains/settings/setting'
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
      expect(store.cacheStore['uid-1']?.['room-a']?.count).toBe(3)
    })

    it('stamps the ledger entry with the write time', () => {
      const store = useSessionUnreadStore()
      const before = Date.now()
      store.set('uid-1', 'room-a', 3)
      expect(store.cacheStore['uid-1']?.['room-a']?.updatedAt).toBeGreaterThanOrEqual(before)
    })

    it('sanitizes negative and NaN values to 0', () => {
      const store = useSessionUnreadStore()
      store.set('uid-1', 'room-a', -5)
      store.set('uid-1', 'room-b', NaN)
      expect(store.cacheStore['uid-1']?.['room-a']?.count).toBe(0)
      expect(store.cacheStore['uid-1']?.['room-b']?.count).toBe(0)
    })

    it('floors fractional counts', () => {
      const store = useSessionUnreadStore()
      store.set('uid-1', 'room-a', 4.9)
      expect(store.cacheStore['uid-1']?.['room-a']?.count).toBe(4)
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
      expect(store.cacheStore['uid-1']?.['room-a']).toBeUndefined()
      expect(store.cacheStore['uid-1']?.['room-b']?.count).toBe(2)
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
      expect(store.cacheStore['uid-1']?.['room-a']?.count).toBe(3)
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
      expect(store.cacheStore['uid-1']?.['room-a']?.count).toBe(5)
    })

    it('zeroes unread when activeTime <= lastReadTime', () => {
      const store = useSessionUnreadStore()
      store.setLastRead('uid-1', 'room-a', 200)
      const sessions = [makeSession({ roomId: 'room-a', unreadCount: 5, activeTime: 100 })]
      const updates = store.apply('uid-1', sessions)
      expect(updates).toEqual({ 'room-a': 0 })
      expect(store.cacheStore['uid-1']?.['room-a']?.count).toBe(0)
    })

    it('trusts server count when activeTime > lastReadTime', () => {
      const store = useSessionUnreadStore()
      store.set('uid-1', 'room-a', 99)
      store.setLastRead('uid-1', 'room-a', 100)
      const sessions = [makeSession({ roomId: 'room-a', unreadCount: 7, activeTime: 200 })]
      const updates = store.apply('uid-1', sessions)
      expect(updates).toEqual({ 'room-a': 7 })
      expect(store.cacheStore['uid-1']?.['room-a']?.count).toBe(7)
    })

    it('zeroes unread when activeTime is 0 with a recorded lastReadTime', () => {
      const store = useSessionUnreadStore()
      store.setLastRead('uid-1', 'room-a', 100)
      const sessions = [makeSession({ roomId: 'room-a', unreadCount: 3, activeTime: 0 })]
      const updates = store.apply('uid-1', sessions)
      expect(updates).toEqual({ 'room-a': 0 })
    })

    it('takes the larger server count when no lastReadTime and the server reports more', () => {
      const store = useSessionUnreadStore()
      store.set('uid-1', 'room-a', 10)
      const sessions = [makeSession({ roomId: 'room-a', unreadCount: 20, activeTime: 500 })]
      const updates = store.apply('uid-1', sessions)
      expect(updates).toEqual({})
      expect(store.cacheStore['uid-1']?.['room-a']?.count).toBe(20)
    })

    it('adopts the smaller server count when no lastReadTime and no newer message (another device read it)', () => {
      const store = useSessionUnreadStore()
      store.set('uid-1', 'room-a', 10)
      // activeTime 早于账本写入时间：账本记完账之后没有新消息
      const sessions = [makeSession({ roomId: 'room-a', unreadCount: 3, activeTime: Date.now() - 60_000 })]
      const updates = store.apply('uid-1', sessions)
      expect(updates).toEqual({})
      expect(store.cacheStore['uid-1']?.['room-a']?.count).toBe(3)
    })

    it('keeps the ledger count when no lastReadTime and the server reports fewer but a newer message exists', () => {
      const store = useSessionUnreadStore()
      store.set('uid-1', 'room-a', 10)
      // activeTime 晚于账本写入时间：账本记完之后又来了一条还没记账的消息
      const sessions = [makeSession({ roomId: 'room-a', unreadCount: 3, activeTime: Date.now() + 60_000 })]
      const updates = store.apply('uid-1', sessions)
      expect(updates).toEqual({ 'room-a': 10 })
      expect(store.cacheStore['uid-1']?.['room-a']?.count).toBe(10)
    })

    it('folds messages that arrived while the app was closed into case 2 with the settled watermark', () => {
      useSettingStore().setSendReadReceiptsEnabled(false)
      const store = useSessionUnreadStore()
      store.setLastRead('uid-1', 'room-a', 100)
      // 本机读完 3 条：关闭已读回执时服务端累计的 3 条都已被本机结算
      store.markRead('uid-1', 'room-a', 3)
      // 关闭期间来 1 条：服务端累计 4、activeTime 200
      const updates = store.apply('uid-1', [makeSession({ roomId: 'room-a', unreadCount: 4, activeTime: 200 })])
      expect(updates).toEqual({ 'room-a': 1 })
      expect(store.cacheStore['uid-1']?.['room-a']?.count).toBe(1)
    })
  })

  describe('apply + persist（冷启动水合）', () => {
    // 与 src/stores/index.ts 一致：全新 pinia + 持久化插件，只让 state 来自 localStorage。
    const bootPersistedPinia = () => {
      const pinia = createPinia()
      pinia.use(createPersistedState({ auto: false }))
      createApp({}).use(pinia)
      setActivePinia(pinia)
    }

    it('keeps trusting the hydrated ledger for case 2 (cacheStore is persisted)', async () => {
      localStorage.clear()

      bootPersistedPinia()
      useSettingStore().setSendReadReceiptsEnabled(false)
      useSessionUnreadStore().setLastRead('uid-1', 'room-a', 100)
      useSessionUnreadStore().set('uid-1', 'room-a', 1)
      await nextTick()
      expect(localStorage.getItem('sessionUnread')).not.toBeNull()

      // 冷启动：账本只能来自 localStorage 水合
      bootPersistedPinia()
      useSettingStore().setSendReadReceiptsEnabled(false)
      const store = useSessionUnreadStore()
      expect(store.cacheStore['uid-1']?.['room-a']?.count).toBe(1)

      // 服务端因为没有 m.read 仍报累计 4，账本（1）必须优先
      const updates = store.apply('uid-1', [makeSession({ roomId: 'room-a', unreadCount: 4, activeTime: 200 })])
      expect(updates).toEqual({ 'room-a': 1 })
      expect(store.cacheStore['uid-1']?.['room-a']?.count).toBe(1)
    })
  })
})
