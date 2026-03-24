import { MatrixAuthService } from './MatrixAuthService'
export { matrixClientService } from './MatrixClientService'
export type { ConnectionState, MatrixClientConfig } from './MatrixClientService'
export { MatrixAuthService } from './MatrixAuthService'
export const matrixAuthService = new MatrixAuthService()
export { matrixAccountService } from './MatrixAccountService'
export { matrixRoomService } from './MatrixRoomService'
export { matrixEventService } from './MatrixEventService'
export type {
  MatrixLoginResult,
  MatrixRegisterResult,
  MatrixEmailTokenResult,
  MatrixCaptchaResult,
  MatrixLoginRequest,
  MatrixRegisterRequest,
  MatrixEmailTokenRequest,
  MatrixSubmitTokenRequest,
  MatrixForgetPasswordRequest,
  MatrixResetPasswordRequest
} from './MatrixAuthService'

export { matrixMessageService } from './MatrixMessageService'
export type { MessageSearchOptions, MessageReaction, MarkedMessage } from './MatrixMessageService'

export { matrixContactService } from './MatrixContactService'
export type { UserProfile, DirectChatResult } from './MatrixContactService'

export { matrixFriendService } from './MatrixFriendService'

export { matrixGroupService } from './MatrixGroupService'
export type { CreateRoomOptions, RoomPowerLevels } from './MatrixGroupService'

export { matrixMessageRelationService } from './MatrixMessageRelationService'
export { matrixReactionService } from './MatrixReactionService'
export { matrixMediaService } from './MatrixMediaService'
export { matrixCryptoService } from './MatrixCryptoService'
export { matrixEncryptionService } from './MatrixEncryptionService'
export { matrixSearchService } from './MatrixSearchService'
export { matrixSpaceService, type Space, type SpaceChild } from './MatrixSpaceService'
export { matrixPushService } from './MatrixPushService'
export { matrixVoIPService } from './MatrixVoIPService'
export { matrixForwardService } from './MatrixForwardService'

export { matrixSessionService } from './MatrixSessionService'
export type { SessionInfo, SessionDetail } from './MatrixSessionService'

export { matrixOidcService } from './MatrixOidcService'
export type {
  OidcDiscoveryDocument,
  OidcUserInfo,
  OidcAuthorizationUrlParams,
  OidcTokenResponse
} from './MatrixOidcService'

export { matrixAIService } from './MatrixAIService'
export type {
  AIConversation,
  AIMessage,
  ImageGenerationRequest,
  ImageGenerationResult,
  StreamCallbacks
} from './MatrixAIService'

export { matrixApiKeyService } from './MatrixApiKeyService'
export type { ApiKey, Platform } from './MatrixApiKeyService'

export { matrixChatRoleService } from './MatrixChatRoleService'
export type { ChatRole } from './MatrixChatRoleService'

export { matrixConversationService } from './MatrixConversationService'
export type { Conversation, Message } from './MatrixConversationService'

export { matrixModelService } from './MatrixModelService'
export type { AIModel } from './MatrixModelService'

export * from './MatrixQrLoginService'
export { matrixAnnouncementService } from './MatrixAnnouncementService'
export type {
  Announcement,
  AnnouncementContent,
  AnnouncementCreateOptions,
  AnnouncementUpdateOptions
} from './MatrixAnnouncementService'

export { matrixEmojiService } from './MatrixEmojiService'
export type { EmojiPack, EmojiItem } from './MatrixEmojiService'

export { matrixReceiptService } from './MatrixReceiptService'
export { matrixModerationService } from './MatrixModerationService'
export { matrixQuotaService } from './MatrixQuotaService'
export type { QuotaStatus, QuotaStats, QuotaAlert } from './MatrixQuotaService'

export { matrixSpecialFriendService } from './MatrixSpecialFriendService'

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

// Beacon 服务
export { matrixBeaconService } from './MatrixBeaconService'
export type {
  BeaconInfo,
  BeaconLocation,
  CreateBeaconParams,
  UpdateBeaconLocationParams
} from './MatrixBeaconService'

// URL 预览服务
export { matrixUrlPreviewService } from './MatrixUrlPreviewService'
export type { UrlPreview, UrlPreviewParams } from './MatrixUrlPreviewService'
export { simplifyUrl, getDomain } from './MatrixUrlPreviewService'
