/**
 * admin composable 测试夹具（应用服务 / 审计 / SAML / 联邦 / 配额 / 功能开关）。
 *
 * 类型全部从服务层真实契约推导：
 * - 应用服务：`AdminApplicationService.getApplicationServices()` → `{ services, nextToken? }`，
 *   条目来自 `GET /_synapse/admin/v1/app_services`（`as_id` / `sender_localpart` 为 snake_case）；
 * - 审计：`AdminTypes.AdminAuditLogPage`（`{ logs, next_batch? }`），
 *   条目 wire 为 `event_id` / `actor_id` / `action` / `created_ts`；
 * - SAML：`SecurityService.SamlMetadataResponse` 与 SDK `SamlMapping`（`name_id` 必填，
 *   其余字段经索引签名透传）；
 * - 联邦：`FederationCachePage` / `PendingFederationPage` / `PendingFederationServer`；
 * - 配额：`ServerQuota`；功能开关：`SecurityService.AdminFeatureFlag`。
 *
 * 已知失真（保留原断言，不改语义）：`useAdminAudit` 把服务端 wire 直接当作
 * `AuditEntryView`（`id` / `type` / `user_id` / `timestamp`）读取，而真实响应是
 * `event_id` / `actor_id` / `action` / `created_ts`。夹具保留真实字段，并由用例
 * 显式补 view 别名，失真本身另记待办。
 */
import type {
  AdminAuditLogEntry,
  AdminAuditLogPage,
  AdminInfo,
  FederationCacheEntry,
  FederationCachePage,
  PendingFederationPage,
  PendingFederationServer,
  ServerNoticeInfo,
  ServerQuota
} from '@/services/matrix/admin/AdminTypes'
import type { AdminApplicationService, ApplicationServiceResponse } from '@/services/matrix/admin/ApplicationService'
import type { AdminFeatureFlag, SamlMetadataResponse } from '@/services/matrix/admin/SecurityService'
import type { SamlMapping } from '@/services/matrix/sdk'

type ApplicationServicesResponse = Awaited<ReturnType<AdminApplicationService['getApplicationServices']>>

/** `GET /_synapse/admin/v1/app_services` 的单条记录 */
export function makeApplicationService(overrides: ApplicationServiceResponse = {}): ApplicationServiceResponse {
  return {
    as_id: 'as1',
    url: 'https://as.example.org',
    sender_localpart: 'appservice-bot',
    is_enabled: true,
    protocols: [],
    namespaces: { users: [], rooms: [], aliases: [] },
    created_ts: 1,
    ...overrides
  }
}

/** `getApplicationServices()` 响应 */
export function makeApplicationServicesResponse(
  services: ApplicationServiceResponse[] = []
): ApplicationServicesResponse {
  return { services }
}

/** 审计日志条目（wire：`event_id` / `actor_id` / `action` / `created_ts`） */
export function makeAuditLogEntry(overrides: AdminAuditLogEntry = {}): AdminAuditLogEntry {
  return {
    event_id: '$audit:example.org',
    actor_id: '@admin:example.org',
    action: 'admin',
    resource_type: 'user',
    resource_id: '@target:example.org',
    result: 'success',
    created_ts: 1,
    ...overrides
  }
}

/** `GET /_synapse/admin/v1/audit/events` 响应壳 */
export function makeAuditLogPage(entries: AdminAuditLogEntry[] = []): AdminAuditLogPage {
  return { logs: entries }
}

/** `GET /_synapse/admin/v1/saml/metadata` 响应 */
export function makeSamlMetadata(overrides: SamlMetadataResponse = {}): SamlMetadataResponse {
  return {
    entity_id: 'https://idp.example.org/metadata',
    ...overrides
  }
}

/** `purgeMediaCache()` 响应 */
export function makePurgeMediaCacheResult(deleted = 0): { deleted: number } {
  return { deleted }
}

/** `getSamlMapping()` 响应（`name_id` 必填，`display_name` 经索引签名透传） */
export function makeSamlMapping(
  overrides: { name_id?: string; user_id?: string; display_name?: string } = {}
): SamlMapping {
  return {
    name_id: 'alice@idp',
    user_id: '@alice:example.org',
    display_name: 'Alice',
    ...overrides
  }
}

export function makeFederationCacheEntry(overrides: Partial<FederationCacheEntry> = {}): FederationCacheEntry {
  return { key: 'k1', value: 1, expiryTs: null, ...overrides }
}

/** `getFederationCache()` 响应 */
export function makeFederationCachePage(entries: FederationCacheEntry[] = []): FederationCachePage {
  return { entries, total: entries.length }
}

export function makePendingFederationServer(overrides: Partial<PendingFederationServer> = {}): PendingFederationServer {
  return {
    serverName: 'pending.example.org',
    failureCount: 2,
    lastFailedConnectAt: 1,
    lastSuccessfulConnectAt: null,
    status: 'pending',
    updatedTs: 2,
    ...overrides
  }
}

/** `getPendingFederationServers()` 响应 */
export function makePendingFederationPage(servers: PendingFederationServer[] = []): PendingFederationPage {
  return { servers, total: servers.length, limit: 20 }
}

/** `getServerQuota()` 响应 */
export function makeServerQuota(overrides: Partial<ServerQuota> = {}): ServerQuota {
  return { totalSize: 0, totalCount: 0, defaultSizeLimit: 1024, defaultCountLimit: 100, ...overrides }
}

/** `listFeatureFlagsDetailed()` / `saveFeatureFlag()` 的单个功能开关 */
export function makeFeatureFlag(overrides: Partial<AdminFeatureFlag> = {}): AdminFeatureFlag {
  return {
    flagKey: 'flag_x',
    enabled: true,
    status: 'enabled',
    description: '',
    targetScope: 'global',
    rolloutPercent: 100,
    expiresAt: null,
    reason: '',
    createdBy: '@admin:example.org',
    createdTs: 1,
    updatedTs: 2,
    targets: [],
    ...overrides
  }
}

/** `getAdminInfo()` 响应（`Partial<AdminInfoResponse> & Record<string, unknown>`） */
export function makeAdminInfo(overrides: Record<string, unknown> = {}): AdminInfo {
  return { server_name: 'tjg', ...overrides }
}

/** 单条服务端公告（`GET /_synapse/admin/v1/server_notices` 的 `notices[]`）。 */
export function makeServerNotice(overrides: Partial<ServerNoticeInfo> = {}): ServerNoticeInfo {
  return { userId: '@notice:example.org', content: { body: 'notice' }, ...overrides }
}

/** `getServerNotices()` 响应壳。 */
export function makeServerNoticesResponse(notices: ServerNoticeInfo[] = []): { notices: ServerNoticeInfo[] } {
  return { notices }
}
