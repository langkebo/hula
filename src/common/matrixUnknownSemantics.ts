/**
 * BE-7：`M_UNKNOWN` 的**按状态码消歧**。
 *
 * 后端把 400 / 409 / 501 / 503 都映射到 catch-all `M_UNKNOWN`（Matrix 没有更贴切的
 * errcode），只读 `errcode` 无法区分「请求内容不被接受」「状态冲突」「未实现」。
 * 后端已用 `M_UNKNOWN_MEANINGS`（`synapse-common/src/error.rs`）钉住判别口径：
 * **客户端结合 HTTP 状态判别**。本模块是客户端侧落地。
 *
 * 刻意只返回「语义标签 + 文案」，由 `errors.ts` 组装成 `AppError`：
 * 这样 `correlationId` 仍由 `errors.ts` 统一生成，避免两处实现漂移。
 *
 * 不接管的状态：`500` / `503`（重试有意义，走调用方「5xx 一律 retryable」分支），
 * 以及无法判定（`errcode` 不是 `M_UNKNOWN`、或缺 `httpStatus`）。
 */
type UnknownErrcodeSemantics =
  | { kind: 'validation'; code: string; message: string; i18nKey?: string }
  | { kind: 'not_implemented'; message: string }

/**
 * @param errcode    业务错误码；非 `M_UNKNOWN` 返回 `null`
 * @param httpStatus HTTP 状态码；缺失返回 `null`（不猜）
 * @param message    后端原始文案，优先保留（比 generic 文案更有指向性）
 */
export function resolveUnknownErrcodeSemantics(
  errcode: string | undefined,
  httpStatus: number | undefined,
  message?: string
): UnknownErrcodeSemantics | null {
  if (errcode !== 'M_UNKNOWN' || typeof httpStatus !== 'number') {
    return null
  }
  const msg = message || errcode
  if (httpStatus === 400) {
    return { kind: 'validation', code: errcode, message: msg, i18nKey: 'error.matrix.bad_request' }
  }
  if (httpStatus === 409) {
    // 冲突原因只有后端知道（如「已经是好友」）⇒ 不套 generic 文案，展示层回落 message
    return { kind: 'validation', code: 'M_CONFLICT', message: msg }
  }
  if (httpStatus === 501) {
    // 501 = 能力/字段未实现，重试无意义
    return { kind: 'not_implemented', message: msg }
  }
  return null
}

/**
 * 501 的 `AppError` 组装（`correlationId` 由调用方注入，与其它 fatal 保持同一生成口径）。
 */
export function notImplementedError(
  message: string,
  correlationId: string
): { kind: 'fatal'; code: string; message: string; correlationId: string } {
  return { kind: 'fatal', code: 'M_NOT_IMPLEMENTED', message, correlationId }
}
