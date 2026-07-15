export { type AIConnection, type MCPTool, matrixRoomAccountDataService } from './AccountDataService'
export { matrixRoomCreationService } from './CreationService'
// DirectMessageService, LifecycleService absorbed into RoomOperations
export type { Announcement, AnnouncementContent } from './MatrixAnnouncementService'
export { matrixAnnouncementService } from './MatrixAnnouncementService'
export { matrixRoomStoreAdapter } from './MatrixRoomStoreAdapter'
export { matrixRoomSummaryService } from './MatrixRoomSummaryService'
export type { SpaceInfo, SpaceOptions } from './MatrixSpaceService'
export { matrixSpaceService } from './MatrixSpaceService'
// MemberProfileService absorbed into RoomOperations
export { matrixRoomMembershipService } from './MembershipService'
export { matrixRoomMetadataService } from './MetadataService'
// ModerationService, PinsService absorbed into RoomOperations
export { matrixRoomQueryService } from './QueryService'
export type { VisibleRoomSession } from './RealtimeService'
export { matrixRoomRealtimeService } from './RealtimeService'
export type {
  RoomCapabilitiesPayload,
  StableRoomCapabilityName,
  StableRoomFeatureName
} from './RoomCapabilitiesService'
export { ROOM_CAPABILITY_NAMES, ROOM_FEATURE_NAMES, roomCapabilitiesService } from './RoomCapabilitiesService'
export { roomOperations } from './RoomOperations'
// StateService absorbed into RoomOperations
export type { MatrixRoomSummary } from './SummaryService'
export { matrixRoomSummaryAggregateService } from './SummaryService'
// TagsService absorbed into RoomOperations
export { matrixRoomTimelineService } from './TimelineService'
// TranslateService absorbed into RoomOperations
