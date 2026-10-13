/**
 * 「解除已停止的 crypto 绑定」纯函数（Batch 4.1 从 `MatrixCryptoStateTracker` 抽出）。
 *
 * 为什么不放在 tracker 里：这是纯操作 + 纯判定，与 tracker 的状态机无关；
 * 抽出来后 tracker 只保留薄委托与日志，既降行数又更好测。
 *
 * 语义（勿回退）：
 * - 只在 `cryptoBackend.stopped === true` 时才允许置空 —— 也就是**只清理已经停掉的绑定**。
 *   仍在运行的 crypto 若被置空，OlmMachine 与 IndexedDB 连接会**泄漏**（无人再持有它去 close）。
 * - ⚠️ **2026-10-13（A3）后本函数在生产路径上已降级为「兜底」**：fork `0824bb23a` 起，
 *   `client.stopClient()` 会**自己**停止 crypto 并清空 `cryptoBackend`
 *   （`releaseCryptoBackend`，见 `check:sdk-crypto-teardown` 的 8 条契约），所以正常时序下
 *   本函数看到的是 `getCrypto() === undefined` ⇒ `no-crypto`，**这是正常路径，不是异常**。
 *   保留它的价值：SDK 若回退成"只停不清"，这一层仍能把 E2EE 救回来。
 *
 * 不依赖 `matrix-js-sdk`（只做结构化访问），故不受 `check:sdk-boundary` 约束。
 */
import { createLogger } from '@/utils/Logger'
import type { CryptoLifecycleDiagnosticsTracker } from './cryptoLifecycleDiagnostics'

const logger = createLogger('MatrixCrypto')

/** 拒绝解绑的原因。 */
export type BindingReleaseRejectionReason = 'no-client' | 'no-crypto' | 'crypto-not-stopped'

/** 解绑结果。 */
export type BindingReleaseOutcome = { ok: true } | { ok: false; reason: BindingReleaseRejectionReason }

/** 本函数对 client 的最小结构化依赖面。 */
export interface CryptoBackendHolder {
  cryptoBackend?: unknown
  getCrypto?: () => unknown
}

/**
 * 解除「已停止的 crypto」绑定：仅当 `stopped === true` 时把 `cryptoBackend` 置空。
 *
 * 调用方（tracker）负责把 `crypto-not-stopped` 记入诊断并对 `ok: true` 打 info 日志。
 */
export function releaseStoppedCryptoBinding(client: CryptoBackendHolder | null): BindingReleaseOutcome {
  if (!client) return { ok: false, reason: 'no-client' }

  const existing = typeof client.getCrypto === 'function' ? client.getCrypto() : undefined
  if (!existing) return { ok: false, reason: 'no-crypto' }

  if ((existing as { stopped?: boolean }).stopped !== true) {
    return { ok: false, reason: 'crypto-not-stopped' }
  }

  client.cryptoBackend = undefined
  return { ok: true }
}

/**
 * 判断当前绑定的 crypto 是否**已停止但仍在被复用**（A1 复发哨兵）。
 *
 * @returns 命中时返回描述字符串，否则 null。
 */
export function detectStaleCryptoReuse(client: CryptoBackendHolder | null): string | null {
  if (!client) return null
  const existing = typeof client.getCrypto === 'function' ? client.getCrypto() : undefined
  if (!existing) return null
  if ((existing as { stopped?: boolean }).stopped !== true) return null
  return 'crypto-stopped-but-still-bound'
}

/**
 * A1 复发哨兵：若检测到「已停止的 crypto 仍被绑定」，记入结构化诊断并告警。
 *
 * 抽成独立函数（而非在 `ensureCrypto` 里内联）有两个目的：
 * ① 让 tracker 的该分支只占 1 行，避免文件重新长回体积警戒线；
 * ② 日志与诊断写入放在一处，改判据时不必在两个文件间对照。
 *
 * @returns 命中的描述字符串（便于调用方/测试断言），未命中为 null
 */
export function recordStaleCryptoReuseIfAny(
  client: CryptoBackendHolder | null,
  lifecycle: CryptoLifecycleDiagnosticsTracker
): string | null {
  const reason = detectStaleCryptoReuse(client)
  if (!reason) return null
  lifecycle.recordStaleCryptoReuse(reason)
  logger.warn(
    `检测到已停止的 crypto 仍被复用（${reason}）：本次将跳过 initRustCrypto，E2EE 可能不可用 —— ` +
      '正常时序由 MatrixClientLifecycle 的「stop → 解绑 → 重新初始化」保证，命中此处说明有人绕过了它'
  )
  return reason
}
