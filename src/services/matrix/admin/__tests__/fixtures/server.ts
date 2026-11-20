/**
 * admin 服务器域测试夹具。
 *
 * 类型来自真实契约：SDK `AdminManager` 的 `getServerStats/getServerStatus/getServerHealth/
 * getServerVersion`（`admin-server-types.d.ts`，已对照 synapse-rust `server.rs`）；
 * 日志条目用前端 facade 的 `AdminServerLogEntry`。
 *
 * ⚠️ 两处假结构在此被纠正：
 * - `getServerVersion` 的 `python_version` 后端恒为字符串 `"Rust"`（SDK 注释明确），
 *   旧测试写 `null` 与契约不符；
 * - `getServerHealth` 的 Python Synapse 风格 `{healthy, checks}` 不是 synapse-rust 形态
 *   （后者是 `{status, database}`），服务层保留该兼容分支，夹具单独声明这个非契约输入。
 */
import type { AdminManager } from 'matrix-js-sdk/admin'
import type { AdminServerLogEntry, ServerHealth, ServerStats, ServerStatus, ServerVersion } from '../../AdminTypes'

/** `getServerStats()` 的 wire 响应（字段全部可选） */
type ServerStatsWire = Awaited<ReturnType<AdminManager['getServerStats']>>
/** `getServerStatus()` 的 wire 响应 */
type ServerStatusWire = Awaited<ReturnType<AdminManager['getServerStatus']>>
/** `getServerHealth()` 的 wire 响应（synapse-rust：`{status, database}`） */
type ServerHealthWire = Awaited<ReturnType<AdminManager['getServerHealth']>>
/** `getServerVersion()` 的 wire 响应 */
type ServerVersionWire = Awaited<ReturnType<AdminManager['getServerVersion']>>

/**
 * Python Synapse 风格 `/health` 响应（`{healthy, checks}`）。
 *
 * 非 synapse-rust 契约：只用于覆盖 `AdminServerService.getServerHealth` 的上游兼容分支，
 * 因此单独声明，不混进 SDK 的 `ServerHealth`。
 */
export interface PythonSynapseHealthResponse {
  healthy: boolean
  checks: Record<string, { status: string }>
}

/** 后端未返回任何统计字段时的空响应 */
export const emptyServerStatsFixture: ServerStatsWire = {}

/** `getServerStats()` 响应 */
export function makeServerStats(overrides: Partial<ServerStatsWire> = {}): ServerStatsWire {
  return { ...overrides }
}

/** `getServerStatus()` 响应 */
export function makeServerStatus(overrides: Partial<ServerStatusWire> = {}): ServerStatusWire {
  return { db_ok: true, server_ok: true, up: true, ...overrides }
}

/** `getServerHealth()` 响应（synapse-rust 形态） */
export function makeServerHealth(overrides: Partial<ServerHealthWire> = {}): ServerHealthWire {
  return { status: 'ok', database: 'ok', ...overrides }
}

/** `getServerHealth()` 响应（Python Synapse 兼容形态） */
export function makePythonSynapseHealth(
  overrides: Partial<PythonSynapseHealthResponse> = {}
): PythonSynapseHealthResponse {
  return { healthy: true, checks: { cpu: { status: 'ok' }, memory: { status: 'ok' } }, ...overrides }
}

/** `getServerVersion()` 响应：Rust 后端的 `python_version` 恒为 `"Rust"` */
export function makeServerVersion(overrides: Partial<ServerVersionWire> = {}): ServerVersionWire {
  return { server_version: '1.2.3', python_version: 'Rust', ...overrides }
}

/** 单条服务端日志 */
export function makeServerLogEntry(overrides: Partial<AdminServerLogEntry> = {}): AdminServerLogEntry {
  return { timestamp: 1795000000000, level: 'info', message: 'server log', ...overrides }
}

// ── facade 归一化后的 DTO（composable / UI 层测试用）───────────────────────────
// 服务层把 wire 的 snake_case 归一为 camelCase，UI 实际拿到的是下面这些形状；
// 与上面的 wire 夹具分开，避免在 composable 测试里手写「像后端」的对象。

/** `adminService.getServerStatus()` 归一后：`up` 被折叠为 `'online' | 'offline'` */
export function makeServerStatusInfo(overrides: Partial<ServerStatus> = {}): ServerStatus {
  return { status: 'online', ...overrides }
}

/** `adminService.getServerHealth()` 归一后：synapse-rust 的 `database` 会落进 `checks` */
export function makeServerHealthInfo(overrides: Partial<ServerHealth> = {}): ServerHealth {
  return { healthy: true, checks: { database: { status: 'ok' } }, ...overrides }
}

/** `adminService.getServerVersion()` 归一后：`pythonVersion` 由 wire 的 `python_version` 透传（恒为 `"Rust"`） */
export function makeServerVersionInfo(overrides: Partial<ServerVersion> = {}): ServerVersion {
  return { serverVersion: '1.2.3', pythonVersion: 'Rust', ...overrides }
}

/** `adminService.getServerStats()` 归一后（五个计数字段，缺省为 0） */
export function makeServerStatsInfo(overrides: Partial<ServerStats> = {}): ServerStats {
  return {
    roomCount: 2,
    userCount: 1,
    dailyActiveUsers: 3,
    monthlyActiveUsers: 4,
    messageCount: 5,
    ...overrides
  }
}
