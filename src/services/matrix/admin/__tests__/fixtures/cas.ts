/**
 * CAS 服务管理夹具。
 *
 * 契约来源：SDK `CasManager['createService']` / `['deleteService']`
 * （注册响应 `{ id, name }`，删除响应 `{ id }`）。
 */
import type { CasServiceCreateResponse, CasServiceDeleteResponse } from '../../AdminCasService'

export function makeCasServiceCreateResponse(
  overrides: Partial<CasServiceCreateResponse> = {}
): CasServiceCreateResponse {
  return { id: 'svc', name: 'Svc', ...overrides }
}

export function makeCasServiceDeleteResponse(
  overrides: Partial<CasServiceDeleteResponse> = {}
): CasServiceDeleteResponse {
  return { id: 'svc', ...overrides }
}
