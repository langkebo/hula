/** 媒体管理响应类型（与 SDK admin 媒体接口同形，供页面层直接引用）。 */
export type { MediaInfo } from '@/services/matrix/sdk'
export type {
  AccountValidityRenewRequest,
  AccountValidityRequest,
  AdminAccountValidityInfo,
  AdminPasswordAuthProvider,
  CreatePasswordAuthProviderRequest,
  PolicyCheckAction,
  PolicyCheckRequest,
  PolicyCheckResponse,
  PolicyServerStatus,
  RateLimitMetrics,
  RateLimitStatusResponse
} from './AccountPolicyService'
export {
  adminAccountValidityService,
  adminPasswordAuthProviderService,
  adminPolicyServerService,
  adminRateLimitService
} from './AccountPolicyService'
export type {
  AdminAccountDataCallback,
  AdminMediaCallback,
  CreateAccountDataCallbackRequest,
  CreateMediaCallbackRequest
} from './AdminCallbackService'
export { adminCallbackService } from './AdminCallbackService'
export type {
  CleanupAllRequest,
  CleanupAllResponse,
  CleanupRoomsRequest,
  CleanupRoomsResponse,
  CleanupTokensResponse
} from './AdminCleanupService'
export { adminCleanupService } from './AdminCleanupService'
export { adminService } from './AdminFacadeService'
export type {
  PushCleanupLogsResponse,
  PushConfigPatchRequest,
  PushConfigResponse,
  PushConfigUpdateResponse,
  PushProcessQueueResponse
} from './AdminPushService'
export { adminPushService } from './AdminPushService'
export type {
  ContentFilter,
  CreateContentFilterRequest,
  FederationBlacklistEntry,
  FederationDestination,
  QuotaAlert,
  QuotaStats,
  QuotaStatus,
  Report,
  ReportFilters,
  ServerHealth,
  ServerStats,
  ServerStatus,
  ServerVersion,
  SystemNotificationInfo,
  UserReputation
} from './AdminTypes'
export type { ExternalService, ExternalServiceHealth } from './ExternalServiceService'
export type { AdminModuleItem, AdminModuleListResult, AdminModuleStatus } from './ModuleService'
export { adminModuleService } from './ModuleService'
