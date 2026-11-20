/**
 * admin 联邦域测试夹具。
 *
 * 类型全部来自 SDK `matrix-js-sdk/admin` 再导出的 `admin-federation-types`（后端
 * `admin/federation.rs` 的 wire 真值）。此前测试手写的 `{ retry_last_ts: 9 }`、
 * 只有 5 个键的 destination、数组形式的黑名单均与契约不符：
 * - `FederationDestination` 8 键全必填（`failure_count` / `status` / `updated_ts` 不可省）；
 * - 黑名单返回的是响应壳 `{blacklist, total, next_batch}`，条目时间键是 `added_at`；
 * - 缓存列表键是 `cache`（不是 `entries`），条目字段是 `key/value/expiry_ts`；
 * - 待确认服务器返回 `{servers, total, limit, next_batch}`，条目 6 键。
 */
import type {
  AdminFederationCache,
  AdminFederationCacheEntry,
  FederationBlacklistEntry,
  FederationBlacklistPage,
  FederationDestination,
  PendingFederationList,
  PendingFederationServer
} from 'matrix-js-sdk/admin'

/** 单个联邦目的地（列表项与详情同形状） */
export function makeFederationDestination(overrides: Partial<FederationDestination> = {}): FederationDestination {
  return {
    destination: 'remote.hs',
    retry_last_ts: null,
    retry_interval: null,
    failure_ts: null,
    last_successful_ts: null,
    failure_count: 0,
    status: 'active',
    updated_ts: null,
    ...overrides
  }
}

/**
 * 服务层防御分支输入：真实 `FederationDestination` 8 键全必填。
 *
 * 该形状只用于验证「后端/网关漏字段」时 `mapFederationDestination` 用入参回填
 * `destination`，因此显式声明为 partial 输入，不冒充 SDK 返回类型。
 */
export function makePartialFederationDestination(
  overrides: Partial<FederationDestination> = {}
): Partial<FederationDestination> {
  return { retry_last_ts: 9, ...overrides }
}

/** 单条联邦黑名单条目 */
export function makeFederationBlacklistEntry(
  overrides: Partial<FederationBlacklistEntry> = {}
): FederationBlacklistEntry {
  return { server_name: 'evil.hs', added_at: 100, reason: 'spam', ...overrides }
}

/** `getFederationBlacklist()` 的响应壳 */
export function makeFederationBlacklistPage(overrides: Partial<FederationBlacklistPage> = {}): FederationBlacklistPage {
  return { blacklist: [], total: 0, next_batch: null, ...overrides }
}

/** 单条联邦缓存条目 */
export function makeFederationCacheEntry(
  overrides: Partial<AdminFederationCacheEntry> = {}
): AdminFederationCacheEntry {
  return { key: 'k1', value: null, expiry_ts: null, ...overrides }
}

/** `getFederationCache()` 的响应壳（列表键是 `cache`） */
export function makeFederationCache(overrides: Partial<AdminFederationCache> = {}): AdminFederationCache {
  return { cache: [], total: 0, ...overrides }
}

/** 单个待确认联邦服务器 */
export function makePendingFederationServer(overrides: Partial<PendingFederationServer> = {}): PendingFederationServer {
  return {
    server_name: 'pending.hs',
    failure_count: 0,
    last_failed_connect_at: null,
    last_successful_connect_at: null,
    status: 'pending',
    updated_ts: null,
    ...overrides
  }
}

/** `getPendingFederationServers()` 的响应壳 */
export function makePendingFederationList(overrides: Partial<PendingFederationList> = {}): PendingFederationList {
  return { servers: [], total: 0, limit: 20, next_batch: null, ...overrides }
}
