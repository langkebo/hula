/** 媒体管理响应类型（与 SDK admin 媒体接口同形，供页面层直接引用）。 */
export type {
  GlobalMediaQuarantineChangesResponse,
  MediaInfo,
  MediaPage,
  MediaProtectionResponse,
  MediaQuarantineChangesResponse,
  MediaUnprotectionResponse,
  RoomMediaPage,
  RoomMediaQuarantineResponse,
  RoomMediaUnquarantineResponse,
  UserMediaList,
  UserMediaQuarantineResponse
} from '@/services/matrix/sdk'
export { adminService } from './AdminFacadeService'
export type {
  ContentFilter,
  CreateContentFilterRequest,
  FederationBlacklistEntry,
  FederationDestination,
  QuotaAlert,
  QuotaStats,
  QuotaStatus,
  RegistrationToken,
  Report,
  ReportFilters,
  RoomInfo,
  ServerHealth,
  ServerStats,
  ServerStatus,
  ServerVersion,
  UserInfo,
  UserReputation
} from './AdminTypes'
