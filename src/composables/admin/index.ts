/**
 * Admin composables — business logic for the admin surface, shared by
 * desktop (`src/views/admin/**`) and mobile (`src/mobile/views/admin/**`).
 *
 * Goal: views are declarative and render-only; all fetching, mutation
 * orchestration, and state management live here so multi-platform parity
 * is structural rather than copy-pasted.
 */

export type { AppServiceDetail, AppServiceInfo, UseAdminAppServicesResult } from './useAdminAppServices'
export { useAdminAppServices } from './useAdminAppServices'
export type { AuditEntryView, UseAdminAuditResult } from './useAdminAudit'
export { useAdminAudit } from './useAdminAudit'
export type { FederationBlacklistView, FederationDestination, UseAdminFederationResult } from './useAdminFederation'
export { useAdminFederation } from './useAdminFederation'
export type {
  AdminFeatureFlag,
  AdminFeatureFlagInput,
  AdminFeatureFlagTarget,
  UseAdminMaintenanceResult
} from './useAdminMaintenance'
export { useAdminMaintenance } from './useAdminMaintenance'
export type { ServerNoticeInfo, UseAdminNoticesResult } from './useAdminNotices'
export { useAdminNotices } from './useAdminNotices'
export type { UseAdminNotificationsResult } from './useAdminNotifications'
export { useAdminNotifications } from './useAdminNotifications'
export type { RegistrationToken, UseAdminRegistrationTokensResult } from './useAdminRegistrationTokens'
export { useAdminRegistrationTokens } from './useAdminRegistrationTokens'
export type { RetentionPolicyView, UseAdminRetentionResult } from './useAdminRetention'
export { useAdminRetention } from './useAdminRetention'
export type { RoomInfo, RoomMessage, UseAdminRoomsResult } from './useAdminRooms'
export { useAdminRooms } from './useAdminRooms'
export type { SamlMapping, UseAdminSamlResult } from './useAdminSaml'
export { useAdminSaml } from './useAdminSaml'
export type { UseAdminSecurityResult } from './useAdminSecurity'
export { useAdminSecurity } from './useAdminSecurity'
export type { UseAdminServerLogsResult } from './useAdminServerLogs'
export { useAdminServerLogs } from './useAdminServerLogs'
export type { SpaceDetail, SpaceInfo, SpaceStats, UseAdminSpacesResult } from './useAdminSpaces'
export { useAdminSpaces } from './useAdminSpaces'
export type { UseAdminUsersResult, UserDevice, UserInfo, UserSession } from './useAdminUsers'
export { useAdminUsers } from './useAdminUsers'
