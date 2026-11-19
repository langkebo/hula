// ⚠️ 由 scripts/gen-fixtures-from-sdk.mjs 生成，请勿手改。
// 结构真值来自 SDK 的 .d.ts；`satisfies` 保证与 SDK 类型不漂移。
import type * as T from 'matrix-js-sdk/admin'

/** `sub-managers/admin-push-manager` 的 `PushConfigResponse` */
export const PushConfigResponseFixture = {
  config: {},
  initialized_providers: []
} satisfies T.PushConfigResponse

/** `sub-managers/admin-push-manager` 的 `PushConfigUpdateResponse` */
export const PushConfigUpdateResponseFixture = {
  config: {},
  initialized_providers: []
} satisfies T.PushConfigUpdateResponse

/** `sub-managers/admin-push-manager` 的 `PushConfigPatchRequest` */
export const PushConfigPatchRequestFixture = {
  config: {}
} satisfies T.PushConfigPatchRequest

/** `sub-managers/admin-push-manager` 的 `PushProcessQueueResponse` */
export const PushProcessQueueResponseFixture = {
  processed: 0,
  message: 'x'
} satisfies T.PushProcessQueueResponse

/** `sub-managers/admin-push-manager` 的 `PushCleanupLogsResponse` */
export const PushCleanupLogsResponseFixture = {
  cleaned: 0,
  message: 'x'
} satisfies T.PushCleanupLogsResponse
