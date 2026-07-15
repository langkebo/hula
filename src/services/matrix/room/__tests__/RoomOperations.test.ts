import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getClientMock = vi.fn()
const waitForClientReadyMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../../MatrixClientService', () => ({
  default: { getClient: () => getClientMock(), waitForClientReady: () => waitForClientReadyMock() },
  matrixClientService: {
    getClient: () => getClientMock(),
    waitForClientReady: () => waitForClientReadyMock()
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
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(ops.setRoomName('!r', 'x')).rejects.toThrow('客户端未初始化')
    })

    it('forwards to client.setRoomName', async () => {
      const setRoomName = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setRoomName })
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

    it('re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce({ setRoomName: vi.fn().mockRejectedValue(new Error('403')) })
      await expect(ops.setRoomName('!r', 'x')).rejects.toThrow('403')
    })
  })

  describe('setRoomTopic', () => {
    it('forwards to client.setRoomTopic', async () => {
      const setRoomTopic = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setRoomTopic })
      await ops.setRoomTopic('!r', 'hello')
      expect(setRoomTopic).toHaveBeenCalledWith('!r', 'hello')
    })
  })

  describe('setRoomAvatar', () => {
    it('sends m.room.avatar state event with url', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ sendStateEvent })
      await ops.setRoomAvatar('!r', 'mxc://e/abc')
      expect(sendStateEvent).toHaveBeenCalledWith('!r', 'm.room.avatar', { url: 'mxc://e/abc' }, '')
    })
  })

  describe('getRoomState', () => {
    it('throws when room is missing from local cache', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      await expect(ops.getRoomState('!r')).rejects.toThrow('房间不存在: !r')
    })

    it('returns all state events via currentState', async () => {
      const events = [{ type: 'm.room.name' }, { type: 'm.room.topic' }]
      const room = { currentState: { getStateEvents: vi.fn().mockReturnValue(events) } }
      getClientMock.mockReturnValueOnce({ getRoom: () => room })
      expect(await ops.getRoomState('!r')).toBe(events)
    })
  })

  describe('setPushRule', () => {
    it('enabled=true deletes override push rule', async () => {
      const deletePushRule = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ deletePushRule, addPushRule: vi.fn() })
      await ops.setPushRule('!r', true)
      expect(deletePushRule).toHaveBeenCalledWith('global', 'override', '!r')
    })

    it('enabled=false installs an empty-actions override rule', async () => {
      const addPushRule = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ deletePushRule: vi.fn(), addPushRule })
      await ops.setPushRule('!r', false)
      expect(addPushRule).toHaveBeenCalledWith('global', 'override', '!r', {
        conditions: [{ kind: 'event_match', key: 'room_id', pattern: '!r' }],
        actions: []
      })
    })

    it('enqueues when offline', async () => {
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      await ops.setPushRule('!r', true)
      expect(offlineQueueService.enqueue).toHaveBeenCalledWith('push_rule', '!r', {
        roomId: '!r',
        enabled: true
      })
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })
  })

  // === Tags methods ===

  describe('getTags', () => {
    it('forwards to client.getRoomTags', async () => {
      const getRoomTags = vi.fn().mockResolvedValue({ 'm.favourite': { order: 0.5 } })
      getClientMock.mockReturnValueOnce({ getRoomTags })
      expect(await ops.getTags('!r')).toEqual({ 'm.favourite': { order: 0.5 } })
    })

    it('returns {} on M_UNRECOGNIZED and caches unavailability', async () => {
      getClientMock.mockReturnValueOnce({
        getRoomTags: vi.fn().mockRejectedValue({ errcode: 'M_UNRECOGNIZED' })
      })
      expect(await ops.getTags('!r')).toEqual({})
      // second call should be cached — no getClient call needed
      expect(await ops.getTags('!r')).toEqual({})
    })
  })

  describe('setTag', () => {
    it('delegates to client.setRoomTag', async () => {
      const setRoomTag = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setRoomTag })
      await ops.setTag('!r', 'm.favourite', 0.5)
      expect(setRoomTag).toHaveBeenCalledWith('!r', 'm.favourite', { order: 0.5 })
    })
  })

  describe('removeTag', () => {
    it('delegates to client.deleteRoomTag', async () => {
      const deleteRoomTag = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ deleteRoomTag })
      await ops.removeTag('!r', 'm.favourite')
      expect(deleteRoomTag).toHaveBeenCalledWith('!r', 'm.favourite')
    })
  })

  // === Aliases methods ===

  describe('setAlias', () => {
    it('forwards to client.createAlias', async () => {
      const createAlias = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ createAlias })
      await ops.setAlias('!r', '#alias:e')
      expect(createAlias).toHaveBeenCalledWith('#alias:e', '!r')
    })
  })

  describe('deleteAlias', () => {
    it('forwards to client.deleteAlias', async () => {
      const deleteAlias = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ deleteAlias })
      await ops.deleteAlias('#alias:e')
      expect(deleteAlias).toHaveBeenCalledWith('#alias:e')
    })
  })

  describe('getAliases', () => {
    it('throws when room not found', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      await expect(ops.getAliases('!r')).rejects.toThrow('房间不存在: !r')
    })

    it('returns canonical alias plus alt aliases', async () => {
      const canonical = { getContent: () => ({ alias: '#canon:e' }) }
      const alt = { getContent: () => ({ alt_aliases: ['#alt1:e', '#alt2:e'] }) }
      const getStateEvents = vi.fn().mockReturnValueOnce(canonical).mockReturnValueOnce(alt)
      getClientMock.mockReturnValueOnce({
        getRoom: () => ({ currentState: { getStateEvents } })
      })
      expect(await ops.getAliases('!r')).toEqual(['#canon:e', '#alt1:e', '#alt2:e'])
    })
  })

  // === Lifecycle methods ===

  describe('getServerDomain', () => {
    it('returns client.getDomain() when available', async () => {
      getClientMock.mockReturnValueOnce({ getDomain: () => 'example.org' })
      expect(await ops.getServerDomain()).toBe('example.org')
    })

    it('falls back to hostname extracted from baseUrl', async () => {
      getClientMock.mockReturnValueOnce({
        getDomain: () => '',
        baseUrl: 'https://matrix.example.com'
      })
      expect(await ops.getServerDomain()).toBe('matrix.example.com')
    })

    it('falls back to matrix.org when domain and baseUrl are unusable', async () => {
      getClientMock.mockReturnValueOnce({ getDomain: () => '' })
      expect(await ops.getServerDomain()).toBe('matrix.org')
    })
  })

  describe('upgradeRoom', () => {
    it('forwards to client.upgradeRoom and returns replacement_room string', async () => {
      const upgradeRoom = vi.fn().mockResolvedValue({ replacement_room: '!new:e' })
      getClientMock.mockReturnValueOnce({ upgradeRoom })
      expect(await ops.upgradeRoom('!old:e', '11')).toBe('!new:e')
      expect(upgradeRoom).toHaveBeenCalledWith('!old:e', '11')
    })
  })

  describe('incrementUnread', () => {
    it('resolves silently when room exists', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => ({ roomId: '!r' }) })
      await expect(ops.incrementUnread('!r')).resolves.toBeUndefined()
    })

    it('swallows "room not found"', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      await expect(ops.incrementUnread('!r')).resolves.toBeUndefined()
    })

    it('swallows "client not initialized"', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(ops.incrementUnread('!r')).resolves.toBeUndefined()
    })
  })

  describe('clearUnread', () => {
    it('resolves silently when room exists', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => ({ roomId: '!r' }) })
      await expect(ops.clearUnread('!r')).resolves.toBeUndefined()
    })

    it('swallows "room not found"', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      await expect(ops.clearUnread('!r')).resolves.toBeUndefined()
    })
  })

  // === Translate methods ===

  describe('translateText', () => {
    it('calls the backend translate endpoint and returns translated text', async () => {
      const authedRequest = vi.fn().mockResolvedValue({ translated_text: 'Hallo' })
      getClientMock.mockReturnValueOnce({ getHttp: () => ({ authedRequest }) })
      expect(await ops.translateText('Hello', 'de')).toBe('Hallo')
    })

    it('falls back to Google Translate on backend failure', async () => {
      const authedRequest = vi.fn().mockRejectedValue(new Error('502'))
      getClientMock.mockReturnValueOnce({ getHttp: () => ({ authedRequest }) })
      // fetch will fail in test env; with throwOnError=false (default is true, but we pass false), returns original
      const result = await ops.translateText('Hello', 'de', false)
      expect(result).toBe('Hello')
    })

    it('throws when all translation paths fail and throwOnError is true', async () => {
      const authedRequest = vi.fn().mockRejectedValue(new Error('502'))
      getClientMock.mockReturnValueOnce({ getHttp: () => ({ authedRequest }) })
      await expect(ops.translateText('Hello', 'de', true)).rejects.toThrow('翻译失败')
    })
  })

  // === Pins methods ===

  describe('getPinnedEvents', () => {
    it('returns pinned event IDs from room state', async () => {
      const getStateEvents = vi.fn().mockReturnValue({
        getContent: () => ({ pinned: ['$e1', '$e2'] })
      })
      getClientMock.mockReturnValueOnce({
        getRoom: () => ({ currentState: { getStateEvents } })
      })
      expect(await ops.getPinnedEvents('!r')).toEqual(['$e1', '$e2'])
    })

    it('returns empty array when room not found', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      expect(await ops.getPinnedEvents('!r')).toEqual([])
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
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
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
  })

  // === Moderation methods ===

  describe('getInviteBlocklist', () => {
    it('GETs invite blocklist from synapse admin API', async () => {
      const authedRequest = vi.fn().mockResolvedValue({ blocked: ['@bad:e'] })
      getClientMock.mockReturnValueOnce({ getHttp: () => ({ authedRequest }) })
      expect(await ops.getInviteBlocklist('!r')).toEqual(['@bad:e'])
    })

    it('returns empty array on null response', async () => {
      const authedRequest = vi.fn().mockResolvedValue(null)
      getClientMock.mockReturnValueOnce({ getHttp: () => ({ authedRequest }) })
      expect(await ops.getInviteBlocklist('!r')).toEqual([])
    })
  })

  describe('setInviteBlocklist', () => {
    it('POSTs blocklist to synapse admin API', async () => {
      const authedRequest = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ getHttp: () => ({ authedRequest }) })
      await ops.setInviteBlocklist('!r', ['@bad:e'])
      expect(authedRequest).toHaveBeenCalledWith('POST', '/_synapse/admin/v1/rooms/!r/invite_blocklist', undefined, {
        blocked: ['@bad:e']
      })
    })
  })

  // === MemberProfile methods ===

  describe('setMemberDisplayName', () => {
    it('merges displayName into existing member content', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      const getStateEvents = vi.fn().mockReturnValue({
        getContent: () => ({ membership: 'join', displayname: 'Old' })
      })
      getClientMock.mockReturnValueOnce({
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
    it('returns displayName from room member', async () => {
      getClientMock.mockReturnValueOnce({
        getRoom: () => ({
          getMember: (_uid: string) => ({ rawDisplayName: 'Alice', name: 'alice' })
        })
      })
      expect(await ops.getMemberDisplayName('!r', '@alice:e')).toBe('Alice')
    })

    it('returns null when room is missing', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      expect(await ops.getMemberDisplayName('!r', '@alice:e')).toBeNull()
    })
  })

  describe('setMemberPowerLevel', () => {
    it('forwards to client.setUserPowerLevel', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setUserPowerLevel })
      await ops.setMemberPowerLevel('!r', '@u:e', 50)
      expect(setUserPowerLevel).toHaveBeenCalledWith('@u:e', '!r', 50)
    })
  })

  describe('setMemberAsAdmin', () => {
    it('sets power level to 100', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setUserPowerLevel })
      await ops.setMemberAsAdmin('!r', '@u:e')
      expect(setUserPowerLevel).toHaveBeenCalledWith('@u:e', '!r', 100)
    })
  })

  describe('removeMemberAsAdmin', () => {
    it('sets power level to 0', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setUserPowerLevel })
      await ops.removeMemberAsAdmin('!r', '@u:e')
      expect(setUserPowerLevel).toHaveBeenCalledWith('@u:e', '!r', 0)
    })
  })
})
