/**
 * admin 账户策略域测试夹具。
 *
 * 类型来自 `AccountPolicyService.ts` 导出的 SDK 契约 `PolicyCheckResponse`：
 * `allowed` / `result` 必填，`reason` 仅在拒绝时存在。
 */
import type { PolicyCheckResponse } from '@/services/matrix/admin/AccountPolicyService'

/** 生成 `POST /policy/check` 的响应（默认拒绝场景）。 */
export function makePolicyCheckResponse(overrides: Partial<PolicyCheckResponse> = {}): PolicyCheckResponse {
  return { allowed: false, result: 'deny', reason: 'banned word', ...overrides }
}
