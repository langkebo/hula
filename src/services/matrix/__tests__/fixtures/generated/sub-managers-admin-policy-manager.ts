// ⚠️ 由 scripts/gen-fixtures-from-sdk.mjs 生成，请勿手改。
// 结构真值来自 SDK 的 .d.ts；`satisfies` 保证与 SDK 类型不漂移。
import type * as T from 'matrix-js-sdk/admin'

/** `sub-managers/admin-policy-manager` 的 `PolicyServerStatus` */
export const PolicyServerStatusFixture = {
  enabled: false,
  endpoint: 'x',
  fail_mode: 'fail_open'
} satisfies T.PolicyServerStatus

/** `sub-managers/admin-policy-manager` 的 `PolicyCheckRequest` */
export const PolicyCheckRequestFixture = {
  room_id: 'x',
  user_id: 'x',
  action: 'create'
} satisfies T.PolicyCheckRequest

/** `sub-managers/admin-policy-manager` 的 `PolicyCheckResponse` */
export const PolicyCheckResponseFixture = {
  allowed: false,
  result: 'allow'
} satisfies T.PolicyCheckResponse
