/**
 * withDuplicateTrigger — 稳定性契约测试注入式重复触发助手
 *
 * 用于验证「单次执行守卫」在重复触发时是否正确去重：
 * - 并发模式：同一 tick 内 Promise.all 触发 N 次
 * - 串行模式：await 后依次触发 N 次
 *
 * 返回所有调用的结果数组，测试可据此断言：
 * - factory / spy 调用次数
 * - 结果一致性（同一引用 / 等价值）
 *
 * @example
 * ```ts
 * const spy = vi.spyOn(client, 'startClient')
 * const results = await withDuplicateTrigger(
 *   () => service.startClient(),
 *   { mode: 'concurrent', times: 3 }
 * )
 * expect(spy).toHaveBeenCalledTimes(1)
 * expect(results.every(r => r === results[0])).toBe(true)
 * ```
 */
export interface DuplicateTriggerOptions {
  /** 触发模式：concurrent = Promise.all 并发，serial = 依次 await */
  mode: 'concurrent' | 'serial'
  /** 重复触发次数（含首次） */
  times: number
}

export interface DuplicateTriggerResult<T> {
  /** 所有调用的返回值（按触发顺序） */
  results: T[]
  /** 并发模式下是否复用了同一 Promise（所有结果引用相同） */
  allSameReference: boolean
}

/**
 * 重复触发一个异步操作，用于验证幂等/去重守卫。
 *
 * @param fn 被测异步操作
 * @param options 触发选项
 * @returns 结果数组 + 引用一致性标志
 */
export async function withDuplicateTrigger<T>(
  fn: () => Promise<T>,
  options: DuplicateTriggerOptions
): Promise<DuplicateTriggerResult<T>> {
  const { mode, times } = options
  const count = Math.max(1, Math.floor(times))

  if (mode === 'concurrent') {
    const promises: Promise<T>[] = []
    for (let i = 0; i < count; i++) {
      promises.push(fn())
    }
    const results = await Promise.all(promises)
    const allSameReference = results.every((r) => r === results[0])
    return { results, allSameReference }
  }

  // serial
  const results: T[] = []
  for (let i = 0; i < count; i++) {
    results.push(await fn())
  }
  const allSameReference = results.every((r) => r === results[0])
  return { results, allSameReference }
}
