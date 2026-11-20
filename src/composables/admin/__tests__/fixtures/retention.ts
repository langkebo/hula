/**
 * admin 保留策略域（retention）测试夹具。
 *
 * 类型全部从服务层真实契约推导：
 * - 策略列表：`AdminRetentionService.getRetentionPolicies()` → `{ policies, nextToken? }`；
 *   条目来自 SDK `AdminManager.getRetentionPolicy()` / `getRoomRetentionPolicy()`，
 *   wire 为 snake_case（`room_id` / `min_lifetime` / `max_lifetime` / `is_expire_on_clients`）。
 * - 运行状态：`AdminRetentionService.getRetentionStatus()` → `RetentionStatusResponse`
 * - 默认策略：`AdminRetentionService.getDefaultRetention()` → `RetentionPolicy | null`
 * - 房间策略：`AdminRetentionService.getRoomRetention()` → `RoomRetention`（无策略时只含 `roomId`）
 */
import type { RetentionPolicy, RoomRetention } from '@/services/matrix/admin/AdminTypes'
import type { AdminRetentionService, RetentionStatusResponse } from '@/services/matrix/admin/RetentionService'
import type { RoomRetentionPolicy } from '@/services/matrix/sdk'

type RetentionPoliciesResponse = Awaited<ReturnType<AdminRetentionService['getRetentionPolicies']>>

/** 策略列表里的一条 wire 记录（`GET /retention/policy/{roomId}` 的 snake_case 形状） */
export function makeRetentionPolicyRow(overrides: Partial<RoomRetentionPolicy> = {}): RoomRetentionPolicy {
  return {
    room_id: '!room:example.org',
    min_lifetime: null,
    max_lifetime: null,
    is_expire_on_clients: false,
    ...overrides
  }
}

/** `getRetentionPolicies()` 响应 */
export function makeRetentionPoliciesResponse(
  policies: RetentionPoliciesResponse['policies'] = [],
  overrides: Partial<RetentionPoliciesResponse> = {}
): RetentionPoliciesResponse {
  return { policies, ...overrides }
}

/** `getRetentionStatus()` 响应（默认 `{}`，即服务层失败兜底形状） */
export function makeRetentionStatus(overrides: Partial<RetentionStatusResponse> = {}): RetentionStatusResponse {
  return { ...overrides }
}

/** `getDefaultRetention()` 响应 */
export function makeRetentionPolicy(overrides: Partial<RetentionPolicy> = {}): RetentionPolicy {
  return { ...overrides }
}

/** `getRoomRetention()` 响应 */
export function makeRoomRetention(roomId: string, policy?: RetentionPolicy): RoomRetention {
  return policy ? { roomId, policy } : { roomId }
}
