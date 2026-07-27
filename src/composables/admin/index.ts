/**
 * Admin composables — business logic for the admin surface, shared by
 * desktop (`src/views/admin/**`) and mobile (`src/mobile/views/admin/**`).
 *
 * Goal: views are declarative and render-only; all fetching, mutation
 * orchestration, and state management live here so multi-platform parity
 * is structural rather than copy-pasted.
 */

export type { AppServiceInfo } from './useAdminAppServices'
export { useAdminAppServices } from './useAdminAppServices'
export type { AuditEntryView } from './useAdminAudit'
export { useAdminAudit } from './useAdminAudit'
export type { FederationBlacklistView, FederationDestination } from './useAdminFederation'
export { useAdminFederation } from './useAdminFederation'
export type { AdminFeatureFlag, AdminFeatureFlagInput } from './useAdminMaintenance'
export { useAdminMaintenance } from './useAdminMaintenance'
export type { ServerNoticeInfo } from './useAdminNotices'
export { useAdminNotices } from './useAdminNotices'

export { useAdminNotifications } from './useAdminNotifications'
export type { RegistrationToken } from './useAdminRegistrationTokens'
export { useAdminRegistrationTokens } from './useAdminRegistrationTokens'
export type { RetentionPolicyView } from './useAdminRetention'
export { useAdminRetention } from './useAdminRetention'
export type { RoomInfo } from './useAdminRooms'
export { useAdminRooms } from './useAdminRooms'

export { useAdminSaml } from './useAdminSaml'

export { useAdminSecurity } from './useAdminSecurity'

export { useAdminServerLogs } from './useAdminServerLogs'
export type { SpaceInfo, SpaceStats } from './useAdminSpaces'
export { useAdminSpaces } from './useAdminSpaces'
export type { UserDevice, UserInfo, UserSession } from './useAdminUsers'
export { useAdminUsers } from './useAdminUsers'
