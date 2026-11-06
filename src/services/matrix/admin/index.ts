/** 媒体管理响应类型（与 SDK admin 媒体接口同形，供页面层直接引用）。 */
export type { MediaInfo } from '@/services/matrix/sdk'
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
  UserReputation
} from './AdminTypes'
