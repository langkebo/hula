// ⚠️ 由 scripts/gen-fixtures-from-sdk.mjs 生成，请勿手改。
// 结构真值来自 SDK 的 .d.ts；`satisfies` 保证与 SDK 类型不漂移。
import type * as T from 'matrix-js-sdk/admin'

/** `sub-managers/admin-external-service-manager` 的 `BackendExternalService` */
export const BackendExternalServiceFixture = {
  as_id: 'x',
  service_type: 'x',
  service_id: 'x',
  display_name: 'x',
  is_enabled: false,
  is_healthy: false,
  created_ts: 0
} satisfies T.BackendExternalService

/** `sub-managers/admin-external-service-manager` 的 `BackendExternalServiceHealth` */
export const BackendExternalServiceHealthFixture = {
  service_id: 'x',
  service_type: 'x',
  is_healthy: false,
  last_check_ts: 0,
  last_success_ts: 0,
  last_error: 'x',
  consecutive_failures: 0
} satisfies T.BackendExternalServiceHealth

/** `sub-managers/admin-external-service-manager` 的 `RegisterExternalServicePayload` */
export const RegisterExternalServicePayloadFixture = {
  service_type: 'x',
  service_id: 'x',
  display_name: 'x'
} satisfies T.RegisterExternalServicePayload

/** `sub-managers/admin-external-service-manager` 的 `UpdateExternalServicePayload` */
export const UpdateExternalServicePayloadFixture = {} satisfies T.UpdateExternalServicePayload

/** `sub-managers/admin-external-service-manager` 的 `HealthCheckResult` */
export const HealthCheckResultFixture = {
  as_id: 'x',
  is_healthy: false
} satisfies T.HealthCheckResult
