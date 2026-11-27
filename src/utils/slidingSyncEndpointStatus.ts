/**
 * Sliding Sync 端点探测结果归类。
 *
 * 探测方式是 `POST` 一个空 body，HTTP 语义决定了不能只按「是否 404」判断：
 * - 2xx：端点可用；
 * - 400/401/403/405/429：路由已注册，只是 body 不完整 / 缺鉴权 / 方法受限 / 被限流，
 *   端点存在且可达；
 * - 404/501：服务端确实未实现该端点；
 * - 网络异常（fetch 抛错、拿不到 status）或其它 5xx：无法确认端点状态，属于「不可达」，
 *   不能误报成「未实现」。
 */

export type SlidingSyncEndpointState = 'available' | 'not_implemented' | 'unreachable'

/** 端点已路由、但不会返回 2xx 的状态码（缺 body / 鉴权 / 方法 / 限流）。 */
const ROUTED_ENDPOINT_STATUSES: ReadonlySet<number> = new Set([400, 401, 403, 405, 429])

export function classifySlidingSyncEndpointStatus(
  status: number | 'error' | null | undefined
): SlidingSyncEndpointState {
  if (typeof status !== 'number') return 'unreachable'
  if (status === 404 || status === 501) return 'not_implemented'
  if (status >= 200 && status < 300) return 'available'
  if (ROUTED_ENDPOINT_STATUSES.has(status)) return 'available'
  return 'unreachable'
}

/** 401/403 说明端点存在但需要认证，自检面板据此标注「需鉴权」。 */
export function isSlidingSyncAuthRequiredStatus(status: number | 'error' | null | undefined): boolean {
  return status === 401 || status === 403
}
