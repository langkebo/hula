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
export { adminService } from './AdminFacadeService'
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
