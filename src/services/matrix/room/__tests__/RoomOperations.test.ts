import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getClientMock = vi.fn()
const waitForClientReadyMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: () => getClientMock(),
    waitForClientReady: waitForClientReadyMock
  },
  matrixClientService: {
    getClient: () => getClientMock(),
    waitForClientReady: waitForClientReadyMock
  }
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

const { RoomOperations } = await import('../RoomOperations')

describe('RoomOperations', () => {
  let ops: InstanceType<typeof RoomOperations>

  beforeEach(() => {
    ops = new RoomOperations()
    getClientMock.mockReset()
    vi.clearAllMocks()
  })

  // === State methods ===

  describe('setRoomName', () => {
    it('forwards to client.setRoomName', async () => {
      const setRoomName = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValue({ setRoomName })
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
      getClientMock.mockReturnValue({ setRoomTopic })
      await ops.setRoomTopic('!r', 'hello')
      expect(setRoomTopic).toHaveBeenCalledWith('!r', 'hello')
    })
  })

  describe('setRoomAvatar', () => {
    it('sends m.room.avatar state event with url', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValue({ sendStateEvent })
      await ops.setRoomAvatar('!r', 'mxc://e/abc')
      expect(sendStateEvent).toHaveBeenCalledWith('!r', 'm.room.avatar', { url: 'mxc://e/abc' }, '')
    })
  })

  describe('getRoomState', () => {
    it('throws when room is missing from local cache', async () => {
      getClientMock.mockReturnValue({ getRoom: () => null })
      await expect(ops.getRoomState('!r')).rejects.toThrow('房间不存在: !r')
    })

    it('returns all state events via currentState', async () => {
      const events = [{ type: 'm.room.name' }, { type: 'm.room.topic' }]
      const room = { currentState: { getStateEvents: vi.fn().mockReturnValue(events) } }
      getClientMock.mockReturnValue({ getRoom: () => room })
      expect(await ops.getRoomState('!r')).toBe(events)
    })
  })

  describe('setPushRule', () => {
    it('enabled=true deletes override push rule', async () => {
      const deletePushRule = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValue({ deletePushRule, addPushRule: vi.fn() })
      await ops.setPushRule('!r', true)
      expect(deletePushRule).toHaveBeenCalledWith('global', 'override', '!r')
    })

    it('enabled=false installs an empty-actions override rule', async () => {
      const addPushRule = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValue({ deletePushRule: vi.fn(), addPushRule })
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
      getClientMock.mockReturnValue({ getRoomTags })
      expect(await ops.getTags('!r')).toEqual({ 'm.favourite': { order: 0.5 } })
    })

    it('returns {} on M_UNRECOGNIZED and caches unavailability', async () => {
      getClientMock.mockReturnValue({
        getRoomTags: vi.fn().mockRejectedValue({ errcode: 'M_UNRECOGNIZED' })
      })
      expect(await ops.getTags('!r')).toEqual({})
      expect(await ops.getTags('!r')).toEqual({})
    })

    it('returns {} on any error (rate-limit resilience)', async () => {
      getClientMock.mockReturnValue({
        getRoomTags: vi.fn().mockRejectedValue(new Error('429'))
      })
      expect(await ops.getTags('!r')).toEqual({})
    })
  })

  describe('setTag', () => {
    it('delegates to client.setRoomTag', async () => {
      const setRoomTag = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValue({ setRoomTag, getUserId: () => '@me:e' })
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
      getClientMock.mockReturnValue({ deleteRoomTag, getUserId: () => '@me:e' })
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
      getClientMock.mockReturnValue({ createAlias })
      await ops.setAlias('!r', '#alias:e')
      expect(createAlias).toHaveBeenCalledWith('#alias:e', '!r')
    })
  })

  describe('deleteAlias', () => {
    it('forwards to client.deleteAlias', async () => {
      const deleteAlias = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValue({ deleteAlias })
      await ops.deleteAlias('#alias:e')
      expect(deleteAlias).toHaveBeenCalledWith('#alias:e')
    })
  })

  describe('getAliases', () => {
    it('returns empty array when room not found', async () => {
      getClientMock.mockReturnValue({ getRoom: () => null })
      expect(await ops.getAliases('!r')).toEqual([])
    })

    it('returns alt aliases with canonical alias first', async () => {
      getClientMock.mockReturnValue({
        getRoom: () => ({
          getAltAliases: () => ['#alt1:e', '#alt2:e'],
          getCanonicalAlias: () => '#canon:e'
        })
      })
      expect(await ops.getAliases('!r')).toEqual(['#canon:e', '#alt1:e', '#alt2:e'])
    })
  })

  // === Lifecycle methods ===

  describe('getServerDomain', () => {
    it('returns client.getDomain() when available', async () => {
      getClientMock.mockReturnValue({ getDomain: () => 'example.org' })
      expect(await ops.getServerDomain()).toBe('example.org')
    })

    it('falls back to baseUrl hostname', async () => {
      getClientMock.mockReturnValue({
        getDomain: () => '',
        baseUrl: 'https://matrix.example.com'
      })
      expect(await ops.getServerDomain()).toBe('matrix.example.com')
    })

    it('falls back to matrix.org when everything is unusable', async () => {
      getClientMock.mockReturnValue({ getDomain: () => '' })
      expect(await ops.getServerDomain()).toBe('matrix.org')
    })
  })

  describe('upgradeRoom', () => {
    it('forwards to client.upgradeRoom and returns replacement_room string', async () => {
      const upgradeRoom = vi.fn().mockResolvedValue({ replacement_room: '!new:e' })
      getClientMock.mockReturnValue({ upgradeRoom })
      expect(await ops.upgradeRoom('!old:e', '11')).toBe('!new:e')
      expect(upgradeRoom).toHaveBeenCalledWith('!old:e', '11')
    })
  })

  describe('incrementUnread', () => {
    it('resolves silently when room exists', async () => {
      getClientMock.mockReturnValue({ getRoom: () => ({ roomId: '!r' }) })
      await expect(ops.incrementUnread('!r')).resolves.toBeUndefined()
    })

    it('swallows errors when room is missing', async () => {
      getClientMock.mockReturnValue({ getRoom: () => null })
      await expect(ops.incrementUnread('!r')).resolves.toBeUndefined()
    })
  })

  describe('clearUnread', () => {
    it('resolves silently when room exists', async () => {
      getClientMock.mockReturnValue({ getRoom: () => ({ roomId: '!r' }) })
      await expect(ops.clearUnread('!r')).resolves.toBeUndefined()
    })
  })

  // === Translate methods ===

  describe('translateText', () => {
    it('calls backend translate and returns translated text', async () => {
      const authedRequest = vi.fn().mockResolvedValue({ translated_text: '你好' })
      getClientMock.mockReturnValue({ http: { authedRequest } })
      expect(await ops.translateText('Hello', 'zh-CN')).toBe('你好')
    })

    it('falls back to Google Translate on backend failure', async () => {
      const authedRequest = vi.fn().mockRejectedValue(new Error('502'))
      getClientMock.mockReturnValue({ http: { authedRequest } })
      const result = await ops.translateText('Hello', 'de', false)
      expect(result).toBe('Hello')
    })

    it('throws when all paths fail and throwOnError is true', async () => {
      const authedRequest = vi.fn().mockRejectedValue(new Error('502'))
      getClientMock.mockReturnValue({ http: { authedRequest } })
      await expect(ops.translateText('Hello', 'de', true)).rejects.toThrow()
    })

    it('defaults target language to zh-CN', async () => {
      const authedRequest = vi.fn().mockResolvedValue({ translated_text: '你好' })
      getClientMock.mockReturnValue({ http: { authedRequest } })
      expect(await ops.translateText('Hello')).toBe('你好')
    })
  })

  // === Pins methods ===

  describe('getPinnedEvents', () => {
    it('returns pinned event IDs from room state', async () => {
      const getStateEvents = vi.fn().mockReturnValue({
        getContent: () => ({ pinned: ['$e1', '$e2'] })
      })
      getClientMock.mockReturnValue({
        getRoom: () => ({ currentState: { getStateEvents } })
      })
      expect(await ops.getPinnedEvents('!r')).toEqual(['$e1', '$e2'])
    })

    it('returns empty array when room not found', async () => {
      getClientMock.mockReturnValue({ getRoom: () => null })
      expect(await ops.getPinnedEvents('!r')).toEqual([])
    })
  })

  describe('setPinnedEvents', () => {
    it('sends m.room.pinned_events state event', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValue({ sendStateEvent })
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
      getClientMock.mockReturnValue({
        getRoom: () => ({ currentState: { getStateEvents } }),
        sendStateEvent
      })
      await ops.pinEvent('!r', '$e2')
      expect(sendStateEvent).toHaveBeenCalledWith('!r', 'm.room.pinned_events', { pinned: ['$e1', '$e2'] }, '')
    })

    it('does not duplicate existing eventId', async () => {
      const sendStateEvent = vi.fn()
      const getStateEvents = vi.fn().mockReturnValue({
        getContent: () => ({ pinned: ['$e1'] })
      })
      getClientMock.mockReturnValue({
        getRoom: () => ({ currentState: { getStateEvents } }),
        sendStateEvent
      })
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
      getClientMock.mockReturnValue({
        getRoom: () => ({ currentState: { getStateEvents } }),
        sendStateEvent
      })
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
      const authedRequest = vi.fn().mockResolvedValue({ blocked: ['@bad:e'] })
      getClientMock.mockReturnValue({ http: { authedRequest } })
      expect(await ops.getInviteBlocklist('!r')).toEqual(['@bad:e'])
    })

    it('returns empty array on error', async () => {
      const authedRequest = vi.fn().mockRejectedValue(new Error('500'))
      getClientMock.mockReturnValue({ http: { authedRequest } })
      expect(await ops.getInviteBlocklist('!r')).toEqual([])
    })
  })

  describe('setInviteBlocklist', () => {
    it('POSTs blocklist via client.http', async () => {
      const authedRequest = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValue({ http: { authedRequest } })
      await ops.setInviteBlocklist('!r', ['@bad:e'])
      expect(authedRequest).toHaveBeenCalledWith('POST', '/_matrix/client/v3/rooms/!r/invite_blocklist', undefined, {
        blocked: ['@bad:e']
      })
    })
  })

  describe('getStickyEvents', () => {
    it('GETs sticky events via client.http', async () => {
      const authedRequest = vi.fn().mockResolvedValue({ key: 'value' })
      getClientMock.mockReturnValue({ http: { authedRequest } })
      expect(await ops.getStickyEvents('!r')).toEqual({ key: 'value' })
    })

    it('returns empty object on error', async () => {
      const authedRequest = vi.fn().mockRejectedValue(new Error('500'))
      getClientMock.mockReturnValue({ http: { authedRequest } })
      expect(await ops.getStickyEvents('!r')).toEqual({})
    })
  })

  describe('setStickyEvents', () => {
    it('POSTs sticky events via client.http', async () => {
      const authedRequest = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValue({ http: { authedRequest } })
      await ops.setStickyEvents('!r', { key: 'value' })
      expect(authedRequest).toHaveBeenCalledWith('POST', '/_matrix/client/v3/rooms/!r/sticky_events', undefined, {
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
      getClientMock.mockReturnValue({
        getRoom: () => ({ currentState: { getStateEvents } }),
        getUserId: () => '@me:e',
        sendStateEvent
      })
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
      getClientMock.mockReturnValue({
        getRoom: () => ({
          getMember: (_uid: string) => ({ rawDisplayName: 'Alice', name: 'alice' })
        })
      })
      expect(await ops.getMemberDisplayName('!r', '@alice:e')).toBe('Alice')
    })

    it('returns null when room is missing', async () => {
      getClientMock.mockReturnValue({ getRoom: () => null })
      expect(await ops.getMemberDisplayName('!r', '@alice:e')).toBeNull()
    })
  })

  describe('setMemberPowerLevel', () => {
    it('forwards to client.setUserPowerLevel', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValue({ setUserPowerLevel })
      await ops.setMemberPowerLevel('!r', '@u:e', 50)
      expect(setUserPowerLevel).toHaveBeenCalledWith('@u:e', '!r', 50)
    })
  })

  describe('setMemberAsAdmin', () => {
    it('sets power level to 100', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValue({ setUserPowerLevel })
      await ops.setMemberAsAdmin('!r', '@u:e')
      expect(setUserPowerLevel).toHaveBeenCalledWith('@u:e', '!r', 100)
    })
  })

  describe('removeMemberAsAdmin', () => {
    it('sets power level to 0', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValue({ setUserPowerLevel })
      await ops.removeMemberAsAdmin('!r', '@u:e')
      expect(setUserPowerLevel).toHaveBeenCalledWith('@u:e', '!r', 0)
    })
  })
})
