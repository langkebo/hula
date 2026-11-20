import type {
  FeatureFlag,
  FeatureFlagPage,
  FederationDestination,
  IpBlock,
  SamlMapping,
  SamlMappingPage,
  SecurityEvent,
  SecurityEventPage
} from 'matrix-js-sdk/admin'
import { FeatureFlagFixture } from '@/services/matrix/__tests__/fixtures/generated'
import type { AdminAuditLogEntry, AdminAuditLogPage } from '@/services/matrix/admin/AdminTypes'

/**
 * 安全 / 联邦域测试夹具。
 *
 * 字段全部对齐 SDK 契约（`admin-config-types.d.ts` / `admin-federation-types.d.ts` /
 * `admin-server-types.d.ts`），避免测试里手抄字段时漏掉必填项：
 * - `FederationDestination` 8 个必填字段（旧 mock 只有 5 个时间戳字段）；
 * - `FeatureFlag` / `FeatureFlagPage` 复用 codegen 夹具，仅覆盖用例关心的键；
 * - `SecurityEvent` 的键是 `event_id` / `event_type` / `user_id` / `ts`（不是 `id`）；
 * - `IpBlock` 必填 `ip`。
 */

/** 生成 `FeatureFlag`，默认字段来自 codegen 夹具。 */
export function makeFeatureFlag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return { ...FeatureFlagFixture, ...overrides }
}

/** 生成 `FeatureFlagPage`；`total` 缺失是旧 mock 的假结构，这里按 flags 长度补齐。 */
export function makeFeatureFlagPage(flags: FeatureFlag[], total = flags.length): FeatureFlagPage {
  return { flags, total }
}

/** 生成 `FederationDestination`：8 个必填字段齐全（后端默认 `status: "active"`）。 */
export function makeFederationDestination(overrides: Partial<FederationDestination> = {}): FederationDestination {
  return {
    destination: 'server.test',
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

/** 生成 `SamlMapping`（`name_id` 必填）。 */
export function makeSamlMapping(nameId: string, overrides: Partial<SamlMapping> = {}): SamlMapping {
  return { name_id: nameId, ...overrides }
}

/** 生成 `SamlMappingPage`，游标键是 `next_token`。 */
export function makeSamlMappingPage(mappings: SamlMapping[], nextToken?: string): SamlMappingPage {
  return { mappings, ...(nextToken !== undefined ? { next_token: nextToken } : {}) }
}

/** 生成安全事件，使用 SDK 的线格式字段名。 */
export function makeSecurityEvent(overrides: Partial<SecurityEvent> = {}): SecurityEvent {
  return {
    event_id: '$security-event',
    event_type: 'login_fail',
    user_id: '@u:server',
    ts: 1795000000000,
    ...overrides
  }
}

/** 生成安全事件分页响应壳。 */
export function makeSecurityEventsPage(events: SecurityEvent[], nextToken?: string): SecurityEventPage {
  return { events, ...(nextToken !== undefined ? { next_token: nextToken } : {}) }
}

/** 生成 IP 封禁记录（`ip` 必填）。 */
export function makeIpBlock(overrides: Partial<IpBlock> = {}): IpBlock {
  return { ip: '1.2.3.4', reason: 'abuse', ...overrides }
}

/** 生成单条审计记录：字段名是后端线格式（`event_id` / `actor_id` / `action` / `created_ts`）。 */
export function makeAuditLogEntry(overrides: Partial<AdminAuditLogEntry> = {}): AdminAuditLogEntry {
  return {
    event_id: '$audit-1',
    actor_id: '@admin:server.test',
    action: 'login',
    resource_type: 'user',
    created_ts: 1795000000000,
    ...overrides
  }
}

/** 生成审计日志分页响应壳，游标键是 `next_batch`。 */
export function makeAuditLogPage(logs: AdminAuditLogEntry[], nextBatch?: string): AdminAuditLogPage {
  return { logs, ...(nextBatch !== undefined ? { next_batch: nextBatch } : {}) }
}
