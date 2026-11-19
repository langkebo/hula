// ⚠️ 由 scripts/gen-fixtures-from-sdk.mjs 生成，请勿手改。
// 结构真值来自 SDK 的 .d.ts；`satisfies` 保证与 SDK 类型不漂移。
import type * as T from 'matrix-js-sdk/admin'

/** `sub-managers/admin-federation-types` 的 `FederationBlacklistEntry` */
export const FederationBlacklistEntryFixture = {
  server_name: 'x',
  added_at: 0,
  reason: 'x'
} satisfies T.FederationBlacklistEntry

/** `sub-managers/admin-federation-types` 的 `FederationBlacklistPage` */
export const FederationBlacklistPageFixture = {
  blacklist: [],
  total: 0,
  next_batch: 'x'
} satisfies T.FederationBlacklistPage

/** `sub-managers/admin-federation-types` 的 `FederationDestination` */
export const FederationDestinationFixture = {
  destination: 'x',
  retry_last_ts: 0,
  retry_interval: 0,
  failure_ts: 0,
  last_successful_ts: 0,
  failure_count: 0,
  status: 'x',
  updated_ts: 0
} satisfies T.FederationDestination

/** `sub-managers/admin-federation-types` 的 `AdminFederationDestinationsResponse` */
export const AdminFederationDestinationsResponseFixture = {
  destinations: [],
  total: 0,
  total_count: 0,
  next_batch: 'x'
} satisfies T.AdminFederationDestinationsResponse

/** `sub-managers/admin-federation-types` 的 `AdminFederationDestinationRooms` */
export const AdminFederationDestinationRoomsFixture = {
  rooms: [],
  total: 0,
  next_batch: 'x'
} satisfies T.AdminFederationDestinationRooms

/** `sub-managers/admin-federation-types` 的 `FederationAdmissionResult` */
export const FederationAdmissionResultFixture = {
  server_name: 'x',
  status: 'x',
  previous_status: 'x',
  updated_ts: 0,
  confirmed_by: 'x'
} satisfies T.FederationAdmissionResult

/** `sub-managers/admin-federation-types` 的 `PendingFederationServer` */
export const PendingFederationServerFixture = {
  server_name: 'x',
  failure_count: 0,
  last_failed_connect_at: 0,
  last_successful_connect_at: 0,
  status: 'pending',
  updated_ts: 0
} satisfies T.PendingFederationServer

/** `sub-managers/admin-federation-types` 的 `PendingFederationList` */
export const PendingFederationListFixture = {
  servers: [],
  total: 0,
  limit: 0,
  next_batch: 'x'
} satisfies T.PendingFederationList

/** `sub-managers/admin-federation-types` 的 `AdminFederationCache` */
export const AdminFederationCacheFixture = {
  cache: [],
  total: 0
} satisfies T.AdminFederationCache

/** `sub-managers/admin-federation-types` 的 `FederationResolveResponse` */
export const FederationResolveResponseFixture = {
  server_name: 'x',
  resolved: false,
  blacklisted: false,
  in_destinations: false
} satisfies T.FederationResolveResponse

/** `sub-managers/admin-federation-types` 的 `FederationRewriteResponse` */
export const FederationRewriteResponseFixture = {
  from: 'x',
  to: 'x',
  rewritten: false,
  rooms_affected: 0
} satisfies T.FederationRewriteResponse
