/**
 * admin 注册令牌域测试夹具。
 *
 * 类型全部由 SDK 方法签名推导（`AdminManager`）：
 * - 列表：`getRegistrationTokens()` → `{registration_tokens, next_batch?}`
 * - 创建/详情：`createRegistrationToken()` → 单条 `RegistrationToken`
 *   （`token` 必填；`uses_allowed` / `pending` / `completed` / `expiry_time` 可缺省，
 *   服务层负责把缺省值映射成 `undefined` / `0`）
 */
import type { AdminManager } from '@/services/matrix/sdk'

/** `getRegistrationTokens()` 的 wire 分页响应 */
type RegistrationTokenPageWire = Awaited<ReturnType<AdminManager['getRegistrationTokens']>>
/** `createRegistrationToken()` 的单条 wire 响应 */
type RegistrationTokenWire = Awaited<ReturnType<AdminManager['createRegistrationToken']>>

/** 单条注册令牌 wire 结构（默认只有必填的 `token`） */
export function makeRegistrationTokenWire(overrides: Partial<RegistrationTokenWire> = {}): RegistrationTokenWire {
  return { token: 't1', ...overrides }
}

/** `getRegistrationTokens()` 分页响应 */
export function makeRegistrationTokenPage(
  registrationTokens: RegistrationTokenWire[] = [],
  overrides: Partial<RegistrationTokenPageWire> = {}
): RegistrationTokenPageWire {
  return { registration_tokens: registrationTokens, ...overrides }
}
