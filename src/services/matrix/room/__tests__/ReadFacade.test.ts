import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  accountDataServiceMock,
  metadataServiceMock,
  membershipServiceMock,
  roomOperationsMock,
  summaryServiceMock,
  timelineServiceMock
} = vi.hoisted(() => ({
  accountDataServiceMock: {
    getRoomAccountData: vi.fn(),
    getReportScannerInfo: vi.fn(),
    getAntiScreenshot: vi.fn(),
    getMessageQueue: vi.fn(),
    getEncryptedEvents: vi.fn(),
    signEvent: vi.fn(),
    verifyEvent: vi.fn()
  },
  metadataServiceMock: {
    getRoomVersion: vi.fn(),
    getRoomCapabilities: vi.fn(),
    getRoomMetadata: vi.fn(),
    getRoomTurnServer: vi.fn(),
    getRoomSync: vi.fn(),
    getRoomPermissions: vi.fn(),
    getRoomSpaces: vi.fn(),
    getRoomExternalIds: vi.fn(),
    getRoomServiceTypes: vi.fn()
  },
  membershipServiceMock: {
    getMembershipEvents: vi.fn(),
    getRecentMemberChanges: vi.fn()
  },
  roomOperationsMock: {
    getRoomState: vi.fn(),
    getAliases: vi.fn(),
    getPinnedEvents: vi.fn(),
    getStickyEvents: vi.fn(),
    getInviteBlocklist: vi.fn(),
    getInviteAllowlist: vi.fn(),
    getTags: vi.fn(),
    getServerDomain: vi.fn(),
    translateText: vi.fn(),
    getDirectRooms: vi.fn()
  },
  summaryServiceMock: {
    getRoomSummary: vi.fn()
  },
  timelineServiceMock: {
    getEventContext: vi.fn(),
    getRoomTimeline: vi.fn(),
    getRoomUnreadCount: vi.fn(),
    timestampToEvent: vi.fn(),
    getRoomCall: vi.fn(),
    getRoomNotifications: vi.fn(),
    getRoomEventPerspective: vi.fn(),
    getRoomEventMediaUrls: vi.fn()
  }
}))

vi.mock('../AccountDataService', () => ({
  matrixRoomAccountDataService: accountDataServiceMock
}))

vi.mock('../MetadataService', () => ({
  matrixRoomMetadataService: metadataServiceMock
}))

vi.mock('../MembershipService', () => ({
  matrixRoomMembershipService: membershipServiceMock
}))

vi.mock('../RoomOperations', () => ({
  roomOperations: roomOperationsMock
}))

vi.mock('../SummaryService', () => ({
  matrixRoomSummaryAggregateService: summaryServiceMock
}))

vi.mock('../TimelineService', () => ({
  matrixRoomTimelineService: timelineServiceMock
}))

import { matrixRoomReadFacade } from '../RoomFacade'

describe('matrixRoomReadFacade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('RoomOperations 委托', () => {
    it('getRoomState 委托', async () => {
      const state = [{ type: 'm.room.create' }] as never
      roomOperationsMock.getRoomState.mockResolvedValue(state)
      const result = await matrixRoomReadFacade.getRoomState('!r:e')
      expect(roomOperationsMock.getRoomState).toHaveBeenCalledWith('!r:e')
      expect(result).toBe(state)
    })

    it('getRoomAliases 委托', async () => {
      roomOperationsMock.getAliases.mockResolvedValue(['#a:e'])
      const result = await matrixRoomReadFacade.getRoomAliases('!r:e')
      expect(roomOperationsMock.getAliases).toHaveBeenCalledWith('!r:e')
      expect(result).toEqual(['#a:e'])
    })

    it('getPinnedEvents 委托', async () => {
      roomOperationsMock.getPinnedEvents.mockResolvedValue(['$1', '$2'])
      const result = await matrixRoomReadFacade.getPinnedEvents('!r:e')
      expect(roomOperationsMock.getPinnedEvents).toHaveBeenCalledWith('!r:e')
      expect(result).toEqual(['$1', '$2'])
    })

    it('getStickyEvents 委托', async () => {
      const sticky = { events: ['$e'] } as never
      roomOperationsMock.getStickyEvents.mockResolvedValue(sticky)
      const result = await matrixRoomReadFacade.getStickyEvents('!r:e')
      expect(roomOperationsMock.getStickyEvents).toHaveBeenCalledWith('!r:e')
      expect(result).toBe(sticky)
    })

    it('getInviteBlocklist 委托', async () => {
      roomOperationsMock.getInviteBlocklist.mockResolvedValue(['@a:e'])
      await matrixRoomReadFacade.getInviteBlocklist('!r:e')
      expect(roomOperationsMock.getInviteBlocklist).toHaveBeenCalledWith('!r:e')
    })

    it('getInviteAllowlist 委托', async () => {
      roomOperationsMock.getInviteAllowlist.mockResolvedValue(['@a:e'])
      await matrixRoomReadFacade.getInviteAllowlist('!r:e')
      expect(roomOperationsMock.getInviteAllowlist).toHaveBeenCalledWith('!r:e')
    })

    it('getTags 委托', async () => {
      const tags = { 'm.favourite': { order: 0.5 } } as never
      roomOperationsMock.getTags.mockResolvedValue(tags)
      const result = await matrixRoomReadFacade.getTags('!r:e')
      expect(roomOperationsMock.getTags).toHaveBeenCalledWith('!r:e')
      expect(result).toBe(tags)
    })

    it('getServerDomain 委托', async () => {
      roomOperationsMock.getServerDomain.mockResolvedValue('example.com')
      const result = await matrixRoomReadFacade.getServerDomain()
      expect(roomOperationsMock.getServerDomain).toHaveBeenCalledWith()
      expect(result).toBe('example.com')
    })

    it('translateText 委托（带全部参数）', async () => {
      roomOperationsMock.translateText.mockResolvedValue('Hola')
      const result = await matrixRoomReadFacade.translateText('Hello', 'es', true)
      expect(roomOperationsMock.translateText).toHaveBeenCalledWith('Hello', 'es', true)
      expect(result).toBe('Hola')
    })

    it('translateText 委托（仅 text 参数）', async () => {
      roomOperationsMock.translateText.mockResolvedValue('Hello')
      await matrixRoomReadFacade.translateText('Hello')
      expect(roomOperationsMock.translateText).toHaveBeenCalledWith('Hello', undefined, undefined)
    })

    it('getDirectRooms 委托（带 throwOnError）', async () => {
      const dm = new Map([['@u:e', ['!r:e']]]) as never
      roomOperationsMock.getDirectRooms.mockResolvedValue(dm)
      const result = await matrixRoomReadFacade.getDirectRooms(false)
      expect(roomOperationsMock.getDirectRooms).toHaveBeenCalledWith(false)
      expect(result).toBe(dm)
    })

    it('getDirectRooms 委托（默认参数）', async () => {
      roomOperationsMock.getDirectRooms.mockResolvedValue(new Map() as never)
      await matrixRoomReadFacade.getDirectRooms()
      expect(roomOperationsMock.getDirectRooms).toHaveBeenCalledWith(undefined)
    })

    it('透传 RoomOperations 错误', async () => {
      roomOperationsMock.getRoomState.mockRejectedValue(new Error('500'))
      await expect(matrixRoomReadFacade.getRoomState('!r:e')).rejects.toThrow('500')
    })
  })

  describe('SummaryService 委托', () => {
    it('getRoomSummary 委托（带 throwOnError）', async () => {
      const summary = { roomId: '!r:e' } as never
      summaryServiceMock.getRoomSummary.mockResolvedValue(summary)
      const result = await matrixRoomReadFacade.getRoomSummary('!r:e', false)
      expect(summaryServiceMock.getRoomSummary).toHaveBeenCalledWith('!r:e', false)
      expect(result).toBe(summary)
    })

    it('getRoomSummary 委托（默认参数）', async () => {
      summaryServiceMock.getRoomSummary.mockResolvedValue(null)
      await matrixRoomReadFacade.getRoomSummary('!r:e')
      expect(summaryServiceMock.getRoomSummary).toHaveBeenCalledWith('!r:e', undefined)
    })
  })

  describe('TimelineService 委托', () => {
    it('getEventContext 委托（带 limit）', async () => {
      const ctx = { event: {}, events_before: [], events_after: [], state: [] } as never
      timelineServiceMock.getEventContext.mockResolvedValue(ctx)
      const result = await matrixRoomReadFacade.getEventContext('!r:e', '$e', 10)
      expect(timelineServiceMock.getEventContext).toHaveBeenCalledWith('!r:e', '$e', 10)
      expect(result).toBe(ctx)
    })

    it('getEventContext 委托（无 limit）', async () => {
      timelineServiceMock.getEventContext.mockResolvedValue(null)
      const result = await matrixRoomReadFacade.getEventContext('!r:e', '$e')
      expect(timelineServiceMock.getEventContext).toHaveBeenCalledWith('!r:e', '$e', undefined)
      expect(result).toBeNull()
    })

    it('getRoomTimeline 委托（带 options）', async () => {
      const timeline = { chunk: [], start: 's', end: 'e' } as never
      timelineServiceMock.getRoomTimeline.mockResolvedValue(timeline)
      const options = { from: 't1', limit: 20, dir: 'f' as const }
      const result = await matrixRoomReadFacade.getRoomTimeline('!r:e', options)
      expect(timelineServiceMock.getRoomTimeline).toHaveBeenCalledWith('!r:e', options)
      expect(result).toBe(timeline)
    })

    it('getRoomTimeline 委托（无 options）', async () => {
      timelineServiceMock.getRoomTimeline.mockResolvedValue({ chunk: [], start: '', end: '' } as never)
      await matrixRoomReadFacade.getRoomTimeline('!r:e')
      expect(timelineServiceMock.getRoomTimeline).toHaveBeenCalledWith('!r:e', undefined)
    })

    it('getRoomUnreadCount 委托', async () => {
      const unread = { unread_notifications: 3, unread_highlighted: 1 } as never
      timelineServiceMock.getRoomUnreadCount.mockResolvedValue(unread)
      const result = await matrixRoomReadFacade.getRoomUnreadCount('!r:e')
      expect(timelineServiceMock.getRoomUnreadCount).toHaveBeenCalledWith('!r:e')
      expect(result).toBe(unread)
    })

    it('timestampToEvent 委托（带 dir）', async () => {
      const found = { event_id: '$e', origin_server_ts: 123 } as never
      timelineServiceMock.timestampToEvent.mockResolvedValue(found)
      const result = await matrixRoomReadFacade.timestampToEvent('!r:e', 123, 'b')
      expect(timelineServiceMock.timestampToEvent).toHaveBeenCalledWith('!r:e', 123, 'b')
      expect(result).toBe(found)
    })

    it('timestampToEvent 委托（无 dir）', async () => {
      timelineServiceMock.timestampToEvent.mockResolvedValue(null)
      await matrixRoomReadFacade.timestampToEvent('!r:e', 0)
      expect(timelineServiceMock.timestampToEvent).toHaveBeenCalledWith('!r:e', 0, undefined)
    })

    it('getRoomCall 委托', async () => {
      const call = { call_id: 'c1' } as never
      timelineServiceMock.getRoomCall.mockResolvedValue(call)
      const result = await matrixRoomReadFacade.getRoomCall('!r:e', 'c1')
      expect(timelineServiceMock.getRoomCall).toHaveBeenCalledWith('!r:e', 'c1')
      expect(result).toBe(call)
    })

    it('getRoomNotifications 委托（带 params）', async () => {
      const notifs = { notifications: [], next_token: 't' } as never
      timelineServiceMock.getRoomNotifications.mockResolvedValue(notifs)
      const result = await matrixRoomReadFacade.getRoomNotifications('!r:e', { limit: 10 })
      expect(timelineServiceMock.getRoomNotifications).toHaveBeenCalledWith('!r:e', { limit: 10 })
      expect(result).toBe(notifs)
    })

    it('getRoomNotifications 委托（无 params）', async () => {
      timelineServiceMock.getRoomNotifications.mockResolvedValue({ notifications: [] } as never)
      await matrixRoomReadFacade.getRoomNotifications('!r:e')
      expect(timelineServiceMock.getRoomNotifications).toHaveBeenCalledWith('!r:e', undefined)
    })

    it('getRoomEventPerspective 委托', async () => {
      const outcome = { status: 'empty' } as never
      timelineServiceMock.getRoomEventPerspective.mockResolvedValue(outcome)
      const result = await matrixRoomReadFacade.getRoomEventPerspective('!r:e', '$e')
      expect(timelineServiceMock.getRoomEventPerspective).toHaveBeenCalledWith('!r:e', '$e')
      expect(result).toBe(outcome)
    })

    it('透传 timeline 错误', async () => {
      timelineServiceMock.getRoomTimeline.mockRejectedValue(new Error('403'))
      await expect(matrixRoomReadFacade.getRoomTimeline('!r:e')).rejects.toThrow('403')
    })
  })

  describe('MetadataService 委托', () => {
    it('getRoomVersion 委托', async () => {
      metadataServiceMock.getRoomVersion.mockResolvedValue('11')
      const result = await matrixRoomReadFacade.getRoomVersion('!r:e')
      expect(metadataServiceMock.getRoomVersion).toHaveBeenCalledWith('!r:e')
      expect(result).toBe('11')
    })

    it('getRoomCapabilities 委托', async () => {
      const caps = { 'm.room_versions': {} } as never
      metadataServiceMock.getRoomCapabilities.mockResolvedValue(caps)
      const result = await matrixRoomReadFacade.getRoomCapabilities('!r:e')
      expect(metadataServiceMock.getRoomCapabilities).toHaveBeenCalledWith('!r:e')
      expect(result).toBe(caps)
    })

    it('getRoomMetadata 委托', async () => {
      const meta = { name: 'R' } as never
      metadataServiceMock.getRoomMetadata.mockResolvedValue(meta)
      const result = await matrixRoomReadFacade.getRoomMetadata('!r:e')
      expect(metadataServiceMock.getRoomMetadata).toHaveBeenCalledWith('!r:e')
      expect(result).toBe(meta)
    })

    it('getRoomTurnServer 委托', async () => {
      const turn = { status: 'empty' } as never
      metadataServiceMock.getRoomTurnServer.mockResolvedValue(turn)
      const result = await matrixRoomReadFacade.getRoomTurnServer('!r:e')
      expect(metadataServiceMock.getRoomTurnServer).toHaveBeenCalledWith('!r:e')
      expect(result).toBe(turn)
    })

    it('getRoomSync 委托', async () => {
      const sync = { timeline: {} } as never
      metadataServiceMock.getRoomSync.mockResolvedValue(sync)
      const result = await matrixRoomReadFacade.getRoomSync('!r:e')
      expect(metadataServiceMock.getRoomSync).toHaveBeenCalledWith('!r:e')
      expect(result).toBe(sync)
    })

    it('getRoomPermissions 委托', async () => {
      const perms = { status: 'empty' } as never
      metadataServiceMock.getRoomPermissions.mockResolvedValue(perms)
      const result = await matrixRoomReadFacade.getRoomPermissions('!r:e')
      expect(metadataServiceMock.getRoomPermissions).toHaveBeenCalledWith('!r:e')
      expect(result).toBe(perms)
    })

    it('getRoomSpaces 委托', async () => {
      const spaces = { status: 'empty' } as never
      metadataServiceMock.getRoomSpaces.mockResolvedValue(spaces)
      const result = await matrixRoomReadFacade.getRoomSpaces('!r:e')
      expect(metadataServiceMock.getRoomSpaces).toHaveBeenCalledWith('!r:e')
      expect(result).toBe(spaces)
    })

    it('getRoomExternalIds 委托', async () => {
      const ids = [{ type: 'room_alias', value: '#a:e' }] as never
      metadataServiceMock.getRoomExternalIds.mockResolvedValue(ids)
      const result = await matrixRoomReadFacade.getRoomExternalIds('!r:e')
      expect(metadataServiceMock.getRoomExternalIds).toHaveBeenCalledWith('!r:e')
      expect(result).toBe(ids)
    })

    it('透传 metadata 错误', async () => {
      metadataServiceMock.getRoomVersion.mockRejectedValue(new Error('404'))
      await expect(matrixRoomReadFacade.getRoomVersion('!r:e')).rejects.toThrow('404')
    })
  })

  describe('AccountDataService 委托', () => {
    it('getRoomAccountData 委托', async () => {
      const data = { foo: 1 } as never
      accountDataServiceMock.getRoomAccountData.mockResolvedValue(data)
      const result = await matrixRoomReadFacade.getRoomAccountData('!r:e', 'm.x')
      expect(accountDataServiceMock.getRoomAccountData).toHaveBeenCalledWith('!r:e', 'm.x')
      expect(result).toBe(data)
    })

    it('getReportScannerInfo 委托', async () => {
      const info = { clean: true } as never
      accountDataServiceMock.getReportScannerInfo.mockResolvedValue(info)
      const result = await matrixRoomReadFacade.getReportScannerInfo('!r:e', '$e')
      expect(accountDataServiceMock.getReportScannerInfo).toHaveBeenCalledWith('!r:e', '$e')
      expect(result).toBe(info)
    })
  })

  describe('房间扩展端点委托', () => {
    it('getAntiScreenshot 委托', async () => {
      accountDataServiceMock.getAntiScreenshot.mockResolvedValue({ enabled: true })
      const result = await matrixRoomReadFacade.getAntiScreenshot('!r:e')
      expect(accountDataServiceMock.getAntiScreenshot).toHaveBeenCalledWith('!r:e')
      expect(result).toEqual({ enabled: true })
    })

    it('getMessageQueue 委托', async () => {
      const queue = { messages: [] } as never
      accountDataServiceMock.getMessageQueue.mockResolvedValue(queue)
      const result = await matrixRoomReadFacade.getMessageQueue('!r:e')
      expect(accountDataServiceMock.getMessageQueue).toHaveBeenCalledWith('!r:e')
      expect(result).toBe(queue)
    })

    it('getEncryptedEvents 委托', async () => {
      const events = { events: [{ event_id: '$e' }] }
      accountDataServiceMock.getEncryptedEvents.mockResolvedValue(events)
      const result = await matrixRoomReadFacade.getEncryptedEvents('!r:e')
      expect(accountDataServiceMock.getEncryptedEvents).toHaveBeenCalledWith('!r:e')
      expect(result).toBe(events)
    })

    it('signEvent 委托', async () => {
      const signature = { signature: 'sig' } as never
      accountDataServiceMock.signEvent.mockResolvedValue(signature)
      const result = await matrixRoomReadFacade.signEvent('!r:e', '$e')
      expect(accountDataServiceMock.signEvent).toHaveBeenCalledWith('!r:e', '$e')
      expect(result).toBe(signature)
    })

    it('verifyEvent 委托', async () => {
      accountDataServiceMock.verifyEvent.mockResolvedValue({ valid: true })
      const result = await matrixRoomReadFacade.verifyEvent('!r:e', '$e')
      expect(accountDataServiceMock.verifyEvent).toHaveBeenCalledWith('!r:e', '$e')
      expect(result).toEqual({ valid: true })
    })

    it('透传扩展端点错误', async () => {
      accountDataServiceMock.verifyEvent.mockRejectedValue(new Error('403'))
      await expect(matrixRoomReadFacade.verifyEvent('!r:e', '$e')).rejects.toThrow('403')
    })
  })

  describe('ROOM-03 三端点委托', () => {
    it('getRoomEventMediaUrls 委托 TimelineService', async () => {
      const outcome = { status: 'empty' } as const
      timelineServiceMock.getRoomEventMediaUrls.mockResolvedValue(outcome)
      const result = await matrixRoomReadFacade.getRoomEventMediaUrls('!r:e', '$e')
      expect(timelineServiceMock.getRoomEventMediaUrls).toHaveBeenCalledWith('!r:e', '$e')
      expect(result).toBe(outcome)
    })

    it('getRoomServiceTypes 委托 MetadataService', async () => {
      const outcome = { status: 'ok', serviceTypes: ['messaging'] } as const
      metadataServiceMock.getRoomServiceTypes.mockResolvedValue(outcome)
      const result = await matrixRoomReadFacade.getRoomServiceTypes('!r:e')
      expect(metadataServiceMock.getRoomServiceTypes).toHaveBeenCalledWith('!r:e')
      expect(result).toBe(outcome)
    })

    it('getMembershipEvents 委托 MembershipService 并透传 limit', async () => {
      const outcome = { status: 'empty' } as const
      membershipServiceMock.getMembershipEvents.mockResolvedValue(outcome)
      const result = await matrixRoomReadFacade.getMembershipEvents('!r:e', 20)
      expect(membershipServiceMock.getMembershipEvents).toHaveBeenCalledWith('!r:e', 20)
      expect(result).toBe(outcome)
    })

    it('getRecentMemberChanges 委托 MembershipService 并透传 limit', async () => {
      const outcome = { status: 'empty' } as const
      membershipServiceMock.getRecentMemberChanges.mockResolvedValue(outcome)
      const result = await matrixRoomReadFacade.getRecentMemberChanges('!r:e', 8)
      expect(membershipServiceMock.getRecentMemberChanges).toHaveBeenCalledWith('!r:e', 8)
      expect(result).toBe(outcome)
    })
  })
})
