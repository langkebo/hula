/**
 * Crypto 生命周期诊断（Batch 4.1，图谱 §8.5 A5）。
 *
 * 背景：crypto 生命周期的失配此前**只在日志里可见** ——
 * `releaseStoppedCryptoBinding` 在"crypto 未处于已停止状态"时只是 `logger.warn` 后返回 false，
 * 运行期没有任何结构化信号；而「已停止的 crypto 被复用」这类 A1 缺陷复发时，
 * 表现是静默解不开新消息，日志也只在海量输出里一闪而过。
 *
 * 本模块把这两类事件收敛成**可被 store 读取**的结构化诊断，让它们在运行期可见。
 *
 * 不依赖 `matrix-js-sdk`，故不受 `check:sdk-boundary` 约束。
 */

/** crypto 生命周期的结构化诊断快照。 */
export interface CryptoLifecycleDiagnostics {
  /**
   * 最近一次「拒绝解绑」的原因。
   *
   * 非 null 表示有人在不该解绑的时机调用了 `releaseStoppedCryptoBinding`
   * （即 crypto 仍在运行）—— 拒绝本身是正确的保护，但**调用点很可能有问题**。
   */
  lastBindingReleaseRejection: string | null
  /** 成功解除「已停止 crypto 绑定」的累计次数（每次 = 同一 client 的 crypto 被重置，可重新 init）。 */
  stoppedBindingReleased: number
  /**
   * 最近一次「已停止的 crypto 被复用」的告警。
   *
   * 这是 **A1 缺陷的运行时哨兵**：`stopClient()` 停掉 crypto 后若不解除绑定就复用同一 client，
   * E2EE 会静默失效（解不开新消息、加密发送失败，且无异常）。
   * 非 null 即表示该形态真的发生了，应立刻检查是否有人绕过了
   * `MatrixClientLifecycle.forceReconnect` 的解绑 + 重新初始化流程。
   */
  staleCryptoReuseWarning: string | null
}

/** 诊断收集器：纯状态容器，便于单测与在 tracker 中低行长接入。 */
export class CryptoLifecycleDiagnosticsTracker {
  private rejection: string | null = null
  private released = 0
  private staleReuse: string | null = null

  /** 记录一次「拒绝解绑」（解绑时机不对）。 */
  rejectBindingRelease(reason: string): void {
    this.rejection = reason
  }

  /** 记录一次成功的解绑（同时清除上一次的拒绝记录 —— 已恢复正常时序）。 */
  recordBindingReleased(): void {
    this.released += 1
    this.rejection = null
  }

  /** 记录一次「已停止的 crypto 被复用」（A1 复发哨兵）。 */
  recordStaleCryptoReuse(reason: string): void {
    this.staleReuse = reason
  }

  /** 取诊断快照（拷贝，避免调用方改到内部状态）。 */
  snapshot(): CryptoLifecycleDiagnostics {
    return {
      lastBindingReleaseRejection: this.rejection,
      stoppedBindingReleased: this.released,
      staleCryptoReuseWarning: this.staleReuse
    }
  }

  /** 重置（登出/切换账号时调用）。 */
  reset(): void {
    this.rejection = null
    this.released = 0
    this.staleReuse = null
  }
}
