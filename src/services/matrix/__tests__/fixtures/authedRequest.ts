import type { safeGet } from '../../MatrixRequestHelper'

/**
 * `safeGet<T>` 的响应体。
 *
 * 类型来源：`safeGet` 的泛型返回值 `Promise<T>`；SDK `http.authedRequest`
 * 对响应体原样透传，形状由调用方给定的 `T` 决定。
 */
export type AuthedGetResponse = Awaited<ReturnType<typeof safeGet<{ ok: boolean }>>>

export function makeAuthedGetResponse(overrides: Partial<AuthedGetResponse> = {}): AuthedGetResponse {
  return { ok: true, ...overrides }
}
