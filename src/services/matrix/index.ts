export {
  matrixClientService,
  type ConnectionState,
  type MatrixClientConfig,
  type LoginResult
} from './MatrixClientService'
export { matrixRoomService } from './MatrixRoomService'
export { matrixEventService, type SendMessageOptions } from './MatrixEventService'
export { matrixCryptoService, type DeviceInfo, type VerificationStatus } from './MatrixCryptoService'
export { matrixMediaService, type UploadResult, type MediaInfo } from './MatrixMediaService'
export { matrixAccountService } from './MatrixAccountService'
export { matrixReactionService, type ReactionInfo } from './MatrixReactionService'
export { matrixForwardService, type ForwardTarget, type ForwardResult } from './MatrixForwardService'
export { matrixSearchService, type SearchResult, type RoomSearchResult } from './MatrixSearchService'
export { matrixReceiptService, type ReadReceipt } from './MatrixReceiptService'
export { matrixTypingService, type TypingUser } from './MatrixTypingService'
export {
  matrixMessageRelationService,
  type MessageEdit,
  type ReplyChain,
  type ThreadInfo
} from './MatrixMessageRelationService'
export { matrixThreadService, type Thread, type ThreadMessage } from './MatrixThreadService'
export {
  matrixEncryptionService,
  type EncryptionSettings,
  type CrossSigningInfo,
  type KeyBackupInfo,
  type VerificationRequest
} from './MatrixEncryptionService'
export {
  matrixMultimediaService,
  type VoiceMessageConfig,
  type RecordingState,
  type MediaDownload,
  type ImageThumbnail
} from './MatrixMultimediaService'
export {
  matrixSpaceService,
  type Space,
  type SpaceChild,
  type SpaceHierarchy,
  type CreateSpaceOptions,
  type AddChildOptions
} from './MatrixSpaceService'
export {
  matrixVoIPService,
  type CallInfo,
  type CallParticipant,
  type CallState,
  type CallOptions,
  type CallStats
} from './MatrixVoIPService'
export {
  matrixNotificationService,
  type NotificationConfig,
  type PushRule,
  type NotificationAction
} from './MatrixNotificationService'
export { matrixLocationService, type LocationData, type LiveLocationShare } from './MatrixLocationService'
export { matrixPollService, type PollOption, type PollData } from './MatrixPollService'
export {
  matrixFriendService,
  type Friend,
  type FriendRequest,
  type FriendStatus,
  type FriendSyncState
} from './MatrixFriendService'
export {
  matrixDirectMessageService,
  type CreateDmOptions,
  type DmRoomInfo,
  type IDirectRoomsMap
} from './MatrixDirectMessageService'
export {
  matrixVoiceService,
  type VoiceConfig,
  type VoiceMessageUploadParams,
  type VoiceMessageUploadResult,
  type VoiceMessage,
  type VoiceMessageInfo,
  type VoiceStats,
  type VoiceConvertParams,
  type VoiceConvertResult,
  type VoiceOptimizeParams,
  type VoiceOptimizeResult,
  type VoiceTranscriptionParams,
  type VoiceTranscriptionResult,
  type VoiceUploadProgress
} from './MatrixVoiceService'
export {
  matrixModerationService,
  type Report,
  type ReportFilters,
  type UserReputation,
  type ContentFilter,
  type CreateContentFilterRequest,
  type ResolveReportRequest
} from './MatrixModerationService'
export { matrixPushService } from './MatrixPushService'
export {
  matrixQuotaService,
  type QuotaStatus,
  type QuotaStats,
  type QuotaAlert,
  type QuotaConfig,
  type ServerQuota
} from './MatrixQuotaService'

// 新增服务导出
export { profileService, useProfile, type UserProfile } from './MatrixProfileService'
export { userDirectoryService, useUserDirectory, type UserDirectorySearchResult } from './MatrixUserDirectoryService'
export { retentionService, useRetention, type RetentionPolicy, type RoomRetention } from './MatrixRetentionService'
export { reportService, useReport, ReportReason, type ReportRequest } from './MatrixReportService'
export { syncService, useSync, type SyncOptions, type SyncState } from './MatrixSyncService'
export { matrixOidcService } from './MatrixOidcService'
export { matrixWidgetService, type Widget } from './MatrixWidgetService'

// Synapse Rust 扩展服务
export {
  synapseRustExtensionsService,
  type SynapseFriendInfo,
  type SynapseFriendRequest,
  type SynapsePendingRequests,
  type SynapseCreateDmResult,
  type SynapseDmInfo,
  type SynapseCheckFriendshipResult,
  type SynapseFriendNoteResult
} from './SynapseRustExtensionsService'
