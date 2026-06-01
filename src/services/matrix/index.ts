import { MatrixAuthService } from './auth/MatrixAuthService'

export type {
  AIConnectionInfo,
  CallMcpToolRequest,
  CreateAIConnectionRequest,
  McpTool
} from './ai/MatrixAIConnectionService'
export { matrixAIConnectionService } from './ai/MatrixAIConnectionService'
export { MatrixAuthService } from './auth/MatrixAuthService'
export { BaseMatrixService } from './BaseMatrixService'
export type { ConnectionState, MatrixClientConfig } from './MatrixClientService'
export { matrixClientService } from './MatrixClientService'
export const matrixAuthService = new MatrixAuthService()
export type { PushRuleKind, RoomMember } from 'matrix-js-sdk'
// ============================================================
// SDK re-exports: single choke-point for components and stores.
// Components/stores MUST NOT import from 'matrix-js-sdk' directly;
// import from '@/services/matrix' instead.
// ============================================================
export { Direction, EventType, Preset } from 'matrix-js-sdk'
export type {
  AdminReport,
  ContentFilter,
  CreateContentFilterRequest,
  FederationBlacklistEntry,
  FederationDestination,
  QuotaAlert,
  QuotaConfig,
  QuotaStats,
  QuotaStatus,
  RateLimit,
  RegistrationToken,
  Report,
  ReportFilters,
  ReportReason,
  ReportRequest,
  ReportRoomResponse,
  ResolveReportRequest,
  RetentionPolicy,
  RoomInfo,
  RoomRetention,
  RoomState,
  ScannerInfo,
  ServerHealth,
  ServerInfo,
  ServerNoticeInfo,
  ServerNoticeResult,
  ServerQuota,
  ServerStats,
  ServerStatus,
  ServerVersion,
  ShadowBanStatus,
  ShutdownRoomResult,
  UserDevice,
  UserInfo,
  UserReputation
} from './admin'
export { adminService, useAdmin } from './admin'
export type {
  AIAsyncGenerationResponse,
  AIConversation,
  AIMessage,
  AIModelRemainingUsageResponse,
  AudioGenerationRequest,
  ImageGenerationRequest,
  ImageGenerationResult,
  StreamCallbacks,
  VideoGenerationRequest
} from './ai/AIService'
export { aiService } from './ai/AIService'
export type { ApiKey, ApiKeyBalance, ApiKeyBalanceInfo, Platform } from './ai/ApiKeyService'
export { apiKeyService } from './ai/ApiKeyService'
export type { ChatRole } from './ai/ChatRoleService'
export { chatRoleService } from './ai/ChatRoleService'
export type { Conversation, Message } from './ai/ConversationService'
export { conversationService } from './ai/ConversationService'
export type { AIModel } from './ai/ModelService'
export { modelService } from './ai/ModelService'
export type {
  MatrixCaptchaResult,
  MatrixEmailTokenResult,
  MatrixLoginResult,
  MatrixRegisterResult
} from './auth/MatrixAuthService'
export type {
  OidcAuthorizationUrlParams,
  OidcDiscoveryDocument,
  OidcTokenResponse,
  OidcUserInfo
} from './auth/MatrixOidcService'
export { matrixOidcService } from './auth/MatrixOidcService'
export type { QrCodeResult, QrLoginStatusResult } from './auth/MatrixQrLoginBridgeService'
export { matrixQrLoginBridgeService } from './auth/MatrixQrLoginBridgeService'
export type {
  QRCodeResult,
  QRLoginResult,
  QRLoginState,
  QRLoginStatus,
  UseQRLoginOptions
} from './auth/MatrixQrLoginService'
export { matrixQrLoginService, useQRLogin } from './auth/MatrixQrLoginService'
export type {
  MatrixPasswordLoginOptions,
  MatrixPostLoginBootstrapOptions,
  PresenceUpdate,
  RestoreMatrixRuntimeSessionOptions,
  SessionStorePort,
  StoredMatrixTokens
} from './auth/MatrixRuntimeSessionService'
export { MatrixRuntimeSessionService } from './auth/MatrixRuntimeSessionService'
export type { SessionDetail, SessionInfo } from './auth/MatrixSessionService'
export { matrixSessionService } from './auth/MatrixSessionService'
export { sessionOrchestrator } from './auth/SessionOrchestrator'
export { cryptoSDKAdapter } from './crypto/CryptoSDKAdapter'
export { matrixCryptoService } from './crypto/MatrixCryptoService'
export { matrixDehydratedDeviceService } from './crypto/MatrixDehydratedDeviceService'
export type { E2EEDetailedStatus, E2EEStatus } from './crypto/MatrixE2EEBootstrapService'
export { matrixE2EEBootstrapService, matrixE2EEManager } from './crypto/MatrixE2EEBootstrapService'
export type { MatrixEncryptionSessionContext, PreparedKeyBackupVersion } from './crypto/MatrixEncryptionContextService'
export { matrixEncryptionContextService } from './crypto/MatrixEncryptionContextService'
export type { KeyRotationRecord, KeyRotationStatus } from './crypto/MatrixEncryptionService'
export { matrixEncryptionService } from './crypto/MatrixEncryptionService'
export type {
  BackupVersion,
  BackupVersionInfo,
  BatchRecoverResult,
  ExportResult,
  ImportResult,
  RecoveryProgress,
  RoomKeyBackup,
  VerifyResult
} from './crypto/MatrixKeyBackupService'
// Key Backup 服务
export { matrixKeyBackupService } from './crypto/MatrixKeyBackupService'
export type {
  SasVerification,
  VerificationCancelReason,
  VerificationMethod,
  VerificationRequest,
  VerificationState
} from './crypto/MatrixVerificationService'
// Verification 服务
export { matrixVerificationService } from './crypto/MatrixVerificationService'
export { matrixFriendService } from './friends/MatrixFriendService'
export { matrixSpecialFriendService } from './friends/MatrixSpecialFriendService'
export { matrixGuestService } from './guest/MatrixGuestService'
export { matrixApplicationService } from './MatrixApplicationService'
export { createCachedFetcher, MatrixCacheManager } from './MatrixCacheManager'
export { matrixEventService } from './MatrixEventService'
export type { MatrixHttpRequestOptions } from './MatrixHttpClient'
export { matrixHttpClient } from './MatrixHttpClient'
export { createDedupedFetcher, MatrixRequestDeduper } from './MatrixRequestDeduper'
/** @deprecated Use MatrixHttpRequestOptions from MatrixHttpClient instead */
export type { RequestOptions } from './MatrixRequestHelper'
/** @deprecated Use matrixHttpClient from MatrixHttpClient instead */
export { MatrixRequestHelper } from './MatrixRequestHelper'
export { matrixSearchService } from './MatrixSearchService'
export type {
  BeaconInfo,
  BeaconLocation,
  CreateBeaconParams,
  UpdateBeaconLocationParams
} from './media/MatrixBeaconService'
// Beacon 服务
export { matrixBeaconService } from './media/MatrixBeaconService'
export type { LiveLocationShare, LocationData } from './media/MatrixLocationService'
// Location 服务
export { matrixLocationService } from './media/MatrixLocationService'
export { matrixMediaService } from './media/MatrixMediaService'
export { matrixMultimediaService } from './media/MatrixMultimediaService'
export type { UrlPreview, UrlPreviewParams } from './media/MatrixUrlPreviewService'
// URL 预览服务
export { getDomain, matrixUrlPreviewService, simplifyUrl } from './media/MatrixUrlPreviewService'
export { matrixVoIPService } from './media/MatrixVoIPService'
export { matrixVoiceService } from './media/MatrixVoiceService'
export type { BurnMessageResponse, BurnPendingEvent, BurnSettings } from './messaging/MatrixBurnAfterReadService'
export { matrixBurnAfterReadService } from './messaging/MatrixBurnAfterReadService'
export type { EmojiItem, EmojiPack } from './messaging/MatrixEmojiService'
export { matrixEmojiService } from './messaging/MatrixEmojiService'
export { matrixForwardService } from './messaging/MatrixForwardService'
export { matrixMessageAdapter } from './messaging/MatrixMessageAdapter'
export { matrixMessageRelationService } from './messaging/MatrixMessageRelationService'
export type {
  MarkedMessage,
  MessageReaction,
  MessageSearchOptions,
  SendMessagePayload
} from './messaging/MatrixMessageService'
export { matrixMessageService } from './messaging/MatrixMessageService'
export { matrixReactionService } from './messaging/MatrixReactionService'
export { matrixReceiptService } from './messaging/MatrixReceiptService'
export type { Thread, ThreadMessage } from './messaging/MatrixThreadService'
export { matrixThreadService } from './messaging/MatrixThreadService'
export { matrixTypingService } from './messaging/MatrixTypingService'
export { matrixEventReportService } from './moderation/MatrixEventReportService'
export { matrixNotificationService } from './notifications/MatrixNotificationService'
export type { IPusher, IPushRule, IPushRules } from './notifications/MatrixPushService'
export { matrixPushService } from './notifications/MatrixPushService'
export { matrixRoomNotificationService } from './notifications/MatrixRoomNotificationService'
export { matrixServerNotificationService } from './notifications/MatrixServerNotificationService'
export type {
  CreateSessionResponse,
  GetMessagesResponse,
  RendezvousMessage,
  RendezvousSession,
  RendezvousSessionIntent,
  RendezvousSessionStatus,
  RendezvousSessionTransport,
  SendMessageResponse,
  UpdateSessionResponse
} from './rendezvous/MatrixRendezvousService'
// Rendezvous 服务
export { matrixRendezvousService } from './rendezvous/MatrixRendezvousService'
export { matrixRoomAccountDataService } from './room/AccountDataService'
export { matrixRoomAliasesService } from './room/AliasesService'
export { matrixRoomCreationService } from './room/CreationService'
export { matrixRoomDirectMessageService } from './room/DirectMessageService'
export { matrixRoomLifecycleService } from './room/LifecycleService'
export type { Announcement, AnnouncementContent } from './room/MatrixAnnouncementService'
export { matrixAnnouncementService } from './room/MatrixAnnouncementService'
export type { CreateDmOptions, DmRoomInfo, IDirectRoomsMap } from './room/MatrixDirectMessageService'
export { matrixDirectMessageService } from './room/MatrixDirectMessageService'
export type { CreateRoomOptions, RoomPowerLevels } from './room/MatrixGroupService'
export { matrixGroupService } from './room/MatrixGroupService'
export { matrixRoomService } from './room/MatrixRoomService'
export { matrixRoomStoreAdapter } from './room/MatrixRoomStoreAdapter'
export type {
  MatrixRoomMemberInfo,
  MatrixRoomStats,
  MatrixRoomSummaryInfo
} from './room/MatrixRoomSummaryService'
export { matrixRoomSummaryService } from './room/MatrixRoomSummaryService'
export type { SpaceInfo, SpaceOptions } from './room/MatrixSpaceService'
export { matrixSpaceService } from './room/MatrixSpaceService'
export { matrixRoomMemberProfileService } from './room/MemberProfileService'
export { matrixRoomMembershipService } from './room/MembershipService'
export { matrixRoomMetadataService } from './room/MetadataService'
export { matrixRoomModerationService } from './room/ModerationService'
export { matrixRoomPinsService } from './room/PinsService'
export type { VisibleRoomSession } from './room/RealtimeService'
export { matrixRoomRealtimeService } from './room/RealtimeService'
export { roomListService } from './room/RoomListService'
export { roomNavigationService } from './room/RoomNavigationService'
export { roomStateService } from './room/RoomStateService'
export { matrixRoomStateService } from './room/StateService'
export type { MatrixRoomSummary } from './room/SummaryService'
export { matrixRoomSummaryAggregateService } from './room/SummaryService'
export { matrixRoomTagsService } from './room/TagsService'
export { matrixRoomTimelineService } from './room/TimelineService'
export { matrixRoomTranslateService } from './room/TranslateService'
export type {
  BurnStats,
  InviteAllowlist,
  InviteBlocklist,
  RoomSummary,
  RoomSummaryMember,
  RoomSummaryStats,
  StickyEvent
} from './SynapseRustExtensionsService'
export { synapseRustExtensionsService } from './SynapseRustExtensionsService'
export { MatrixSlidingSyncService } from './sync/MatrixSlidingSyncService'
export { syncService } from './sync/MatrixSyncService'
export { matrixAccountService } from './user/MatrixAccountService'
export type { DirectChatResult, UserProfile } from './user/MatrixContactService'
export { matrixContactService } from './user/MatrixContactService'
export type {
  Device,
  DeviceDetailResponse,
  DeviceListUpdatesRequest,
  DeviceListUpdatesResponse,
  DevicesResponse,
  DeviceUpdateResponse
} from './user/MatrixDeviceService'
// Device 服务
export { matrixDeviceService } from './user/MatrixDeviceService'
export type { PresenceInfo, PresenceListResponse, PresenceState } from './user/MatrixPresenceService'
// Presence 服务
export { matrixPresenceService } from './user/MatrixPresenceService'
export { profileService } from './user/MatrixProfileService'
export { userDirectoryService } from './user/MatrixUserDirectoryService'
export type { Widget } from './widget/MatrixWidgetService'
export { matrixWidgetService } from './widget/MatrixWidgetService'
