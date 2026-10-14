/**
 * 日志参数序列化 —— 保证「错误事实」不会在日志里退化成 `{}`。
 *
 * ## 背景（2026-10-13 实测 `pnpm td` 日志）
 *
 * ```
 * [InvitePolicyEnforcement] 读取服务端邀请策略失败，跳过联系人同步（不覆盖服务端策略）: {}
 * ```
 *
 * 根因：`Error` 的 `message` / `stack` 是**非可枚举**属性 ⇒ `Object.entries(err)` 为空、
 * `JSON.stringify(err)` 为 `{}`。而 `Logger` 的格式化链路恰好是
 * `redactObject(args) → JSON.stringify(...)`，于是**全仓每一处**
 * `logger.warn(msg, err)` / `logger.error(msg, err)` 都在**静默丢弃**
 * errcode / 状态码 / 消息本身 —— 排障时只剩一个空对象，看起来像"没有错误信息"。
 *
 * 本模块提供两件事：
 *
 * 1. {@link toErrorDescriptor} —— 把 `Error` 摊成**可枚举**的普通对象（含 Matrix SDK
 *    常见的 `errorCode` / `statusCode` / `retryAfter` 与 `cause` 链）。刻意做成"转成普通对象"
 *    而不是"直接输出原文"，是为了让既有的脱敏逻辑（`Logger.redactObject`）**仍然生效**
 *    —— 错误消息里可能夹带 token。
 * 2. {@link serializeLogArg} —— 对普通对象做**不会抛**的序列化。`JSON.stringify` 在
 *    循环引用 / `BigInt` / 宿主对象上会抛错，而**日志函数抛错会污染调用点自身**
 *    （在 catch 块里打日志却把异常再抛一次，会掩盖原始错误）。
 */

/** 从 Error 上额外提取的事实字段（Matrix SDK 的 `SdkError` 会带这些） */
const ERROR_FACT_KEYS = [
  'errorCode',
  'statusCode',
  'httpStatus',
  'isRetryable',
  'retryAfter',
  'userTip',
  'traceId'
] as const

/** `cause` 链最大展开深度（防自引用/无限链） */
const MAX_CAUSE_DEPTH = 3

/**
 * 把 `Error` 摊成可枚举的普通对象。
 *
 * @param error 任意 Error
 * @param depth 当前 `cause` 展开深度（内部递归用）
 * @returns 含 `name` / `message` / 已知事实字段 / `stack` / `cause` 的普通对象
 */
export function toErrorDescriptor(error: Error, depth = 0): Record<string, unknown> {
  const descriptor: Record<string, unknown> = {
    name: error.name,
    message: error.message
  }

  const source = error as Error & Record<string, unknown>
  for (const key of ERROR_FACT_KEYS) {
    const value = source[key]
    if (value !== undefined && value !== null) {
      descriptor[key] = value
    }
  }

  if (typeof error.stack === 'string' && error.stack.length > 0) {
    descriptor.stack = error.stack
  }

  const cause = (error as { cause?: unknown }).cause
  if (cause !== undefined) {
    if (cause instanceof Error && depth < MAX_CAUSE_DEPTH) {
      descriptor.cause = toErrorDescriptor(cause, depth + 1)
    } else {
      descriptor.cause = cause
    }
  }

  return descriptor
}

/**
 * 把单个日志参数序列化为字符串。**永不抛错**。
 *
 * @param arg 任意日志参数（可能已被脱敏处理）
 * @returns 字符串形式；无法序列化时返回 `'[Unserializable]'`
 */
export function serializeLogArg(arg: unknown): string {
  if (typeof arg === 'string') return arg
  if (arg === null || arg === undefined) return String(arg)

  if (typeof arg === 'object') {
    try {
      const json = JSON.stringify(arg)
      return json ?? String(arg)
    } catch {
      // 循环引用 / BigInt / 宿主对象：宁可丢失结构，也不能让日志调用抛错
      return '[Unserializable]'
    }
  }

  return String(arg)
}
