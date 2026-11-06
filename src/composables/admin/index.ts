/**
 * Admin composables — business logic for the admin surface, used by
 * desktop (`src/views/admin/**`) only.
 *
 * Goal: views are declarative and render-only; all fetching, mutation
 * orchestration, and state management live here so the desktop admin
 * surface stays structural rather than copy-pasted.
 */

export type { AppServiceInfo } from './useAdminAppServices'
export { useAdminAppServices } from './useAdminAppServices'
export type { AuditEntryView } from './useAdminAudit'
export { useAdminAudit } from './useAdminAudit'
export { useAdminBackgroundUpdates } from './useAdminBackgroundUpdates'
export type { FederationBlacklistView, FederationDestination } from './useAdminFederation'
export { useAdminFederation } from './useAdminFederation'
export type { AdminFeatureFlag, AdminFeatureFlagInput } from './useAdminMaintenance'
export { useAdminMaintenance } from './useAdminMaintenance'
export type { MediaLibraryItem, UseAdminMedia } from './useAdminMedia'
export { useAdminMedia } from './useAdminMedia'
export type { ServerNoticeInfo } from './useAdminNotices'
export { useAdminNotices } from './useAdminNotices'

export { useAdminNotifications } from './useAdminNotifications'
export type { RegistrationToken } from './useAdminRegistrationTokens'
export { useAdminRegistrationTokens } from './useAdminRegistrationTokens'
export type { RetentionPolicyView } from './useAdminRetention'
export { useAdminRetention } from './useAdminRetention'
export type { RoomInfo } from './useAdminRooms'
export { useAdminRooms } from './useAdminRooms'

export { useAdminServerLogs } from './useAdminServerLogs'
export type { SpaceInfo } from './useAdminSpaces'
export { useAdminSpaces } from './useAdminSpaces'
export { useAdminTelemetry } from './useAdminTelemetry'
export type { UseAdminUsersResult, UserDevice, UserInfo, UserSession } from './useAdminUsers'
export { useAdminUsers } from './useAdminUsers'
