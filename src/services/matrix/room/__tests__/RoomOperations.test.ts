import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { RoomOperations } from '../RoomOperations'

const TEST_BASE_URL = 'https://matrix.example.com'

const server = setupMswServer(
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/translate`, () => {
    return HttpResponse.json({ translated_text: '你好' })
  }),
  http.get(`${TEST_BASE_URL}/_matrix/client/v3/rooms/:roomId/invite_blocklist`, () => {
    return HttpResponse.json({ blocked: ['@bad:e'] })
  }),
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/rooms/:roomId/invite_blocklist`, () => {
    return HttpResponse.json({})
  }),
  http.get(`${TEST_BASE_URL}/_matrix/client/v3/rooms/:roomId/sticky_events`, () => {
    return HttpResponse.json({ key: 'value' })
  }),
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/rooms/:roomId/sticky_events`, () => {
    return HttpResponse.json({})
  }),
  http.get('https://translate.googleapis.com/translate_a/single', () => {
    return new HttpResponse(null, { status: 500 })
  })
)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    enqueue: vi.fn()
  }
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => (key === 'matrix_error.common.client_not_initialized' ? '客户端未初始化' : key)
  })
}))

import { offlineQueueService } from '@/services/offline/OfflineQueueService'

const authedRequestImpl = vi.fn()

describe('RoomOperations', () => {
  let ops: InstanceType<typeof RoomOperations>

  beforeEach(() => {
    vi.clearAllMocks()
    authedRequestImpl.mockImplementation(
      async (method: string, path: string, queryParams?: unknown, body?: unknown) => {
        const prefixedPath = path.startsWith('/_matrix') ? path : `/_matrix/client/v3${path}`
        const url = new URL(`${TEST_BASE_URL}${prefixedPath}`)
        if (queryParams && typeof queryParams === 'object') {
          for (const [key, value] of Object.entries(queryParams as Record<string, string>)) {
            url.searchParams.set(key, value)
          }
        }
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-access-token'
        }
        const response = await fetch(url.toString(), {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.json()
      }
    )
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    vi.spyOn(matrixClientService, 'waitForClientReady').mockResolvedValue(undefined as never)
    ops = new RoomOperations()
  })

  // === State methods ===

  describe('setRoomName', () => {
    it('forwards to client.setRoomName', async () => {
      const setRoomName = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ setRoomName } as never)
      await ops.setRoomName('!r', 'New')
      expect(setRoomName).toHaveBeenCalledWith('!r', 'New')
    })

    it('enqueues when offline', async () => {
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      await ops.setRoomName('!r', 'Offline Name')
      expect(offlineQueueService.enqueue).toHaveBeenCalledWith('state', '!r', {
        roomId: '!r',
        type: 'name',
        content: 'Offline Name'
      })
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })
  })

  describe('setRoomTopic', () => {
    it('forwards to client.setRoomTopic', async () => {
      const setRoomTopic = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ setRoomTopic } as never)
      await ops.setRoomTopic('!r', 'hello')
      expect(setRoomTopic).toHaveBeenCalledWith('!r', 'hello')
    })
  })

  describe('setRoomAvatar', () => {
    it('sends m.room.avatar state event with url', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ sendStateEvent } as never)
      await ops.setRoomAvatar('!r', 'mxc://e/abc')
      expect(sendStateEvent).toHaveBeenCalledWith('!r', 'm.room.avatar', { url: 'mxc://e/abc' }, '')
    })
  })

  describe('getRoomState', () => {
    it('throws when room is missing from local cache', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => null } as never)
      await expect(ops.getRoomState('!r')).rejects.toThrow('房间不存在: !r')
    })

    it('returns all state events via currentState', async () => {
      const events = [{ type: 'm.room.name' }, { type: 'm.room.topic' }]
      const room = { currentState: { getStateEvents: vi.fn().mockReturnValue(events) } }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => room } as never)
      expect(await ops.getRoomState('!r')).toBe(events)
    })
  })

  describe('setPushRule', () => {
    it('enabled=true deletes override push rule', async () => {
      const deletePushRule = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ deletePushRule, addPushRule: vi.fn() } as never)
      await ops.setPushRule('!r', true)
      expect(deletePushRule).toHaveBeenCalledWith('global', 'override', '!r')
    })

    it('enabled=false installs an empty-actions override rule', async () => {
      const addPushRule = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ deletePushRule: vi.fn(), addPushRule } as never)
      await ops.setPushRule('!r', false)
      expect(addPushRule).toHaveBeenCalledWith('global', 'override', '!r', {
        conditions: [{ kind: 'event_match', key: 'room_id', pattern: '!r' }],
        actions: []
      })
    })
  })

  // === Tags methods ===

  describe('getTags', () => {
    it('forwards to client.getRoomTags', async () => {
      const getRoomTags = vi.fn().mockResolvedValue({ tags: { 'm.favourite': { order: 0.5 } } })
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoomTags } as never)
      expect(await ops.getTags('!r')).toEqual({ 'm.favourite': { order: 0.5 } })
    })

    it('returns {} on M_UNRECOGNIZED and caches unavailability', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoomTags: vi.fn().mockRejectedValue({ errcode: 'M_UNRECOGNIZED' })
      } as never)
      expect(await ops.getTags('!r')).toEqual({})
      expect(await ops.getTags('!r')).toEqual({})
    })

    it('returns {} on any error (rate-limit resilience)', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoomTags: vi.fn().mockRejectedValue(new Error('429'))
      } as never)
      expect(await ops.getTags('!r')).toEqual({})
    })
  })

  describe('setTag', () => {
    it('delegates to client.setRoomTag', async () => {
      const setRoomTag = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ setRoomTag, getUserId: () => '@me:e' } as never)
      await ops.setTag('!r', 'm.favourite', 0.5)
      expect(setRoomTag).toHaveBeenCalledWith('!r', 'm.favourite', { order: 0.5 })
    })

    it('enqueues with full payload when offline', async () => {
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      await ops.setTag('!r', 'm.favourite', 0.5)
      expect(offlineQueueService.enqueue).toHaveBeenCalledWith('tag', '!r', {
        roomId: '!r',
        tag: 'm.favourite',
        order: 0.5,
        action: 'set'
      })
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })
  })

  describe('removeTag', () => {
    it('delegates to client.deleteRoomTag', async () => {
      const deleteRoomTag = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ deleteRoomTag, getUserId: () => '@me:e' } as never)
      await ops.removeTag('!r', 'm.favourite')
      expect(deleteRoomTag).toHaveBeenCalledWith('!r', 'm.favourite')
    })

    it('enqueues with full payload when offline', async () => {
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      await ops.removeTag('!r', 'm.favourite')
      expect(offlineQueueService.enqueue).toHaveBeenCalledWith('tag', '!r', {
        roomId: '!r',
        tag: 'm.favourite',
        action: 'remove'
      })
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })
  })

  // === Aliases methods ===

  describe('setAlias', () => {
    it('forwards to client.createAlias', async () => {
      const createAlias = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ createAlias } as never)
      await ops.setAlias('!r', '#alias:e')
      expect(createAlias).toHaveBeenCalledWith('#alias:e', '!r')
    })
  })

  describe('deleteAlias', () => {
    it('forwards to client.deleteAlias', async () => {
      const deleteAlias = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ deleteAlias } as never)
      await ops.deleteAlias('#alias:e')
      expect(deleteAlias).toHaveBeenCalledWith('#alias:e')
    })
  })

  describe('getAliases', () => {
    it('returns empty array when room not found', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => null } as never)
      expect(await ops.getAliases('!r')).toEqual([])
    })

    it('returns alt aliases with canonical alias first', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: () => ({
          getAltAliases: () => ['#alt1:e', '#alt2:e'],
          getCanonicalAlias: () => '#canon:e'
        })
      } as never)
      expect(await ops.getAliases('!r')).toEqual(['#canon:e', '#alt1:e', '#alt2:e'])
    })
  })

  // === Lifecycle methods ===

  describe('getServerDomain', () => {
    it('returns client.getDomain() when available', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getDomain: () => 'example.org' } as never)
      expect(await ops.getServerDomain()).toBe('example.org')
    })

    it('falls back to baseUrl hostname', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getDomain: () => '',
        baseUrl: 'https://matrix.example.com'
      } as never)
      expect(await ops.getServerDomain()).toBe('matrix.example.com')
    })

    it('falls back to matrix.org when everything is unusable', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getDomain: () => '' } as never)
      expect(await ops.getServerDomain()).toBe('matrix.org')
    })
  })

  describe('upgradeRoom', () => {
    it('forwards to client.upgradeRoom and returns replacement_room string', async () => {
      const upgradeRoom = vi.fn().mockResolvedValue({ replacement_room: '!new:e' })
      vi.mocked(matrixClientService.getClient).mockReturnValue({ upgradeRoom } as never)
      expect(await ops.upgradeRoom('!old:e', '11')).toBe('!new:e')
      expect(upgradeRoom).toHaveBeenCalledWith('!old:e', '11')
    })
  })

  describe('incrementUnread', () => {
    it('resolves silently when room exists', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => ({ roomId: '!r' }) } as never)
      await expect(ops.incrementUnread('!r')).resolves.toBeUndefined()
    })

    it('swallows errors when room is missing', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => null } as never)
      await expect(ops.incrementUnread('!r')).resolves.toBeUndefined()
    })
  })

  describe('clearUnread', () => {
    it('resolves silently when room exists', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => ({ roomId: '!r' }) } as never)
      await expect(ops.clearUnread('!r')).resolves.toBeUndefined()
    })
  })

  // === Translate methods ===

  describe('translateText', () => {
    it('calls backend translate and returns translated text', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: { authedRequest: authedRequestImpl } } as never)
      expect(await ops.translateText('Hello', 'zh-CN')).toBe('你好')
    })

    it('falls back to Google Translate on backend failure', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/_matrix/client/v3/translate`, () => {
          return new HttpResponse(null, { status: 502 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: { authedRequest: authedRequestImpl } } as never)
      const result = await ops.translateText('Hello', 'de', false)
      expect(result).toBe('Hello')
    })

    it('throws when all paths fail and throwOnError is true', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/_matrix/client/v3/translate`, () => {
          return new HttpResponse(null, { status: 502 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: { authedRequest: authedRequestImpl } } as never)
      await expect(ops.translateText('Hello', 'de', true)).rejects.toThrow()
    })

    it('defaults target language to zh-CN', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: { authedRequest: authedRequestImpl } } as never)
      expect(await ops.translateText('Hello')).toBe('你好')
    })
  })

  // === Pins methods ===

  describe('getPinnedEvents', () => {
    it('returns pinned event IDs from room state', async () => {
      const getStateEvents = vi.fn().mockReturnValue({
        getContent: () => ({ pinned: ['$e1', '$e2'] })
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: () => ({ currentState: { getStateEvents } })
      } as never)
      expect(await ops.getPinnedEvents('!r')).toEqual(['$e1', '$e2'])
    })

    it('returns empty array when room not found', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => null } as never)
      expect(await ops.getPinnedEvents('!r')).toEqual([])
    })
  })

  describe('setPinnedEvents', () => {
    it('sends m.room.pinned_events state event', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ sendStateEvent } as never)
      await ops.setPinnedEvents('!r', ['$e1'])
      expect(sendStateEvent).toHaveBeenCalledWith('!r', 'm.room.pinned_events', { pinned: ['$e1'] }, '')
    })

    it('enqueues with pin type and subtype when offline', async () => {
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      await ops.setPinnedEvents('!r', ['$e1'])
      expect(offlineQueueService.enqueue).toHaveBeenCalledWith('pin', '!r', {
        roomId: '!r',
        type: 'pinned',
        eventIds: ['$e1']
      })
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })
  })

  describe('pinEvent', () => {
    it('appends eventId to pinned list', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      const getStateEvents = vi.fn().mockReturnValue({
        getContent: () => ({ pinned: ['$e1'] })
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: () => ({ currentState: { getStateEvents } }),
        sendStateEvent
      } as never)
      await ops.pinEvent('!r', '$e2')
      expect(sendStateEvent).toHaveBeenCalledWith('!r', 'm.room.pinned_events', { pinned: ['$e1', '$e2'] }, '')
    })

    it('does not duplicate existing eventId', async () => {
      const sendStateEvent = vi.fn()
      const getStateEvents = vi.fn().mockReturnValue({
        getContent: () => ({ pinned: ['$e1'] })
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: () => ({ currentState: { getStateEvents } }),
        sendStateEvent
      } as never)
      await ops.pinEvent('!r', '$e1')
      expect(sendStateEvent).not.toHaveBeenCalled()
    })

    it('enqueues when offline', async () => {
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      await ops.pinEvent('!r', '$e1')
      expect(offlineQueueService.enqueue).toHaveBeenCalledWith('pin', '!r', {
        roomId: '!r',
        type: 'pin',
        eventId: '$e1'
      })
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })
  })

  describe('unpinEvent', () => {
    it('removes eventId from pinned list', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      const getStateEvents = vi.fn().mockReturnValue({
        getContent: () => ({ pinned: ['$e1', '$e2'] })
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: () => ({ currentState: { getStateEvents } }),
        sendStateEvent
      } as never)
      await ops.unpinEvent('!r', '$e1')
      expect(sendStateEvent).toHaveBeenCalledWith('!r', 'm.room.pinned_events', { pinned: ['$e2'] }, '')
    })

    it('enqueues when offline', async () => {
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      await ops.unpinEvent('!r', '$e1')
      expect(offlineQueueService.enqueue).toHaveBeenCalledWith('pin', '!r', {
        roomId: '!r',
        type: 'unpin',
        eventId: '$e1'
      })
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })
  })

  // === Moderation methods ===

  describe('getInviteBlocklist', () => {
    it('GETs invite blocklist via client.http', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: { authedRequest: authedRequestImpl } } as never)
      expect(await ops.getInviteBlocklist('!r')).toEqual(['@bad:e'])
    })

    it('returns empty array on error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_matrix/client/v3/rooms/:roomId/invite_blocklist`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: { authedRequest: authedRequestImpl } } as never)
      expect(await ops.getInviteBlocklist('!r')).toEqual([])
    })
  })

  describe('setInviteBlocklist', () => {
    it('POSTs blocklist via client.http', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: { authedRequest: authedRequestImpl } } as never)
      await ops.setInviteBlocklist('!r', ['@bad:e'])
      expect(authedRequestImpl).toHaveBeenCalledWith('POST', '/rooms/!r/invite_blocklist', undefined, {
        blocked: ['@bad:e']
      })
    })
  })

  describe('getStickyEvents', () => {
    it('GETs sticky events via client.http', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: { authedRequest: authedRequestImpl } } as never)
      expect(await ops.getStickyEvents('!r')).toEqual({ key: 'value' })
    })

    it('returns empty object on error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_matrix/client/v3/rooms/:roomId/sticky_events`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: { authedRequest: authedRequestImpl } } as never)
      expect(await ops.getStickyEvents('!r')).toEqual({})
    })
  })

  describe('setStickyEvents', () => {
    it('POSTs sticky events via client.http', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: { authedRequest: authedRequestImpl } } as never)
      await ops.setStickyEvents('!r', { key: 'value' })
      expect(authedRequestImpl).toHaveBeenCalledWith('POST', '/rooms/!r/sticky_events', undefined, {
        key: 'value'
      })
    })

    it('enqueues with pin type and sticky subtype when offline', async () => {
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      await ops.setStickyEvents('!r', { key: 'value' })
      expect(offlineQueueService.enqueue).toHaveBeenCalledWith('pin', '!r', {
        roomId: '!r',
        type: 'sticky',
        events: { key: 'value' }
      })
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })
  })

  // === MemberProfile methods ===

  describe('setMemberDisplayName', () => {
    it('merges displayName into existing member content', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      const getStateEvents = vi.fn().mockReturnValue({
        getContent: () => ({ membership: 'join', displayname: 'Old' })
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: () => ({ currentState: { getStateEvents } }),
        getUserId: () => '@me:e',
        sendStateEvent
      } as never)
      await ops.setMemberDisplayName('!r', 'New')
      expect(sendStateEvent).toHaveBeenCalledWith(
        '!r',
        'm.room.member',
        {
          membership: 'join',
          displayname: 'New',
          third_party_invite: undefined
        },
        '@me:e'
      )
    })
  })

  describe('getMemberDisplayName', () => {
    it('returns rawDisplayName from room member', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: () => ({
          getMember: (_uid: string) => ({ rawDisplayName: 'Alice', name: 'alice' })
        })
      } as never)
      expect(await ops.getMemberDisplayName('!r', '@alice:e')).toBe('Alice')
    })

    it('returns null when room is missing', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => null } as never)
      expect(await ops.getMemberDisplayName('!r', '@alice:e')).toBeNull()
    })
  })

  describe('setMemberPowerLevel', () => {
    it('forwards to client.setUserPowerLevel', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ setUserPowerLevel } as never)
      await ops.setMemberPowerLevel('!r', '@u:e', 50)
      expect(setUserPowerLevel).toHaveBeenCalledWith('@u:e', '!r', 50)
    })
  })

  describe('setMemberAsAdmin', () => {
    it('sets power level to 100', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ setUserPowerLevel } as never)
      await ops.setMemberAsAdmin('!r', '@u:e')
      expect(setUserPowerLevel).toHaveBeenCalledWith('@u:e', '!r', 100)
    })
  })

  describe('removeMemberAsAdmin', () => {
    it('sets power level to 0', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ setUserPowerLevel } as never)
      await ops.removeMemberAsAdmin('!r', '@u:e')
      expect(setUserPowerLevel).toHaveBeenCalledWith('@u:e', '!r', 0)
    })
  })
})
