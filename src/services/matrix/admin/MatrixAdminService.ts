/**
 * Historical compatibility shim.
 *
 * Prefer importing from `@/services/matrix` or `@/services/matrix/admin`.
 */
export { adminService, default, useAdmin } from './AdminFacadeService'
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
