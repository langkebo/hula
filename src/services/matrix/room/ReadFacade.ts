import { matrixRoomAccountDataService } from './AccountDataService'
import { matrixRoomAliasesService } from './AliasesService'
import { matrixRoomMetadataService } from './MetadataService'
import { matrixRoomModerationService } from './ModerationService'
import { matrixRoomPinsService } from './PinsService'
import { matrixRoomStateService } from './StateService'
import { type MatrixRoomSummary, matrixRoomSummaryAggregateService } from './SummaryService'
import { matrixRoomTagsService } from './TagsService'
import { matrixRoomTimelineService } from './TimelineService'

export interface MatrixRoomReadFacade {
  getRoomState(roomId: string): Promise<unknown[]>
  getRoomSummary(roomId: string, throwOnError?: boolean): Promise<MatrixRoomSummary | null>
  getRoomSummaries(roomIds: string[]): Promise<
    Map<
      string,
      {
        name: string | null
        topic: string | null
        avatarUrl: string | null
        memberCount: number
      }
    >
  >
  getRoomAliases(roomId: string): Promise<string[]>
  getEventContext(
    roomId: string,
    eventId: string,
    limit?: number
  ): Promise<{
    event: unknown
    events_before: unknown[]
    events_after: unknown[]
    state: unknown[]
  } | null>
  getRoomVersion(roomId: string): Promise<string | null>
  getRoomCapabilities(roomId: string): Promise<Record<string, unknown>>
  getRoomTimeline(
    roomId: string,
    options?: { from?: string; limit?: number; dir?: 'f' | 'b' }
  ): Promise<{
    chunk: unknown[]
    start: string
    end: string
  }>
  getRoomUnreadCount(roomId: string): Promise<{
    unread_notifications: number
    unread_highlighted: number
  }>
  getRoomAccountData(roomId: string, eventType: string): Promise<Record<string, unknown> | null>
  getRoomMetadata(roomId: string): Promise<Record<string, unknown>>
  getRoomTurnServer(roomId: string): Promise<Record<string, unknown>>
  getPinnedEvents(roomId: string): Promise<string[]>
  getInviteBlocklist(roomId: string): Promise<string[]>
  getInviteAllowlist(roomId: string): Promise<string[]>
  getStickyEvents(roomId: string): Promise<Record<string, unknown>>
  timestampToEvent(
    roomId: string,
    timestamp: number,
    dir?: 'f' | 'b'
  ): Promise<{ event_id: string; origin_server_ts: number } | null>
  getRoomCall(roomId: string, callId: string): Promise<Record<string, unknown> | null>
  getRoomSync(roomId: string): Promise<Record<string, unknown>>
  getTags(roomId: string): Promise<Record<string, { order?: number }>>
  getReportScannerInfo(roomId: string, eventId: string): Promise<Record<string, unknown> | null>
  getExternalServices(): Promise<Array<Record<string, unknown>>>
  getRoomNotifications(
    roomId: string,
    params?: { from?: string; limit?: number }
  ): Promise<{ notifications: Array<Record<string, unknown>>; next_token?: string }>
  getRoomPermissions(roomId: string): Promise<Record<string, unknown>>
}

export const matrixRoomReadFacade: MatrixRoomReadFacade = {
  async getRoomState(roomId) {
    return matrixRoomStateService.getRoomState(roomId)
  },

  async getRoomSummary(roomId, throwOnError = true) {
    return matrixRoomSummaryAggregateService.getRoomSummary(roomId, throwOnError)
  },

  async getRoomSummaries(roomIds) {
    return matrixRoomSummaryAggregateService.getRoomSummaries(roomIds)
  },

  async getRoomAliases(roomId) {
    return matrixRoomAliasesService.getAliases(roomId)
  },

  async getEventContext(roomId, eventId, limit = 10) {
    return matrixRoomTimelineService.getEventContext(roomId, eventId, limit)
  },

  async getRoomVersion(roomId) {
    return matrixRoomMetadataService.getRoomVersion(roomId)
  },

  async getRoomCapabilities(roomId) {
    return matrixRoomMetadataService.getRoomCapabilities(roomId)
  },

  async getRoomTimeline(roomId, options) {
    return matrixRoomTimelineService.getRoomTimeline(roomId, options)
  },

  async getRoomUnreadCount(roomId) {
    return matrixRoomTimelineService.getRoomUnreadCount(roomId)
  },

  async getRoomAccountData(roomId, eventType) {
    return matrixRoomAccountDataService.getRoomAccountData(roomId, eventType)
  },

  async getRoomMetadata(roomId) {
    return matrixRoomMetadataService.getRoomMetadata(roomId)
  },

  async getRoomTurnServer(roomId) {
    return matrixRoomMetadataService.getRoomTurnServer(roomId)
  },

  async getPinnedEvents(roomId) {
    return matrixRoomPinsService.getPinnedEvents(roomId)
  },

  async getInviteBlocklist(roomId) {
    return matrixRoomModerationService.getInviteBlocklist(roomId)
  },

  async getInviteAllowlist(roomId) {
    return matrixRoomModerationService.getInviteAllowlist(roomId)
  },

  async getStickyEvents(roomId) {
    return matrixRoomPinsService.getStickyEvents(roomId)
  },

  async timestampToEvent(roomId, timestamp, dir = 'b') {
    return matrixRoomTimelineService.timestampToEvent(roomId, timestamp, dir)
  },

  async getRoomCall(roomId, callId) {
    return matrixRoomTimelineService.getRoomCall(roomId, callId)
  },

  async getRoomSync(roomId) {
    return matrixRoomMetadataService.getRoomSync(roomId)
  },

  async getTags(roomId) {
    return matrixRoomTagsService.getTags(roomId)
  },

  async getReportScannerInfo(roomId, eventId) {
    return matrixRoomAccountDataService.getReportScannerInfo(roomId, eventId)
  },

  async getExternalServices() {
    return matrixRoomAccountDataService.getExternalServices()
  },

  async getRoomNotifications(roomId, params) {
    return matrixRoomTimelineService.getRoomNotifications(roomId, params)
  },

  async getRoomPermissions(roomId) {
    return matrixRoomMetadataService.getRoomPermissions(roomId)
  }
}
