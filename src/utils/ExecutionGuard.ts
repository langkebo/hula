/**
 * SingleFlight + IdempotencyGuard — 单次执行守卫共享工具
 *
 * 收敛 Phase 0-2 中手写的 hasStarted / initialized / inflightPromise / bootstrapSettled 等
 * 同一思想变体，统一语义与测试契约。
 *
 * 设计原则：
 * - 最小 API：每个类只有 run / reset / isRunning / isSettled
 * - 不吞错：run 失败时不置 settled，允许重试
 * - 不缓存结果：SingleFlight 只去重 in-flight Promise，完成后允许重新执行
 */

/**
 * SingleFlight：并发去重 in-flight Promise。
 *
 * 场景：多个调用方同时触发同一异步操作（如 fetchCapabilities），
 * 只执行一次实际操作，所有调用方共享同一 Promise 结果。
 *
 * 不缓存结果——Promise settle 后清空引用，下次调用重新执行。
 * 适用于"同一时刻只需一个请求"但"不同时刻可重复请求"的场景。
 *
 * @example
 * const flight = new SingleFlight<Capabilities>()
 * const caps = await flight.run(() => fetchCapabilities())
 */
export class SingleFlight<T> {
  private inflightPromise: Promise<T> | null = null

  /**
   * 执行异步操作。若已有 in-flight Promise，直接复用。
   *
   * @param factory 异步操作工厂函数（仅在无 in-flight 时调用）
   * @returns 所有并发调用方共享的 Promise
   */
  run(factory: () => Promise<T>): Promise<T> {
    if (this.inflightPromise) {
      return this.inflightPromise
    }
    this.inflightPromise = (async () => {
      try {
        return await factory()
      } finally {
        // settle 后清空，允许下次调用重新执行
        this.inflightPromise = null
      }
    })()
    return this.inflightPromise
  }

  /** 是否有 in-flight Promise 正在执行 */
  get isRunning(): boolean {
    return this.inflightPromise !== null
  }

  /** 重置状态（测试 / 强制中断用） */
  reset(): void {
    this.inflightPromise = null
  }
}

/**
 * IdempotencyGuard：幂等执行守卫。
 *
 * 场景：startClient / bootstrapPostLoginState / WebVitals.start 等只需执行一次的操作。
 * 成功完成后标记 settled，后续调用直接短路返回。
 *
 * 与 SingleFlight 的区别：
 * - SingleFlight：并发去重，完成后可重新执行（不缓存结果）
 * - IdempotencyGuard：串行幂等，成功后永久跳过（直到 reset）
 *
 * 失败时不置 settled，允许重试。
 *
 * @example
 * const guard = new IdempotencyGuard()
 * await guard.run(() => startClient())
 * // 第二次调用直接 return，不执行 factory
 * await guard.run(() => startClient())
 */
export class IdempotencyGuard {
  private settled = false
  private inflightPromise: Promise<void> | null = null

  /**
   * 执行操作。已 settled 则短路；in-flight 则复用 Promise。
   *
   * @param factory 操作工厂函数（仅在未 settled 且无 in-flight 时调用）
   * @returns 操作 Promise（settled 时为已完成的 void Promise）
   */
  run(factory: () => Promise<void>): Promise<void> {
    // 幂等短路：已成功完成过
    if (this.settled) {
      return Promise.resolve()
    }

    // 并发去重：已有 in-flight Promise
    if (this.inflightPromise) {
      return this.inflightPromise
    }

    this.inflightPromise = (async () => {
      try {
        await factory()
        // 仅成功时置 settled（失败不置，允许重试）
        this.settled = true
      } finally {
        this.inflightPromise = null
      }
    })()

    return this.inflightPromise
  }

  /** 是否已成功完成（settled） */
  get isSettled(): boolean {
    return this.settled
  }

  /** 是否正在执行中 */
  get isRunning(): boolean {
    return this.inflightPromise !== null
  }

  /** 重置状态（logout / stopClient / 测试用） */
  reset(): void {
    this.settled = false
    this.inflightPromise = null
  }
}
