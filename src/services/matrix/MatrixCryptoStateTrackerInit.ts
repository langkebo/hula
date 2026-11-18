/**
 * MatrixCryptoStateTrackerInit — Rust Crypto 初始化编排片段。
 *
 * 从 `MatrixCryptoStateTracker`（原 712 行）抽出：负责 Web Locks 跨窗口串行化、
 * 8s 超时与后台续跑、严格模式偏好重放、storageKey 缺失时的解锁补初始化、
 * 以及 initialized 标记的可信写入。真正的初始化实现由派生类提供。
 */

import { recordStaleCryptoReuseIfAny } from '@/services/matrix/crypto/cryptoBindingRelease'
import { normalizeCryptoError } from '@/services/matrix/crypto/cryptoErrorNormalize'
import { replayPersistedStrictness } from '@/services/matrix/crypto/strictDevicePolicyReplay'
import {
  isLocalUnlockConfigured,
  isLocalUnlockUnlocked,
  subscribeLocalUnlockState
} from '@/services/secure/localUnlockKey'
import { createLogger } from '@/utils/Logger'
import { MatrixCryptoStateTrackerCore, type RustCryptoCapableClient } from './MatrixCryptoStateTrackerCore'
import type { MatrixClient } from './sdk'

const logger = createLogger('MatrixCrypto')

/**
 * ensureCrypto 跨窗口互斥锁名称（Web Locks）。
 *
 * 背景：Tauri 多窗口架构中，每个 WebView 窗口有独立的 globalThis 和模块实例，
 * 导致 globalThis 级 mutex 无法跨窗口工作。而同源 IndexedDB 是**共享**的
 * （crypto store 的 DB 名固定为 `matrix-js-sdk::matrix-sdk-crypto` 等 3 个），
 * 多个窗口并发 `initRustCrypto` 会争抢同一组 DB，第二个可能卡到 8s 超时。
 *
 * 语义（2026-10-13 取证后订正，勿回退）：
 * - 本锁**只负责串行化** —— 让各窗口的 initRustCrypto 依次进行。
 * - ⚠️ 这里**没有**、也**不可能有**「其他窗口已初始化 ⇒ 本窗口跳过」的语义：
 *   每个 WebView 的 client 实例是独立的，`getCrypto()` 看不到别窗口的 crypto（恒 undefined）；
 *   且每个窗口都**必须**有自己的 OlmMachine 才能解密。历史上曾用 BroadcastChannel
 *   （`tjg-crypto-init`）实现该"跳过"，实测恒不可达（死代码），已删除。
 * - Web Locks 是浏览器原生提供的跨标签/窗口锁机制，同源所有窗口共享。
 *   Tauri macOS WKWebView（Safari 16.4+）支持此 API。
 */
const CRYPTO_LOCK_NAME = 'tjg-ensure-crypto'

/**
 * 检测 Web Locks API 是否可用。
 * 测试环境（Node.js/vitest）和旧浏览器可能不支持，需要 fallback。
 */
function isWebLocksAvailable(): boolean {
  return typeof navigator !== 'undefined' && navigator.locks != null && typeof navigator.locks.request === 'function'
}

/**
 * Crypto 初始化编排基类。
 */
export abstract class MatrixCryptoStateTrackerInit extends MatrixCryptoStateTrackerCore {
  /** 子类的实际初始化实现；由外层 {@link ensureCrypto} 负责串行化与超时包装。 */
  protected abstract doEnsureCrypto(cryptoClient: RustCryptoCapableClient, generation: number): Promise<void>

  /**
   * 初始化 Rust Crypto
   *
   * 隐藏的复杂实现：
   * - 检查 crypto 是否已可用（getCrypto()）
   * - 检查 initRustCrypto 方法是否存在
   * - 检查 userId/deviceId 是否完整
   * - IndexedDB 可用性检测
   * - 账户不匹配时清除旧 crypto store 后重试
   * - 全程更新 rustCryptoDebugState
   *
   * @param client MatrixClient 实例
   * @param hasAccessToken 是否有 access token（无 token 则跳过）
   */
  async ensureCrypto(client: MatrixClient | null, hasAccessToken: boolean): Promise<void> {
    if (!client || !hasAccessToken) {
      // D9：无可用 client 时同样解除状态归属，避免旧 client 的后台任务继续回写状态。
      this.bindClient(null)
      this.rustCryptoDebugState = {
        attempted: false,
        initialized: false,
        skippedReason: 'missing-client-or-access-token',
        error: null,
        usedIndexedDB: null,
        storeEncrypted: null
      }
      return
    }

    const cryptoClient = client as RustCryptoCapableClient

    // D9：状态必须归属于「当前这个 client」。换绑（登出后重登 / client 重建）时递增代次
    // 并清空旧状态，使旧 client 的初始化结果无法写到新会话上。
    const generation = this.bindClient(cryptoClient)

    // A1 复发哨兵（Batch 4.1）：已停止的 crypto 仍被绑定 ⇒ 复用同一 client 会让 E2EE 静默失效。
    recordStaleCryptoReuseIfAny(cryptoClient, this.lifecycle)

    const existingCrypto = typeof cryptoClient.getCrypto === 'function' ? cryptoClient.getCrypto() : null
    const existingCryptoStopped = (existingCrypto as { stopped?: boolean } | null)?.stopped === true

    if (existingCrypto && !existingCryptoStopped) {
      // 唯一的"已可用即不重复初始化"判据：只看**本窗口本 client** 是否已就绪。
      // 这是重复调用 ensureCrypto（同一 client）的真实护栏；跨窗口不适用（也做不到）。
      this.rustCryptoDebugState = {
        attempted: false,
        initialized: true,
        skippedReason: 'crypto-already-available',
        error: null,
        usedIndexedDB: null,
        storeEncrypted: null
      }
      // R-1：crypto 已可用 ⇒ 立刻重放用户的严格模式决定（该偏好不随 client 持久化）
      this.applyPersistedStrictness()
      return
    }

    if (existingCryptoStopped) {
      // D9：已停止的 backend 仍然非空，但 E2EE 已静默失效 —— 它绝不能算「已就绪」，
      // 否则 debug state 会谎报 initialized=true（真机形态：sync=SYNCING 但收发不加密）。
      // 先解绑（只允许清理已停止实例，不会泄漏运行中的 OlmMachine），再继续走重新初始化；
      // 解绑失败则如实报不可用。
      if (!this.releaseStoppedCryptoBinding(cryptoClient)) {
        this.writeState(generation, {
          attempted: true,
          initialized: false,
          skippedReason: 'crypto-stopped-but-still-bound',
          error: '已停止的 crypto 仍绑定在当前 client 上且无法解除，E2EE 不可用',
          usedIndexedDB: null,
          storeEncrypted: null
        })
        return
      }
    }

    if (typeof cryptoClient.initRustCrypto !== 'function') {
      this.rustCryptoDebugState = {
        attempted: false,
        initialized: false,
        skippedReason: 'init-method-unavailable',
        error: null,
        usedIndexedDB: null,
        storeEncrypted: null
      }
      return
    }

    const ENSURE_CRYPTO_TIMEOUT_MS = 8_000

    if (isWebLocksAvailable()) {
      // Web Locks 只做**串行化**：等别窗口释放锁，再执行本窗口自己的 initRustCrypto。
      // 不再有「其他窗口已完成 ⇒ 本窗口跳过」的判断（恒不可达，取证见 CRYPTO_LOCK_NAME 注释）；
      // 也不再有锁内复查 —— 同 client 重入由方法开头的 getCrypto() 早退 + startClient 的
      // IdempotencyGuard 覆盖，锁内复查只能看到本窗口这一个 client，等于重复判断。
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), ENSURE_CRYPTO_TIMEOUT_MS)

      try {
        await navigator.locks.request(CRYPTO_LOCK_NAME, { mode: 'exclusive', signal: controller.signal }, async () => {
          logger.info('获取到 crypto 锁，开始初始化 Rust Crypto')
          await this.doEnsureCrypto(cryptoClient, generation)
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          logger.warn(
            `ensureCrypto 超过 ${ENSURE_CRYPTO_TIMEOUT_MS}ms 未完成（等待其他窗口释放锁），转为后台继续（不阻塞 sync 启动）`
          )
          // 后台重新排队等锁（不超时）：锁释放后本窗口继续完成**自己的**初始化。
          navigator.locks
            .request(CRYPTO_LOCK_NAME, { mode: 'exclusive' }, async () => {
              logger.info('后台获取到 crypto 锁，开始初始化 Rust Crypto')
              await this.doEnsureCrypto(cryptoClient, generation)
            })
            .catch((e: unknown) => logger.warn(`后台 ensureCrypto 失败: ${normalizeCryptoError(e)}`))
        } else {
          throw err
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } else {
      // Fallback：无 Web Locks API（测试环境/旧浏览器），使用 Promise.race 超时
      const cryptoTask = this.doEnsureCrypto(cryptoClient, generation)
      const timeoutTask = new Promise<void>((resolve) => {
        setTimeout(() => {
          logger.warn(`ensureCrypto 超过 ${ENSURE_CRYPTO_TIMEOUT_MS}ms 未完成，转为后台继续（不阻塞 sync 启动）`)
          resolve()
        }, ENSURE_CRYPTO_TIMEOUT_MS)
      })
      await Promise.race([cryptoTask, timeoutTask])
    }

    // D9 守卫：initRustCrypto 已返回但 client 上没有 crypto 句柄，说明初始化结果没有回挂到
    // 当前 client（典型场景：登出后同页重登，旧的清理任务/旧 client 的初始化与新会话竞争）。
    // 此时必须把 initialized 改成 false，避免调试面板与业务判断误以为 E2EE 已就绪。
    const cryptoReady = typeof cryptoClient.getCrypto === 'function' && cryptoClient.getCrypto()
    if (this.isCurrentGeneration(generation) && !cryptoReady && this.rustCryptoDebugState.initialized) {
      const identity = `${cryptoClient.getUserId?.() ?? 'unknown'}:${cryptoClient.getDeviceId?.() ?? 'unknown'}`
      this.rustCryptoDebugState = {
        attempted: true,
        initialized: false,
        skippedReason: 'crypto-unavailable-after-init',
        error: `initRustCrypto 已返回，但当前 client 的 getCrypto() 为空（${identity}）`,
        usedIndexedDB: this.rustCryptoDebugState.usedIndexedDB,
        storeEncrypted: this.rustCryptoDebugState.storeEncrypted
      }
      logger.error(`Rust Crypto 初始化结果未回挂到当前 client（${identity}），已重置 initialized 标记`)
    }

    // R-1：初始化路径走完后重放用户的严格模式决定。crypto 若仍未就绪，
    // `reapplyPersistedStrictness` 内部会计为"暂不可应用"且不抛错 ——
    // 房间内横幅（`useRoomStrictness`）在进入加密房间时还会再施加一次。
    await this.applyPersistedStrictness()
  }

  /**
   * 重放持久化的「严格模式」偏好（R-1）。**尽力而为**：任何失败都不得影响 crypto 初始化
   * 本身的结论。实现放在 `strictDevicePolicyReplay`（那里用动态 import 规避模块环，勿内联）。
   */
  private async applyPersistedStrictness(): Promise<void> {
    await replayPersistedStrictness()
  }

  /**
   * D9：storageKey 缺失导致 fail-closed 后，挂一个**一次性**本地解锁监听，解锁完成时补初始化。
   *
   * 触发场景：冷启动先跳过本地解锁门禁 → 登录 → `getOrCreateCryptoStorageKey()` 返回 null
   * （密钥来源是本地解锁密码，但本会话未解锁）⇒ 原来只写 debug state 就返回，此后没有任何
   * 路径再触发 init，直到用户整页 reload。这里补上「解锁即可用」。
   *
   * 只在**确实配置了本地解锁**时挂监听；Secure Store 不可用等其它 fail-closed 原因无解锁事件，
   * 挂了也不会触发，但会增加噪音，故直接跳过。
   */
  protected armStorageKeyRetry(cryptoClient: RustCryptoCapableClient, generation: number): void {
    if (this.disarmStorageKeyRetry || !isLocalUnlockConfigured() || isLocalUnlockUnlocked()) {
      return
    }
    const unsubscribe = subscribeLocalUnlockState((unlocked) => {
      if (!unlocked) return
      unsubscribe()
      this.disarmStorageKeyRetry = null
      if (!this.isCurrentGeneration(generation)) {
        logger.info('本地解锁后的 crypto 补初始化已过期（client 已换绑/状态已重置），丢弃')
        return
      }
      logger.info('本地解锁完成，补一次 Rust Crypto 初始化（此前 storageKey 缺失已 fail-closed）')
      void this.doEnsureCrypto(cryptoClient, generation).catch((err: unknown) =>
        logger.warn(`本地解锁后的 crypto 补初始化失败: ${normalizeCryptoError(err)}`)
      )
    })
    this.disarmStorageKeyRetry = () => {
      unsubscribe()
      this.disarmStorageKeyRetry = null
    }
  }

  /**
   * 仅在「代次有效 + 当前 client 真的挂上了 crypto 句柄」时标记 initialized（D9）。
   *
   * 反例：登出后旧 client 的后台任务在本窗口完成 init，但业务侧 `getClient()` 已换成新
   * client —— 此时报 initialized=true 会让 E2EE 判据与真机脚本断言读到「状态与绑定脱钩」。
   */
  protected writeInitializedState(
    cryptoClient: RustCryptoCapableClient,
    generation: number,
    identity: string,
    usedIndexedDB: boolean,
    storeEncrypted: boolean,
    logMessage: string
  ): void {
    if (!this.isCurrentGeneration(generation)) {
      logger.warn(`${logMessage} 时 client 已换绑，丢弃结果（D9：避免状态与绑定脱钩）`)
      return
    }
    const cryptoHandle = typeof cryptoClient.getCrypto === 'function' ? cryptoClient.getCrypto() : null
    if (!cryptoHandle) {
      this.writeState(generation, {
        attempted: true,
        initialized: false,
        skippedReason: 'crypto-unavailable-after-init',
        error: `initRustCrypto 已返回，但 client 未挂载 crypto 句柄（${identity}）`,
        usedIndexedDB,
        storeEncrypted
      })
      logger.error(`${logMessage} 但 client 无 crypto 句柄（${identity}），不标记 E2EE 就绪`)
      return
    }
    this.writeState(generation, {
      attempted: true,
      initialized: true,
      skippedReason: null,
      error: null,
      usedIndexedDB,
      storeEncrypted
    })
    logger.info(`${logMessage}: ${identity}`)
  }
}
