// src/services/matrix/room/ReadFacade.ts

import { matrixRoomAccountDataService } from './AccountDataService'
import { matrixRoomMetadataService } from './MetadataService'
import { roomOperations } from './RoomOperations'
import type { MatrixRoomLiteSummary, MatrixRoomSummary } from './SummaryService'
import { matrixRoomSummaryAggregateService } from './SummaryService'
import { matrixRoomTimelineService } from './TimelineService'

export interface MatrixRoomReadFacade {
  // --- Delegated to RoomOperations (absorbed) ---
  getRoomState(roomId: string): Promise<unknown[]>
  getRoomAliases(roomId: string): Promise<string[]>
  getPinnedEvents(roomId: string): Promise<string[]>
  getStickyEvents(roomId: string): Promise<Record<string, unknown>>
  getInviteBlocklist(roomId: string): Promise<string[]>
  getInviteAllowlist(roomId: string): Promise<string[]>
  getTags(roomId: string): Promise<Record<string, { order?: number }>>
  getServerDomain(): Promise<string>
  translateText(text: string, targetLang?: string, throwOnError?: boolean): Promise<string>
  getDirectRooms(throwOnError?: boolean): Promise<Map<string, string[]>>

  // --- Delegated to deeper services ---
  getRoomSummary(roomId: string, throwOnError?: boolean): Promise<MatrixRoomSummary | null>
  getRoomSummaries(roomIds: string[]): Promise<Map<string, MatrixRoomLiteSummary>>
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
  timestampToEvent(
    roomId: string,
    timestamp: number,
    dir?: 'f' | 'b'
  ): Promise<{ event_id: string; origin_server_ts: number } | null>
  getRoomCall(roomId: string, callId: string): Promise<Record<string, unknown> | null>
  getRoomSync(roomId: string): Promise<Record<string, unknown>>
  getReportScannerInfo(roomId: string, eventId: string): Promise<Record<string, unknown> | null>
  getExternalServices(): Promise<Array<Record<string, unknown>>>
  getRoomNotifications(
    roomId: string,
    params?: { from?: string; limit?: number }
  ): Promise<{ notifications: Array<Record<string, unknown>>; next_token?: string }>
  getRoomPermissions(roomId: string): Promise<Record<string, unknown>>
}

export const matrixRoomReadFacade: MatrixRoomReadFacade = {
  // Absorbed
  getRoomState: (roomId) => roomOperations.getRoomState(roomId),
  getRoomAliases: (roomId) => roomOperations.getAliases(roomId),
  getPinnedEvents: (roomId) => roomOperations.getPinnedEvents(roomId),
  getStickyEvents: (roomId) => roomOperations.getStickyEvents(roomId),
  getInviteBlocklist: (roomId) => roomOperations.getInviteBlocklist(roomId),
  getInviteAllowlist: (roomId) => roomOperations.getInviteAllowlist(roomId),
  getTags: (roomId) => roomOperations.getTags(roomId),
  getServerDomain: () => roomOperations.getServerDomain(),
  translateText: (text, targetLang?, throwOnError?) => roomOperations.translateText(text, targetLang, throwOnError),
  getDirectRooms: (throwOnError?) => roomOperations.getDirectRooms(throwOnError),

  // Deep
  getRoomSummary: (roomId, throwOnError?) => matrixRoomSummaryAggregateService.getRoomSummary(roomId, throwOnError),
  getRoomSummaries: (roomIds) => matrixRoomSummaryAggregateService.getRoomSummaries(roomIds),
  getEventContext: (roomId, eventId, limit?) => matrixRoomTimelineService.getEventContext(roomId, eventId, limit),
  getRoomVersion: (roomId) => matrixRoomMetadataService.getRoomVersion(roomId),
  getRoomCapabilities: (roomId) => matrixRoomMetadataService.getRoomCapabilities(roomId),
  getRoomTimeline: (roomId, options?) => matrixRoomTimelineService.getRoomTimeline(roomId, options),
  getRoomUnreadCount: (roomId) => matrixRoomTimelineService.getRoomUnreadCount(roomId),
  getRoomAccountData: (roomId, eventType) => matrixRoomAccountDataService.getRoomAccountData(roomId, eventType),
  getRoomMetadata: (roomId) => matrixRoomMetadataService.getRoomMetadata(roomId),
  getRoomTurnServer: (roomId) => matrixRoomMetadataService.getRoomTurnServer(roomId),
  timestampToEvent: (roomId, timestamp, dir?) => matrixRoomTimelineService.timestampToEvent(roomId, timestamp, dir),
  getRoomCall: (roomId, callId) => matrixRoomTimelineService.getRoomCall(roomId, callId),
  getRoomSync: (roomId) => matrixRoomMetadataService.getRoomSync(roomId),
  getReportScannerInfo: (roomId, eventId) => matrixRoomAccountDataService.getReportScannerInfo(roomId, eventId),
  getExternalServices: () => matrixRoomAccountDataService.getExternalServices(),
  getRoomNotifications: (roomId, params?) => matrixRoomTimelineService.getRoomNotifications(roomId, params),
  getRoomPermissions: (roomId) => matrixRoomMetadataService.getRoomPermissions(roomId)
}
