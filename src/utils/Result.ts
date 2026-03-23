/**
 * Result 类型定义
 * 用于替代 try-catch 的函数式错误处理模型
 */
export type Result<T, E = Error> = 
  | { ok: true; data: T; error?: never }
  | { ok: false; error: E; data?: never };

/**
 * 成功结果包装
 */
export const ok = <T>(data: T): Result<T, never> => ({
  ok: true,
  data
});

/**
 * 错误结果包装
 */
export const err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error
});

/**
 * 将 Promise 包装为 Result 类型
 * 避免在业务代码中写过多的 try-catch
 */
export const toResult = async <T, E = Error>(
  promise: Promise<T>
): Promise<Result<T, E>> => {
  try {
    const data = await promise;
    return ok(data);
  } catch (e) {
    return err(e as E);
  }
};
