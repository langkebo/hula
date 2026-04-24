import { MatrixAuthService } from './auth/MatrixAuthService'
export { matrixClientService } from './MatrixClientService'
export type { ConnectionState, MatrixClientConfig } from './MatrixClientService'
export { MatrixAuthService } from './auth/MatrixAuthService'
export const matrixAuthService = new MatrixAuthService()
export { matrixAccountService } from './MatrixAccountService'
export { matrixRoomService } from './MatrixRoomService'
export { matrixEventService } from './MatrixEventService'
export type {
  MatrixLoginResult,
  MatrixRegisterResult,
  MatrixEmailTokenResult,
  MatrixCaptchaResult
} from './auth/MatrixAuthService'

export { matrixMessageService } from './messaging/MatrixMessageService'
export type { MessageSearchOptions, MessageReaction, MarkedMessage, SendMessagePayload } from './messaging/MatrixMessageService'

export { matrixContactService } from './MatrixContactService'
export type { UserProfile, DirectChatResult } from './MatrixContactService'

export { matrixFriendService } from './friends/MatrixFriendService'

export { matrixGroupService } from './MatrixGroupService'
export type { CreateRoomOptions, RoomPowerLevels } from './MatrixGroupService'

export { matrixMessageRelationService } from './messaging/MatrixMessageRelationService'
export { matrixReactionService } from './messaging/MatrixReactionService'
export { matrixMediaService } from './media/MatrixMediaService'
export { matrixCryptoService } from './crypto/MatrixCryptoService'
export { matrixEncryptionService } from './crypto/MatrixEncryptionService'
export { matrixEncryptionContextService } from './crypto/MatrixEncryptionContextService'
export type { MatrixEncryptionSessionContext, PreparedKeyBackupVersion } from './crypto/MatrixEncryptionContextService'
export { matrixSearchService } from './MatrixSearchService'
export { matrixSpaceService, type SpaceOptions, type SpaceInfo } from './MatrixSpaceService'
export { matrixPushService } from './notifications/MatrixPushService'
export type { IPusher, IPushRules, IPushRule } from './notifications/MatrixPushService'
export { matrixRoomNotificationService } from './notifications/MatrixRoomNotificationService'
export { matrixVoIPService } from './media/MatrixVoIPService'
export { matrixForwardService } from './messaging/MatrixForwardService'

export { matrixSessionService } from './auth/MatrixSessionService'
export type { SessionInfo, SessionDetail } from './auth/MatrixSessionService'
export { matrixRuntimeSessionService } from './auth/MatrixRuntimeSessionService'
export type {
  RestoreMatrixRuntimeSessionOptions,
  StoredMatrixTokens,
  MatrixPostLoginBootstrapOptions,
  MatrixPasswordLoginOptions
} from './auth/MatrixRuntimeSessionService'

export { matrixOidcService } from './auth/MatrixOidcService'
export type {
  OidcDiscoveryDocument,
  OidcUserInfo,
  OidcAuthorizationUrlParams,
  OidcTokenResponse
} from './auth/MatrixOidcService'

export { aiService } from './ai/AIService'
export type {
  AIConversation,
  AIMessage,
  AIAsyncGenerationResponse,
  AIModelRemainingUsageResponse,
  AudioGenerationRequest,
  ImageGenerationRequest,
  ImageGenerationResult,
  VideoGenerationRequest,
  StreamCallbacks
} from './ai/AIService'

export { apiKeyService } from './ai/ApiKeyService'
export type { ApiKey, ApiKeyBalance, ApiKeyBalanceInfo, Platform } from './ai/ApiKeyService'

export { chatRoleService } from './ai/ChatRoleService'
export type { ChatRole } from './ai/ChatRoleService'

export { conversationService } from './ai/ConversationService'
export type { Conversation, Message } from './ai/ConversationService'

export { modelService } from './ai/ModelService'
export type { AIModel } from './ai/ModelService'

export * from './auth/MatrixQrLoginService'
export { matrixAnnouncementService } from './MatrixAnnouncementService'
export type {
  Announcement,
  AnnouncementContent,
  AnnouncementCreateOptions,
  AnnouncementUpdateOptions
} from './MatrixAnnouncementService'

export { matrixEmojiService } from './messaging/MatrixEmojiService'
export type { EmojiPack, EmojiItem } from './messaging/MatrixEmojiService'

export { matrixReceiptService } from './MatrixReceiptService'
export { matrixModerationService } from './admin/MatrixModerationService'
export { matrixQuotaService } from './admin/MatrixQuotaService'
export type { QuotaStatus, QuotaStats, QuotaAlert } from './admin/MatrixQuotaService'

export { matrixSpecialFriendService } from './friends/MatrixSpecialFriendService'

export { synapseRustExtensionsService } from './SynapseRustExtensionsService'
export type {
  BurnStats,
  InviteBlocklist,
  InviteAllowlist,
  StickyEvent,
  RoomSummary,
  RoomSummaryMember,
  RoomSummaryStats
} from './SynapseRustExtensionsService'

export { matrixBurnAfterReadService } from './messaging/MatrixBurnAfterReadService'
export type { BurnSettings, BurnPendingEvent, BurnMessageResponse } from './messaging/MatrixBurnAfterReadService'

// Beacon 服务
export { matrixBeaconService } from './media/MatrixBeaconService'
export type {
  BeaconInfo,
  BeaconLocation,
  CreateBeaconParams,
  UpdateBeaconLocationParams
} from './media/MatrixBeaconService'

// Location 服务
export { matrixLocationService } from './media/MatrixLocationService'
export type { LocationData, LiveLocationShare } from './media/MatrixLocationService'

// URL 预览服务
export { matrixUrlPreviewService } from './media/MatrixUrlPreviewService'
export type { UrlPreview, UrlPreviewParams } from './media/MatrixUrlPreviewService'
export { simplifyUrl, getDomain } from './media/MatrixUrlPreviewService'

// Device 服务
export { matrixDeviceService, initializeDeviceService } from './MatrixDeviceService'
export type {
  Device,
  DevicesResponse,
  DeviceDetailResponse,
  DeviceUpdateResponse,
  DeviceListUpdatesResponse,
  DeviceListUpdatesRequest
} from './MatrixDeviceService'

// Key Backup 服务
export { matrixKeyBackupService, initializeKeyBackupService } from './crypto/MatrixKeyBackupService'
export type {
  BackupVersionInfo,
  BackupVersion,
  RoomKeyBackup,
  RecoveryProgress,
  BatchRecoverResult,
  ExportResult,
  ImportResult,
  VerifyResult
} from './crypto/MatrixKeyBackupService'

// Presence 服务
export { matrixPresenceService, initializePresenceService } from './MatrixPresenceService'
export type { PresenceState, PresenceInfo, PresenceListResponse } from './MatrixPresenceService'

// Verification 服务
export { matrixVerificationService, initializeVerificationService } from './crypto/MatrixVerificationService'
export type {
  VerificationMethod,
  VerificationRequest,
  SasVerification,
  VerificationState,
  VerificationCancelReason
} from './crypto/MatrixVerificationService'

// Room Summary 服务
export { matrixRoomSummaryService, initializeRoomSummaryService } from './MatrixRoomSummaryService'
export type {
  MatrixRoomSummaryInfo,
  MatrixRoomStats,
  MatrixRoomMemberInfo
} from './MatrixRoomSummaryService'

export { matrixThreadService } from './messaging/MatrixThreadService'
export type { Thread, ThreadMessage } from './messaging/MatrixThreadService'

export { matrixWidgetService } from './widget/MatrixWidgetService'
export type { Widget } from './widget/MatrixWidgetService'

export { MatrixRequestHelper } from './MatrixRequestHelper'
export type { RequestOptions } from './MatrixRequestHelper'
export { MatrixCacheManager, createCachedFetcher } from './MatrixCacheManager'
export { MatrixRequestDeduper, createDedupedFetcher } from './MatrixRequestDeduper'

export { adminService } from './admin/MatrixAdminService'
export { matrixApplicationService } from './MatrixApplicationService'
export { matrixDehydratedDeviceService } from './crypto/MatrixDehydratedDeviceService'
export { matrixDirectMessageService } from './MatrixDirectMessageService'
export type { CreateDmOptions, DmRoomInfo, IDirectRoomsMap } from './MatrixDirectMessageService'
export { matrixFederationBlacklistService } from './admin/MatrixFederationBlacklistService'
export { matrixMessageAdapter } from './messaging/MatrixMessageAdapter'
export { matrixMultimediaService } from './media/MatrixMultimediaService'
export { matrixNotificationService } from './notifications/MatrixNotificationService'
export { profileService } from './MatrixProfileService'
export { reportService } from './admin/MatrixReportService'
export { retentionService } from './admin/MatrixRetentionService'
export { matrixRoomStoreAdapter } from './MatrixRoomStoreAdapter'
export { matrixServerNotificationService } from './notifications/MatrixServerNotificationService'
export { MatrixSlidingSyncService } from './sync/MatrixSlidingSyncService'
export { syncService } from './sync/MatrixSyncService'
export { matrixTypingService } from './MatrixTypingService'
export { userDirectoryService } from './MatrixUserDirectoryService'
export { matrixVoiceService } from './media/MatrixVoiceService'

// ============================================================
// SDK re-exports: single choke-point for components and stores.
// Components/stores MUST NOT import from 'matrix-js-sdk' directly;
// import from '@/services/matrix' instead.
// ============================================================
export { EventType, Preset, Direction } from 'matrix-js-sdk'
export type { RoomMember, PushRuleKind } from 'matrix-js-sdk'
