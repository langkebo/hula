export { adminService, useAdmin } from './AdminFacadeService'
export type {
  FederationBlacklistEntry,
  FederationDestination,
  RateLimit,
  RegistrationToken,
  RoomInfo,
  RoomState,
  ServerHealth,
  ServerInfo,
  ServerNoticeInfo,
  ServerNoticeResult,
  ServerStats,
  ServerStatus,
  ServerVersion,
  ShadowBanStatus,
  ShutdownRoomResult,
  UserDevice,
  UserInfo
} from './AdminTypes'
export { matrixAdminService } from './MatrixAdminService'
export { matrixFederationBlacklistService } from './MatrixFederationBlacklistService'
export type { QuotaAlert, QuotaStats, QuotaStatus } from './MatrixQuotaService'
export { matrixQuotaService } from './MatrixQuotaService'
