import { describe, expect, it } from 'vitest'
import { OnlineEnum } from '@/enums'
import {
  buildPresenceStorePatch,
  collectTrackedPresenceUserIds,
  mapPresenceToOnlineStatus,
  resolveDisplayActiveStatus,
  resolvePresenceLastOptTime
} from '../presenceStatus'

describe('presenceStatus', () => {
  describe('resolveDisplayActiveStatus', () => {
    it('returns activeStatus when defined', () => {
      expect(resolveDisplayActiveStatus(OnlineEnum.ONLINE)).toBe(OnlineEnum.ONLINE)
    })

    it('falls back to fallbackStatus when activeStatus is undefined', () => {
      expect(resolveDisplayActiveStatus(undefined, OnlineEnum.ONLINE)).toBe(OnlineEnum.ONLINE)
    })

    it('defaults to OFFLINE when both are undefined', () => {
      expect(resolveDisplayActiveStatus()).toBe(OnlineEnum.OFFLINE)
    })
  })

  describe('mapPresenceToOnlineStatus', () => {
    it('maps online presence to ONLINE', () => {
      expect(mapPresenceToOnlineStatus('online')).toBe(OnlineEnum.ONLINE)
    })

    it('maps unavailable / offline / null / undefined to OFFLINE', () => {
      expect(mapPresenceToOnlineStatus('unavailable')).toBe(OnlineEnum.OFFLINE)
      expect(mapPresenceToOnlineStatus('offline')).toBe(OnlineEnum.OFFLINE)
      expect(mapPresenceToOnlineStatus(null)).toBe(OnlineEnum.OFFLINE)
      expect(mapPresenceToOnlineStatus(undefined)).toBe(OnlineEnum.OFFLINE)
    })
  })

  describe('resolvePresenceLastOptTime', () => {
    it('returns now when last_active_ago is missing', () => {
      const now = 1_000_000
      expect(resolvePresenceLastOptTime({ last_active_ago: undefined }, now)).toBe(now)
    })

    it('returns now when last_active_ago is NaN', () => {
      const now = 1_000_000
      expect(resolvePresenceLastOptTime({ last_active_ago: NaN }, now)).toBe(now)
    })

    it('subtracts last_active_ago from now', () => {
      expect(resolvePresenceLastOptTime({ last_active_ago: 5000 }, 10_000)).toBe(5000)
    })

    it('clamps negative last_active_ago to 0 offset', () => {
      expect(resolvePresenceLastOptTime({ last_active_ago: -100 }, 10_000)).toBe(10_000)
    })

    it('clamps result to non-negative', () => {
      expect(resolvePresenceLastOptTime({ last_active_ago: 20_000 }, 10_000)).toBe(0)
    })
  })

  describe('buildPresenceStorePatch', () => {
    it('builds patch from online presence', () => {
      const patch = buildPresenceStorePatch(
        { user_id: '@a:x', presence: 'online', last_active_ago: 1000, status_msg: 'hello' },
        5000
      )
      expect(patch).toEqual({
        activeStatus: OnlineEnum.ONLINE,
        lastOptTime: 4000,
        presence: 'online',
        statusMessage: 'hello'
      })
    })

    it('omits status_msg when null', () => {
      const patch = buildPresenceStorePatch(
        {
          user_id: '@a:x',
          presence: 'offline',
          last_active_ago: 0,
          status_msg: null as unknown as undefined
        },
        1000
      )
      expect(patch.statusMessage).toBeUndefined()
      expect(patch.activeStatus).toBe(OnlineEnum.OFFLINE)
    })
  })

  describe('collectTrackedPresenceUserIds', () => {
    it('returns empty array when no inputs', () => {
      expect(collectTrackedPresenceUserIds({})).toEqual([])
    })

    it('includes current user id', () => {
      expect(collectTrackedPresenceUserIds({ currentUserId: '@alice:example.com' })).toEqual(['@alice:example.com'])
    })

    it('skips blank current user id', () => {
      expect(collectTrackedPresenceUserIds({ currentUserId: '   ' })).toEqual([])
    })

    it('merges contacts and members, prefers userId over uid', () => {
      const result = collectTrackedPresenceUserIds({
        contacts: [{ userId: '@bob:example.com' }, { uid: '@carol:example.com' }],
        members: [{ userId: '@dave:example.com' }]
      })
      expect(result).toEqual(['@bob:example.com', '@carol:example.com', '@dave:example.com'])
    })

    it('deduplicates and sorts results', () => {
      const result = collectTrackedPresenceUserIds({
        currentUserId: '@zoe:example.com',
        contacts: [{ userId: '@alice:example.com' }, { userId: '@alice:example.com' }],
        members: [{ userId: '@bob:example.com' }]
      })
      expect(result).toEqual(['@alice:example.com', '@bob:example.com', '@zoe:example.com'])
    })

    it('skips entries without a userId or uid', () => {
      const result = collectTrackedPresenceUserIds({
        contacts: [{ userId: null }, { uid: null }, { userId: '@alice:example.com' }]
      })
      expect(result).toEqual(['@alice:example.com'])
    })
  })
})
