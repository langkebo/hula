// ⚠️ 由 scripts/gen-fixtures-from-sdk.mjs 生成，请勿手改。
// 结构真值来自 SDK 的 .d.ts；`satisfies` 保证与 SDK 类型不漂移。
import type * as T from 'matrix-js-sdk/admin'

/** `sub-managers/admin-config-types` 的 `FeatureFlagUpdatePayload` */
export const FeatureFlagUpdatePayloadFixture = {} satisfies T.FeatureFlagUpdatePayload

/** `sub-managers/admin-config-types` 的 `AuditEventCreateRequest` */
export const AuditEventCreateRequestFixture = {
  actor_id: 'x',
  action: 'x',
  resource_type: 'x',
  resource_id: 'x',
  result: 'x',
  request_id: 'x'
} satisfies T.AuditEventCreateRequest

/** `sub-managers/admin-config-types` 的 `AccountValidityRequest` */
export const AccountValidityRequestFixture = {
  user_id: 'x',
  expiration_ts: 0
} satisfies T.AccountValidityRequest

/** `sub-managers/admin-config-types` 的 `AccountValidityRenewRequest` */
export const AccountValidityRenewRequestFixture = {
  renewal_token: 'x',
  new_expiration_ts: 0
} satisfies T.AccountValidityRenewRequest

/** `sub-managers/admin-config-types` 的 `CreatePasswordAuthProviderRequest` */
export const CreatePasswordAuthProviderRequestFixture = {
  provider_name: 'x',
  provider_type: 'x',
  config: {}
} satisfies T.CreatePasswordAuthProviderRequest

/** `sub-managers/admin-config-types` 的 `CreateMediaCallbackRequest` */
export const CreateMediaCallbackRequestFixture = {
  callback_name: 'x',
  callback_type: 'x',
  url: 'x'
} satisfies T.CreateMediaCallbackRequest

/** `sub-managers/admin-config-types` 的 `CreateAccountDataCallbackRequest` */
export const CreateAccountDataCallbackRequestFixture = {
  callback_name: 'x',
  config: {}
} satisfies T.CreateAccountDataCallbackRequest

/** `sub-managers/admin-config-types` 的 `RetentionPolicy` */
export const RetentionPolicyFixture = {
  max_lifetime: 0,
  min_lifetime: 0,
  is_expire_on_clients: false
} satisfies T.RetentionPolicy

/** `sub-managers/admin-config-types` 的 `RoomRetentionPolicy` */
export const RoomRetentionPolicyFixture = {
  room_id: 'x',
  max_lifetime: 0,
  min_lifetime: 0,
  is_expire_on_clients: false
} satisfies T.RoomRetentionPolicy

/** `sub-managers/admin-config-types` 的 `RetentionRunResult` */
export const RetentionRunResultFixture = {
  started: false
} satisfies T.RetentionRunResult

/** `sub-managers/admin-config-types` 的 `RetentionStatus` */
export const RetentionStatusFixture = {
  server_policy_enabled: false,
  rooms_with_custom_policy: 0,
  lifecycle_cleanup_enabled: false,
  audit_retention_days: 0,
  last_run: {
    started_ts: 0,
    completed_ts: 0,
    duration_ms: 0,
    expired_events_deleted: 0,
    expired_beacons_deleted: 0,
    expired_uploads_deleted: 0,
    expired_audit_events_deleted: 0,
    failed_tasks: 0
  }
} satisfies T.RetentionStatus

/** `sub-managers/admin-config-types` 的 `AuditEvent` */
export const AuditEventFixture = {
  event_id: 'x',
  actor_id: 'x',
  action: 'x',
  resource_type: 'x',
  resource_id: 'x',
  result: 'x',
  request_id: 'x',
  created_ts: 0
} satisfies T.AuditEvent

/** `sub-managers/admin-config-types` 的 `AuditEventPage` */
export const AuditEventPageFixture = {
  events: [],
  total: 0,
  next_batch: 'x'
} satisfies T.AuditEventPage

/** `sub-managers/admin-config-types` 的 `FeatureFlagTarget` */
export const FeatureFlagTargetFixture = {
  subject_type: 'x',
  subject_id: 'x'
} satisfies T.FeatureFlagTarget

/** `sub-managers/admin-config-types` 的 `FeatureFlag` */
export const FeatureFlagFixture = {
  flag_key: 'x',
  target_scope: 'x',
  rollout_percent: 0,
  expires_at: 0,
  reason: 'x',
  status: 'x',
  created_by: 'x',
  created_ts: 0,
  updated_ts: 0,
  targets: []
} satisfies T.FeatureFlag

/** `sub-managers/admin-config-types` 的 `FeatureFlagQuery` */
export const FeatureFlagQueryFixture = {} satisfies T.FeatureFlagQuery

/** `sub-managers/admin-config-types` 的 `AuditEventQuery` */
export const AuditEventQueryFixture = {} satisfies T.AuditEventQuery

/** `sub-managers/admin-config-types` 的 `FeatureFlagPage` */
export const FeatureFlagPageFixture = {
  flags: [],
  total: 0
} satisfies T.FeatureFlagPage

/** `sub-managers/admin-config-types` 的 `RegistrationToken` */
export const RegistrationTokenFixture = {
  token: 'x'
} satisfies T.RegistrationToken

/** `sub-managers/admin-config-types` 的 `RegistrationTokenPage` */
export const RegistrationTokenPageFixture = {
  registration_tokens: []
} satisfies T.RegistrationTokenPage

/** `sub-managers/admin-config-types` 的 `RegistrationTokenRequest` */
export const RegistrationTokenRequestFixture = {} satisfies T.RegistrationTokenRequest

/** `sub-managers/admin-config-types` 的 `AdminModuleInfo` */
export const AdminModuleInfoFixture = {
  id: 0,
  module_name: 'x',
  module_type: 'x',
  version: 'x',
  description: 'x',
  is_enabled: false,
  priority: 0,
  config: {},
  created_ts: 0,
  updated_ts: 0,
  last_executed_ts: 0,
  execution_count: 0,
  error_count: 0,
  last_error: 'x'
} satisfies T.AdminModuleInfo

/** `sub-managers/admin-config-types` 的 `AdminModulePage` */
export const AdminModulePageFixture = {
  modules: []
} satisfies T.AdminModulePage

/** `sub-managers/admin-config-types` 的 `AdminModuleLog` */
export const AdminModuleLogFixture = {
  id: 0,
  module_name: 'x',
  module_type: 'x',
  event_id: 'x',
  room_id: 'x',
  execution_time_ms: 0,
  is_success: false,
  error_message: 'x',
  metadata: {},
  executed_ts: 0
} satisfies T.AdminModuleLog

/** `sub-managers/admin-config-types` 的 `AdminAccountValidityInfo` */
export const AdminAccountValidityInfoFixture = {
  user_id: 'x',
  expiration_ts: 0,
  last_check_at: 0,
  renewal_token: 'x',
  is_valid: false,
  created_ts: 0,
  updated_ts: 0
} satisfies T.AdminAccountValidityInfo

/** `sub-managers/admin-config-types` 的 `AdminPasswordAuthProvider` */
export const AdminPasswordAuthProviderFixture = {
  id: 0,
  provider_name: 'x',
  provider_type: 'x',
  config: {},
  is_enabled: false,
  priority: 0,
  created_ts: 0,
  updated_ts: 0
} satisfies T.AdminPasswordAuthProvider

/** `sub-managers/admin-config-types` 的 `AdminAccountDataCallback` */
export const AdminAccountDataCallbackFixture = {
  id: 0,
  callback_name: 'x',
  is_enabled: false,
  data_types: [],
  config: {},
  created_ts: 0
} satisfies T.AdminAccountDataCallback

/** `sub-managers/admin-config-types` 的 `AdminInviteAllowlist` */
export const AdminInviteAllowlistFixture = {
  allowlist: [],
  limit: 0,
  offset: 0,
  total_count: 0
} satisfies T.AdminInviteAllowlist

/** `sub-managers/admin-config-types` 的 `AdminInviteBlocklist` */
export const AdminInviteBlocklistFixture = {
  blocklist: [],
  limit: 0,
  offset: 0,
  total_count: 0
} satisfies T.AdminInviteBlocklist

/** `sub-managers/admin-config-types` 的 `AdminInviteListWriteResult` */
export const AdminInviteListWriteResultFixture = {
  status: 'x',
  action: 'x'
} satisfies T.AdminInviteListWriteResult

/** `sub-managers/admin-config-types` 的 `AdminInviteListAddResult` */
export const AdminInviteListAddResultFixture = {
  status: 'x',
  action: 'add_global_invite_blocklist_user',
  user_id: 'x',
  already_present: false,
  removed_from_other_list: false
} satisfies T.AdminInviteListAddResult

/** `sub-managers/admin-config-types` 的 `AdminInviteListRemoveResult` */
export const AdminInviteListRemoveResultFixture = {
  status: 'x',
  action: 'remove_global_invite_blocklist_user',
  user_id: 'x',
  already_absent: false
} satisfies T.AdminInviteListRemoveResult

/** `sub-managers/admin-config-types` 的 `AdminJitsiConfig` */
export const AdminJitsiConfigFixture = {
  domain: 'x',
  app_id: 'x',
  jwt_enabled: false,
  jwt_asap_enabled: false,
  jwt_auth_type: 'x',
  server_name: 'x'
} satisfies T.AdminJitsiConfig

/** `sub-managers/admin-config-types` 的 `SamlMapping` */
export const SamlMappingFixture = {
  name_id: 'x'
} satisfies T.SamlMapping

/** `sub-managers/admin-config-types` 的 `SamlMappingPage` */
export const SamlMappingPageFixture = {
  mappings: []
} satisfies T.SamlMappingPage

/** `sub-managers/admin-config-types` 的 `SamlMetadata` */
export const SamlMetadataFixture = {
  entity_id: 'x',
  sso_url: 'x'
} satisfies T.SamlMetadata

/** `sub-managers/admin-config-types` 的 `ApplicationServiceInfo` */
export const ApplicationServiceInfoFixture = {
  id: 'x'
} satisfies T.ApplicationServiceInfo

/** `sub-managers/admin-config-types` 的 `ApplicationServicePage` */
export const ApplicationServicePageFixture = {
  services: []
} satisfies T.ApplicationServicePage

/** `sub-managers/admin-config-types` 的 `ApplicationServicePingResult` */
export const ApplicationServicePingResultFixture = {
  ok: false
} satisfies T.ApplicationServicePingResult

/** `sub-managers/admin-config-types` 的 `ThirdPartyRuleCheckPayload` */
export const ThirdPartyRuleCheckPayloadFixture = {
  event_id: 'x',
  room_id: 'x',
  sender: 'x',
  event_type: 'x',
  content: {},
  state_events: []
} satisfies T.ThirdPartyRuleCheckPayload

/** `sub-managers/admin-config-types` 的 `SpamCheckResult` */
export const SpamCheckResultFixture = {
  id: 0,
  event_id: 'x',
  room_id: 'x',
  sender: 'x',
  event_type: 'x',
  result: 'x',
  score: 0,
  checker_module: 'x',
  checked_ts: 0
} satisfies T.SpamCheckResult

/** `sub-managers/admin-config-types` 的 `ModuleSpamCheckPage` */
export const ModuleSpamCheckPageFixture = {
  checks: [],
  total: 0,
  next_batch: 'x'
} satisfies T.ModuleSpamCheckPage

/** `sub-managers/admin-config-types` 的 `ThirdPartyRuleCheckResult` */
export const ThirdPartyRuleCheckResultFixture = {} satisfies T.ThirdPartyRuleCheckResult

/** `sub-managers/admin-config-types` 的 `ThirdPartyRuleResult` */
export const ThirdPartyRuleResultFixture = {
  id: 0,
  event_id: 'x',
  room_id: 'x',
  sender: 'x',
  event_type: 'x',
  rule_name: 'x',
  allowed: false,
  checked_ts: 0
} satisfies T.ThirdPartyRuleResult
