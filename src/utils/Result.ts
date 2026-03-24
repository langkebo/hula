/**
 * 统一结果类型
 * 提供 Result 模式用于统一错误处理
 */

/**
 * Result 类型 - 表示操作的成功或失败结果
 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E }

/**
 * 创建成功结果
 */
export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

/**
 * 创建失败结果
 */
export function Err<E = Error>(error: E): Result<never, E> {
  return { ok: false, error }
}

/**
 * 检查结果是否为成功
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok === true
}

/**
 * 检查结果是否为失败
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return result.ok === false
}

/**
 * 从可能为空的值创建 Result
 */
export function fromNullable<T, E = Error>(value: T | null | undefined, error: E): Result<T, E> {
  if (value === null || value === undefined) {
    return Err(error)
  }
  return Ok(value)
}

/**
 * 从 Promise 中执行并捕获错误
 */
export async function tryCatch<T, E = Error>(
  fn: () => Promise<T>,
  mapError: (e: unknown) => E = (e) => e as E
): Promise<Result<T, E>> {
  try {
    const value = await fn()
    return Ok(value)
  } catch (e) {
    return Err(mapError(e))
  }
}

/**
 * 同步 tryCatch
 */
export function tryCatchSync<T, E = Error>(fn: () => T, mapError: (e: unknown) => E = (e) => e as E): Result<T, E> {
  try {
    const value = fn()
    return Ok(value)
  } catch (e) {
    return Err(mapError(e))
  }
}

/**
 * Result map - 转换成功值
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (isOk(result)) {
    return Ok(fn(result.value))
  }
  return result
}

/**
 * Result mapErr - 转换错误值
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (isErr(result)) {
    return Err(fn(result.error))
  }
  return result
}

/**
 * Result andThen - 链式调用
 */
export function andThen<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value)
  }
  return result
}

/**
 * Result getOrElse - 获取值或默认值
 */
export function getOrElse<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value
  }
  return defaultValue
}

/**
 * Result unwrap - 解包值（可能抛出）
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value
  }
  throw result.error
}

/**
 * Result unwrapOrElse - 解包值或执行函数
 */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
  if (isOk(result)) {
    return result.value
  }
  return fn(result.error)
}
