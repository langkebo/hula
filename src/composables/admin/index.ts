/**
 * Admin composables — business logic for the admin surface, shared by
 * desktop (`src/views/admin/**`) and mobile (`src/mobile/views/admin/**`).
 *
 * Goal: views are declarative and render-only; all fetching, mutation
 * orchestration, and state management live here so multi-platform parity
 * is structural rather than copy-pasted.
 */
export { useAdminUsers } from './useAdminUsers'
export type { UseAdminUsersResult } from './useAdminUsers'

export { useAdminRooms } from './useAdminRooms'
export type { UseAdminRoomsResult } from './useAdminRooms'

export { useAdminFederation } from './useAdminFederation'
export type { UseAdminFederationResult, FederationBlacklistView } from './useAdminFederation'

export { useAdminRetention } from './useAdminRetention'
export type { UseAdminRetentionResult, RetentionPolicyView } from './useAdminRetention'

export { useAdminRegistrationTokens } from './useAdminRegistrationTokens'
export type { UseAdminRegistrationTokensResult } from './useAdminRegistrationTokens'

export { useAdminMaintenance } from './useAdminMaintenance'
export type { UseAdminMaintenanceResult } from './useAdminMaintenance'

export { useAdminAudit } from './useAdminAudit'
export type { UseAdminAuditResult, AuditEntryView } from './useAdminAudit'

export { useAdminNotices } from './useAdminNotices'
export type { UseAdminNoticesResult } from './useAdminNotices'

export { useAdminSaml } from './useAdminSaml'
export type { UseAdminSamlResult } from './useAdminSaml'

export { useAdminSecurity } from './useAdminSecurity'
export type { UseAdminSecurityResult } from './useAdminSecurity'

export { useAdminServerLogs } from './useAdminServerLogs'
export type { UseAdminServerLogsResult, LogLevel } from './useAdminServerLogs'
