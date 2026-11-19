// ⚠️ 由 scripts/gen-fixtures-from-sdk.mjs 生成，请勿手改。
// 结构真值来自 SDK 的 .d.ts；`satisfies` 保证与 SDK 类型不漂移。
import type * as T from 'matrix-js-sdk/admin'

/** `sub-managers/admin-cleanup-manager` 的 `CleanupAllRequest` */
export const CleanupAllRequestFixture = {} satisfies T.CleanupAllRequest

/** `sub-managers/admin-cleanup-manager` 的 `CleanupAbnormalDataResult` */
export const CleanupAbnormalDataResultFixture = {
  deleted_events_in_empty_rooms: 0,
  deleted_empty_rooms: 0
} satisfies T.CleanupAbnormalDataResult

/** `sub-managers/admin-cleanup-manager` 的 `CleanupAllResponse` */
export const CleanupAllResponseFixture = {
  rooms: {
    deleted_events_in_empty_rooms: 0,
    deleted_empty_rooms: 0
  },
  tokens: {
    access_tokens_deleted: 0,
    refresh_tokens_deleted: 0,
    registration_tokens_deleted: 0,
    email_tokens_deleted: 0
  }
} satisfies T.CleanupAllResponse

/** `sub-managers/admin-cleanup-manager` 的 `CleanupRoomsRequest` */
export const CleanupRoomsRequestFixture = {} satisfies T.CleanupRoomsRequest

/** `sub-managers/admin-cleanup-manager` 的 `CleanupTokensResponse` */
export const CleanupTokensResponseFixture = {
  access_tokens_deleted: 0,
  refresh_tokens_deleted: 0
} satisfies T.CleanupTokensResponse
