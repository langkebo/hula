/**
 * Admin composables — business logic for the admin surface, used by
 * desktop (`src/views/admin/**`) only.
 *
 * Goal: views are declarative and render-only; all fetching, mutation
 * orchestration, and state management live here so the desktop admin
 * surface stays structural rather than copy-pasted.
 */

export type { PasswordAuthProviderDraft } from './useAdminAccountPolicy'
export { useAdminAccountPolicy } from './useAdminAccountPolicy'
export type { AppServiceInfo } from './useAdminAppServices'
export { useAdminAppServices } from './useAdminAppServices'
export type { AuditEntryView } from './useAdminAudit'
export { useAdminAudit } from './useAdminAudit'
export { useAdminBackgroundUpdates } from './useAdminBackgroundUpdates'
export type { AccountDataCallbackDraft, MediaCallbackDraft } from './useAdminCallbacks'
export { useAdminCallbacks } from './useAdminCallbacks'
export { useAdminCas } from './useAdminCas'
export type { CleanupKind, CleanupOutcome } from './useAdminCleanup'
export { useAdminCleanup } from './useAdminCleanup'
export type { ExternalServiceDraft } from './useAdminExternalServices'
export { useAdminExternalServices } from './useAdminExternalServices'
export type { FederationBlacklistView, FederationDestination } from './useAdminFederation'
export { useAdminFederation } from './useAdminFederation'
export { useAdminInvitePolicy } from './useAdminInvitePolicy'
export type { AdminFeatureFlag, AdminFeatureFlagInput } from './useAdminMaintenance'
export { useAdminMaintenance } from './useAdminMaintenance'
export type { MediaLibraryItem, UseAdminMedia } from './useAdminMedia'
export { useAdminMedia } from './useAdminMedia'
export type { AdminModuleItem, AdminModuleStatus } from './useAdminModules'
export { useAdminModules } from './useAdminModules'
export type { ServerNoticeInfo } from './useAdminNotices'
export { useAdminNotices } from './useAdminNotices'

export { useAdminNotifications } from './useAdminNotifications'
export { useAdminPush } from './useAdminPush'
export type { RegistrationToken } from './useAdminRegistrationTokens'
export { useAdminRegistrationTokens } from './useAdminRegistrationTokens'
export type { RetentionPolicyView } from './useAdminRetention'
export { useAdminRetention } from './useAdminRetention'
export type { RoomInfo, UseAdminRoomsResult } from './useAdminRooms'
export { useAdminRooms } from './useAdminRooms'

export { useAdminServerLogs } from './useAdminServerLogs'
export type { SystemNotificationDraft } from './useAdminServerNotifications'
export { useAdminServerNotifications } from './useAdminServerNotifications'
export type { SpaceInfo } from './useAdminSpaces'
export { useAdminSpaces } from './useAdminSpaces'
export { useAdminTelemetry } from './useAdminTelemetry'
export type { BatchCreateUserInput } from './useAdminUserGovernance'
export type { UseAdminUsersResult, UserDevice, UserInfo, UserSession } from './useAdminUsers'
export { useAdminUsers } from './useAdminUsers'
