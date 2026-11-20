import type { ApplicationServiceAdmin, ApplicationServiceResponse } from '@/services/matrix/admin/ApplicationService'

/**
 * 应用服务（Application Service）域测试夹具。
 *
 * 类型全部来自 `ApplicationService.ts` 的导出契约，避免测试里手写半成品结构：
 * - `ApplicationServiceResponse` 双主键（`id: number | string` 与 `as_id: string`），
 *   旧 mock 只写了 `{ id }`，掩盖了后端真实返回的 `url` / `sender_localpart` / 启用状态；
 * - 列表响应的游标键是 `next_token`（snake_case），服务层再映射成 `nextToken`；
 * - ping 响应的耗时字段是 `duration_ms`（snake_case）。
 */

/** 列表端点返回类型（`next_token` + `services`）。 */
export type ApplicationServiceListFixture = Awaited<ReturnType<ApplicationServiceAdmin['listApplicationServices']>>

/** ping 端点返回类型（`ok` + 可选 `duration_ms`）。 */
export type ApplicationServicePingFixture = Awaited<ReturnType<ApplicationServiceAdmin['pingApplicationService']>>

/** 生成应用服务实体，默认值模拟一个已注册且启用的服务。 */
export function makeApplicationService(
  overrides: Partial<ApplicationServiceResponse> = {}
): ApplicationServiceResponse {
  return {
    id: 1,
    as_id: '@as1:server.test',
    url: 'https://as1.test',
    sender_localpart: 'as1',
    is_enabled: true,
    ...overrides
  }
}

/** 生成应用服务列表响应；`next_token` 仅在显式传入时出现（与后端一致）。 */
export function makeApplicationServiceList(
  services: ApplicationServiceResponse[],
  nextToken?: string
): ApplicationServiceListFixture {
  return { services, ...(nextToken !== undefined ? { next_token: nextToken } : {}) }
}

/** 生成 ping 响应，默认连通。 */
export function makeApplicationServicePing(
  overrides: Partial<ApplicationServicePingFixture> = {}
): ApplicationServicePingFixture {
  return { ok: true, ...overrides }
}
