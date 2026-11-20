/**
 * UIA（User-Interactive Auth）透传响应夹具。
 *
 * SDK 的 `makeRequest` 契约为 `(authData: unknown) => Promise<unknown>`：
 * 响应体形状由 homeserver 决定，服务层只透传不解析，因此以
 * `Record<string, unknown>` 标注，避免在测试里写匿名对象字面量。
 */

/** 认证通过后的透传响应。 */
export function makeUiaSuccessResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { success: true, ...overrides }
}

/** 认证失败（UIA 挑战）的透传响应。 */
export function makeUiaAuthErrorResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { data: { session: 'sess-1' }, ...overrides }
}
