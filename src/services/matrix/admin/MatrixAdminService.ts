/**
 * Historical compatibility shim.
 *
 * Prefer importing from `@/services/matrix` or `@/services/matrix/admin`.
 */
export { adminService, useAdmin } from './AdminFacadeService'
export type {
  ServerStats,
  ServerStatus,
  ServerHealth,
  ServerInfo,
  ServerVersion,
  UserInfo,
  UserDevice,
  RateLimit,
  ShadowBanStatus,
  RoomInfo,
  RoomState,
  ShutdownRoomResult,
  FederationDestination,
  FederationBlacklistEntry,
  ServerNoticeResult,
  ServerNoticeInfo,
  RegistrationToken
} from './AdminTypes'
export { default } from './AdminFacadeService'
