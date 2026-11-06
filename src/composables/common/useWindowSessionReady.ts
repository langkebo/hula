/**
 * 窗口级会话就绪入口（优化方案 Batch 2，2026-10-13）。
 *
 * 背景：Tauri 每个 WebView 有独立的 JS 上下文，非 home 窗口（设置窗口、独立聊天窗口…）
 * 里的 `matrixClientService` 是新实例，`getClient()` 初始为 `null`。此前各页签各自
 * 写一份恢复逻辑：有的调 `sessionOrchestrator.ensureClientReady()` + `waitForClientReady(15s)`，
 * 有的只 `waitForClientReady(10s)`——后者在「冷启动直接进入该页签」时没人触发恢复，
 * 只能白等超时后拿到空数据（图谱 §8.5 B2/B3）。
 *
 * 本模块把「恢复会话」收敛为**每窗口一次**的幂等入口：
 * - 同一 WebView 内所有调用共享同一次恢复（in-flight Promise 复用），不会重复建 client；
 * - 成功（`ready`）是终态，后续调用零成本直接返回；
 * - `no-session` / `error` 不落终态，允许重试（例如用户刚登录、或网络恢复后重试）。
 *
 * 语义：`ready` = client 可用；`no-session` = 本地无可用会话（没有 token）；
 * `error` = 恢复过程抛错/等 client 超时（可重试）。
 */

import { type ComputedRef, computed, type Ref, ref } from 'vue'
import { sessionOrchestrator } from '@/services/matrix/auth/SessionOrchestrator'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('WindowSessionReady')

/** 会话就绪三态。 */
type WindowSessionReadyState = 'ready' | 'no-session' | 'error'

/**
 * 等待 `waitForClientReady` 的默认超时。
 *
 * 取 15s：与设置页历史值一致（`SecuritySettings` / `SessionSettings` 原值），
 * 冷启动时 `loginWithToken` + `startClient` + Rust Crypto 初始化实测在数秒内完成。
 */
const DEFAULT_SESSION_READY_TIMEOUT_MS = 15_000

/** 依赖注入面（单测注入假实现；生产走模块级单例）。 */
export interface WindowSessionReadyDeps {
  /** 是否存在可用的本地会话（无 token ⇒ 无需尝试恢复）。 */
  hasAuthenticatedSession: () => Promise<boolean>
  /** 从后端存储的 token 重建 client（含 loginWithToken / startClient / crypto）。 */
  ensureClientReady: () => Promise<void>
  /** 轮询等待 client 实例可用。 */
  waitForClientReady: (opts: { timeoutMs: number }) => Promise<unknown>
  /** 读取本窗口当前 client（`null` = 尚未建立）。 */
  getClient: () => unknown | null
}

/** 组合式返回值。 */
interface WindowSessionReady {
  /** 当前状态；`null` = 尚未尝试。 */
  state: Ref<WindowSessionReadyState | null>
  /** 最近一次失败的原始错误（仅 `error` 态非空）。 */
  error: Ref<Error | null>
  /** 恢复是否正在进行。 */
  pending: Ref<boolean>
  /** 是否已就绪（模板便捷判据）。 */
  ready: ComputedRef<boolean>
  /** 幂等入口：首次真正恢复，之后复用同一结果/同一 in-flight。 */
  ensureSessionReady: () => Promise<WindowSessionReadyState>
}

/** 把任意抛出物收敛成 Error（保留原始 message 便于日志排查）。 */
function toError(err: unknown): Error {
  if (err instanceof Error) return err
  if (typeof err === 'string') return new Error(err)
  if (err && typeof err === 'object' && 'message' in err) {
    return new Error(String((err as { message: unknown }).message))
  }
  return new Error('未知错误')
}

/**
 * 创建一个「窗口级会话就绪」控制器。
 *
 * @param deps 依赖注入面（便于单测）
 * @param options.timeoutMs 等待 client 就绪的超时，默认 {@link DEFAULT_SESSION_READY_TIMEOUT_MS}
 */
export function createWindowSessionReady(
  deps: WindowSessionReadyDeps,
  options?: { timeoutMs?: number }
): WindowSessionReady {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_SESSION_READY_TIMEOUT_MS
  const state = ref<WindowSessionReadyState | null>(null)
  const error = ref<Error | null>(null)
  const pending = ref(false)
  let inFlight: Promise<WindowSessionReadyState> | null = null

  /** 落状态并返回（统一日志与 error 归一化）。 */
  function settle(next: WindowSessionReadyState, cause?: unknown): WindowSessionReadyState {
    state.value = next
    if (next === 'error') {
      error.value = toError(cause)
      logger.warn(`窗口会话恢复失败: ${error.value.message}`)
    } else {
      error.value = null
      logger.info(`窗口会话状态: ${next}`)
    }
    return next
  }

  async function run(): Promise<WindowSessionReadyState> {
    error.value = null

    // 快速路径：本窗口已有 client（例如嵌入式设置页与 home 同窗口）⇒ 零 IPC 直接就绪。
    if (deps.getClient()) return settle('ready')

    try {
      if (!(await deps.hasAuthenticatedSession())) return settle('no-session')
    } catch (err) {
      return settle('error', err)
    }

    try {
      await deps.ensureClientReady()
    } catch (err) {
      return settle('error', err)
    }

    // ensureClientReady 在「无 uid / 无 token」时会静默返回而不建 client ⇒ 判为无会话。
    if (!deps.getClient()) return settle('no-session')

    try {
      await deps.waitForClientReady({ timeoutMs })
    } catch (err) {
      return settle('error', err)
    }

    return settle(deps.getClient() ? 'ready' : 'no-session')
  }

  function ensureSessionReady(): Promise<WindowSessionReadyState> {
    // 成功是终态：重复调用零成本。
    if (state.value === 'ready' && deps.getClient()) return Promise.resolve('ready')
    // 幂等：复用 in-flight，避免多页签并发各建一次 client。
    if (inFlight) return inFlight

    pending.value = true
    inFlight = run().finally(() => {
      inFlight = null
      pending.value = false
    })
    return inFlight
  }

  return {
    state,
    error,
    pending,
    ready: computed(() => state.value === 'ready'),
    ensureSessionReady
  }
}

let singleton: WindowSessionReady | null = null

/**
 * 取本窗口的会话就绪控制器（模块级单例）。
 *
 * 同一 WebView 内所有调用者共享同一次恢复：入口组件（设置页/独立聊天窗口）先调用
 * `ensureSessionReady()` 抢跑，各页签随后调用只会 await 同一个 in-flight。
 */
export function useWindowSessionReady(): WindowSessionReady {
  singleton ??= createWindowSessionReady({
    hasAuthenticatedSession: () => sessionOrchestrator.hasAuthenticatedSession(),
    ensureClientReady: () => sessionOrchestrator.ensureClientReady(),
    waitForClientReady: (opts) => matrixClientService.waitForClientReady(opts),
    getClient: () => matrixClientService.getClient()
  })
  return singleton
}

/**
 * 丢弃窗口级单例。
 *
 * 仅供测试使用：单例是模块级状态，用例之间会互相串味（上一条用例的 `ready` 终态
 * 会让下一条用例的 `ensureSessionReady()` 直接短路）。生产代码**不要**调用。
 */
export function resetWindowSessionReadyForTest(): void {
  singleton = null
}
