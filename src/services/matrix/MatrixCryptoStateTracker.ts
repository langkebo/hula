/**
 * MatrixCryptoStateTracker — Crypto 调试状态追踪深模块
 *
 * 职责：
 * - 初始化 Rust Crypto（含 IndexedDB 清理重试逻辑）
 * - 追踪 rustCryptoDebugState（attempted/initialized/skippedReason/error/usedIndexedDB）
 * - 追踪 eventDecryptedDebugState（count/lastEventId/lastRoomId/lastError）
 *
 * 不负责：
 * - 连接状态管理（由 ConnectionManager 负责）
 * - 事件路由（由 MatrixEventRouter 负责）
 *
 * @see codebase-design — 深模块：ensureCrypto/handleEventDecrypted/getDebugState 小接口 +
 * IndexedDB 清理重试 + crypto 状态机复杂实现
 */
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import {
  recordStaleCryptoReuseIfAny,
  releaseStoppedCryptoBinding as releaseBinding
} from '@/services/matrix/crypto/cryptoBindingRelease'
import {
  createInitialEventDecryptedDebugState,
  createInitialRustCryptoDebugState,
  type EventDecryptedDebugState,
  type RustCryptoDebugState
} from '@/services/matrix/crypto/cryptoDebugStateTypes'
import { normalizeCryptoError } from '@/services/matrix/crypto/cryptoErrorNormalize'
import {
  type CryptoLifecycleDiagnostics,
  CryptoLifecycleDiagnosticsTracker
} from '@/services/matrix/crypto/cryptoLifecycleDiagnostics'
import {
  clearLastCryptoUser,
  readLastCryptoEncrypted,
  readLastCryptoUser,
  writeLastCryptoEncrypted,
  writeLastCryptoUser
} from '@/services/matrix/crypto/cryptoLocalState'
import { clearStaleCryptoStores } from '@/services/matrix/crypto/cryptoStoreCleanup'
import { replayPersistedStrictness } from '@/services/matrix/crypto/strictDevicePolicyReplay'
import { getOrCreateCryptoStorageKey, logCryptoStorageKeyBackend } from '@/services/secure/cryptoStorageKey'
import { createLogger } from '@/utils/Logger'
import { rejectMissingStorageKeyState } from './cryptoDebugState'

const logger = createLogger('MatrixCrypto')

// 这两个状态类型已抽到 crypto/cryptoDebugStateTypes.ts（Batch 4.2）；
// 此处 re-export 保持既有 import 点（MatrixClientService / MatrixClientState）不变。
export type { EventDecryptedDebugState, RustCryptoDebugState } from './crypto/cryptoDebugStateTypes'

/**
 * 本文件对 `initRustCrypto` 的最小依赖面。
 *
 * 必须与 SDK 契约一致（`matrix-js-sdk/lib/client.d.ts` 的 `initRustCrypto(args?)`）：
 * 历史缺陷是本类型只声明了 `{ useIndexedDB, storagePassword }`，于是**结构上**
 * 无法传入被 SDK 文档首推的 `storageKey`，把"用慢 KDF 处理随机密钥"变成了唯一选项。
 */
type RustCryptoCapableClient = MatrixClient & {
  getCrypto?: () => unknown
  initRustCrypto?: (args?: {
    useIndexedDB?: boolean
    cryptoDatabasePrefix?: string
    storageKey?: Uint8Array
    storagePassword?: string
    allowInMemoryStore?: boolean
  }) => Promise<void>
}

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

/** 状态的内部可变字段；账号/设备归属在读取时由当前 owner client 补全（D9）。 */
type CryptoDebugStateFields = Omit<RustCryptoDebugState, 'userId' | 'deviceId'>

/** 把 client 的账号与设备拼成绑定身份；缺一不可，否则无法判定归属。 */
function resolveClientIdentity(client: MatrixClient | null): string | null {
  if (!client) return null
  const userId = client.getUserId?.()
  const deviceId = client.getDeviceId?.()
  return userId && deviceId ? `${userId}:${deviceId}` : null
}

/**
 * Crypto 状态追踪器
 *
 * 深模块：小接口（ensureCrypto/handleEventDecrypted/getState）+ 大实现
 * （Rust Crypto 初始化、IndexedDB 清理重试、账户不匹配处理、状态追踪）
 */
export class MatrixCryptoStateTracker {
  private rustCryptoDebugState: CryptoDebugStateFields = createInitialRustCryptoDebugState()

  private eventDecryptedDebugState: EventDecryptedDebugState = {
    count: 0,
    lastEventId: null,
    lastRoomId: null,
    lastError: null
  }

  /**
   * 当前 crypto 状态所归属的 client（D9）。
   *
   * `rustCryptoDebugState` 是窗口级单例：同一页面内「登出 → 登录」会复用同一个 tracker，
   * 而后台 Web Locks 续跑任务持有旧 client 的闭包。没有归属信息时，旧 client 的
   * `initRustCrypto` 成功会把 `initialized=true` 写到新会话上，而新会话的
   * `getClient().getCrypto()` 仍为 null —— 即「状态与绑定脱钩」。
   */
  private stateOwnerClient: MatrixClient | null = null

  /** 状态归属的账号:设备；与 {@link stateOwnerClient} 一起判定换绑（D9）。 */
  private stateOwnerIdentity: string | null = null

  /** 状态代次：换绑 client / resetState 时递增，用于丢弃跨会话的后台续跑写入。 */
  private stateGeneration = 0

  /** 生命周期诊断（Batch 4.1，详见 crypto/cryptoLifecycleDiagnostics.ts）：让失配在运行期可见。 */
  private readonly lifecycle = new CryptoLifecycleDiagnosticsTracker()

  /**
   * 把状态归属绑定到调用方传入的 client（D9）。
   *
   * 换绑时递增代次并清空旧状态：旧 client 的后台续跑任务持有旧代次，
   * 其结论会被 {@link writeState} 丢弃，不会污染新会话。
   */
  private bindClient(client: MatrixClient | null): number {
    const identity = resolveClientIdentity(client)
    // 同一 client 引用但账号/设备变了（凭据被换写）同样视为换绑：
    // 否则旧账号的 initialized=true 会被当成新账号的 crypto 就绪。
    const identityChanged =
      identity !== null && this.stateOwnerIdentity !== null && identity !== this.stateOwnerIdentity

    if (client !== this.stateOwnerClient || identityChanged) {
      this.stateOwnerClient = client
      this.stateOwnerIdentity = identity
      this.stateGeneration += 1
      this.rustCryptoDebugState = createInitialRustCryptoDebugState()
    } else if (this.stateOwnerIdentity === null) {
      // 首次绑定时 client 可能尚未带上 userId/deviceId，补齐但不重置状态。
      this.stateOwnerIdentity = identity
    }
    return this.stateGeneration
  }

  /** 代次仍是当前值才允许写状态；过期任务（client 已换绑 / 已重置）一律不得回写。 */
  private isCurrentGeneration(generation: number): boolean {
    return generation === this.stateGeneration
  }

  /** 仅当代次有效时写入状态：过期任务的结论属于已作废的 client。 */
  private writeState(generation: number, next: CryptoDebugStateFields): void {
    if (this.isCurrentGeneration(generation)) {
      this.rustCryptoDebugState = next
    }
  }

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
   * ensureCrypto 的实际实现，被外层 ensureCrypto 用 Promise.race 包装超时。
   * 超时后此任务仍会在后台继续执行（fire-and-forget），最终更新 rustCryptoDebugState。
   */
  private async doEnsureCrypto(cryptoClient: RustCryptoCapableClient, generation: number): Promise<void> {
    // 本方法**不做任何跨窗口判定**：既不等别窗口、也不因别窗口已完成而跳过。
    // 理由见 CRYPTO_LOCK_NAME 注释（每窗口独立 OlmMachine；本窗口 getCrypto() 看不到别窗口）。
    // 跨窗口只由外层 Web Locks 串行化。

    // D9：等锁/排队期间可能已登出或换号，过期任务不得再初始化，更不得回写状态。
    if (!this.isCurrentGeneration(generation)) {
      logger.info('crypto 初始化任务已过期（client 已换绑/状态已重置），丢弃')
      return
    }

    const userId = cryptoClient.getUserId?.()
    const deviceId = cryptoClient.getDeviceId?.()
    if (!userId || !deviceId) {
      this.writeState(generation, {
        attempted: false,
        initialized: false,
        skippedReason: 'missing-user-or-device-id',
        error: null,
        usedIndexedDB: null,
        storeEncrypted: null
      })
      logger.warn('缺少 userId 或 deviceId，跳过 Rust Crypto 初始化')
      return
    }

    const useIndexedDB = typeof globalThis.indexedDB !== 'undefined'

    // H1 修复：检查 userId:deviceId 是否变化，变化时主动清理旧 crypto store
    // 原 BUG：localStorage 仅存储 userId，同一用户换设备登录时
    // lastCryptoUser === userId 为 true，主动清理未触发，
    // 导致 initRustCrypto 报 "account in the store doesn't match" 错误，
    // 登录耗时 51s（crypto 重试循环 + 超时等待）。
    // 修复：localStorage 改为存储 userId:deviceId，换设备时触发清理。
    const cryptoUserKey = `${userId}:${deviceId}`
    const lastCryptoUser = readLastCryptoUser()

    // ISSUE-08 对接：从系统 keychain 取 **32 字节 storageKey**，加密 IndexedDB crypto store
    // 和待发事件队列（PendingEventsCipher）。keychain 不可用时降级为不加密（dev/浏览器）。
    //
    // 加密原语标记（2026-10-12 迁移，见 cryptoStorageKey.ts）：
    //   `k1` = storageKey（32 字节原始密钥，SDK 文档首推）
    //   `p1` / `1` / `0` = 历史标记（`storagePassword` 或"无密钥"）
    // 两类原语派生出的**实际加密密钥不同** ⇒ 只比较"是否加密"发现不了原语切换，
    // 会把"密钥换了却继续打开旧 store"推迟到 initRustCrypto 失败才发现。故把原语编进标记。
    const storageKey = await getOrCreateCryptoStorageKey(userId, deviceId)
    const storeEncrypted = storageKey !== null
    const currentEncrypted = storeEncrypted ? 'k1' : '0'
    const lastEncrypted = readLastCryptoEncrypted()

    // 提前清理：以下情况在 initRustCrypto 之前清理旧 store，避免第一次失败+重试耗时
    // 1. userId:deviceId 变化（换设备登录）
    // 2. 加密状态 / 加密原语变化（上次不加密→这次加密、或 storageKey↔storagePassword 切换）
    //    常见场景：macOS dev 模式 keychain 不稳定，上次 keychain 不可用（不加密），
    //    这次 keychain 可用（有密钥），用新密钥打开旧不加密 store 会报
    //    "An object failed to be decrypted while unpickling"
    const userChanged = lastCryptoUser !== cryptoUserKey
    const encryptedChanged =
      lastCryptoUser === cryptoUserKey && lastEncrypted !== null && lastEncrypted !== currentEncrypted
    if (useIndexedDB && (userChanged || encryptedChanged)) {
      const reason = userChanged
        ? `用户/设备变化（${lastCryptoUser} → ${cryptoUserKey}）`
        : `加密状态/原语变化（${lastEncrypted} → ${currentEncrypted}）`
      logger.info(`检测到 crypto ${reason}，提前清理旧 crypto store 避免 initRustCrypto 失败`)
      await clearStaleCryptoStores(userId)
    }
    if (userChanged || encryptedChanged || lastEncrypted === null) {
      writeLastCryptoUser(cryptoUserKey)
      writeLastCryptoEncrypted(currentEncrypted)
    }

    if (storeEncrypted) {
      await logCryptoStorageKeyBackend(userId, deviceId)
    } else {
      // fail-closed：拿不到 storageKey 时不写明文（原因与恢复路径见 cryptoDebugState.ts）
      this.writeState(generation, rejectMissingStorageKeyState(userId, deviceId, useIndexedDB))
      return
    }

    // storageKey / IndexedDB 清理都是异步 IPC，期间可能已登出或换号：初始化前再次核对代次。
    if (!this.isCurrentGeneration(generation)) {
      logger.info('crypto 初始化任务在准备阶段过期（client 已换绑/状态已重置），丢弃')
      return
    }

    this.writeState(generation, {
      attempted: true,
      initialized: false,
      skippedReason: null,
      error: null,
      usedIndexedDB: useIndexedDB,
      storeEncrypted: storeEncrypted
    })

    try {
      await cryptoClient.initRustCrypto(storageKey ? { useIndexedDB, storageKey } : { useIndexedDB })
      this.writeInitializedState(
        cryptoClient,
        generation,
        cryptoUserKey,
        useIndexedDB,
        storeEncrypted,
        'Rust Crypto 初始化完成'
      )
    } catch (err) {
      const errMsg = normalizeCryptoError(err)
      // WASM 抛出的错误通常是空对象 {}（wasm-bindgen 转换），
      // String({}) = "[object Object]" 无法匹配具体错误字符串，
      // 因此 initRustCrypto 失败且 IndexedDB 可用时，无条件清理旧 store 后重试一次。
      // 常见触发场景：
      //   - "account in the store doesn't match"（换设备登录，旧 store 残留）
      //   - "An object failed to be decrypted while unpickling"（storageKey 跨会话不一致）
      //   - store 损坏 / 版本不兼容
      if (useIndexedDB) {
        logger.warn(`Rust Crypto 初始化失败（${errMsg}），尝试清除旧 crypto 数据后重试...`)
        try {
          const cleanupResult = await clearStaleCryptoStores(userId)
          // 等待浏览器释放 IndexedDB 连接句柄，避免重试时数据库仍被占用。
          // 如果有数据库删除失败/超时（通常是 meta 被 SDK 持有），
          // 延长等待时间到 1s，给 WASM 释放连接更多时间。
          const waitMs = cleanupResult.failed > 0 || cleanupResult.blocked > 0 ? 1_000 : 100
          if (waitMs > 100) {
            logger.warn(
              `IndexedDB 清理部分失败 (failed=${cleanupResult.failed}, blocked=${cleanupResult.blocked})，等待 ${waitMs}ms 后重试`
            )
          }
          await new Promise((resolve) => setTimeout(resolve, waitMs))
          await cryptoClient.initRustCrypto(storageKey ? { useIndexedDB, storageKey } : { useIndexedDB })
          this.writeInitializedState(
            cryptoClient,
            generation,
            cryptoUserKey,
            useIndexedDB,
            storeEncrypted,
            'Rust Crypto 重试初始化完成'
          )
          return
        } catch (retryErr) {
          const retryMsg = normalizeCryptoError(retryErr)
          this.writeState(generation, {
            attempted: true,
            initialized: false,
            skippedReason: null,
            error: retryMsg,
            usedIndexedDB: useIndexedDB,
            storeEncrypted: storeEncrypted
          })
          logger.warn(`Rust Crypto 重试仍失败，继续以非加密模式启动: ${retryMsg}`)
          return
        }
      }
      this.writeState(generation, {
        attempted: true,
        initialized: false,
        skippedReason: null,
        error: errMsg,
        usedIndexedDB: useIndexedDB,
        storeEncrypted: storeEncrypted
      })
      logger.warn(`Rust Crypto 初始化失败，继续以非加密模式启动: ${errMsg}`)
    }
  }

  /**
   * 仅在「代次有效 + 当前 client 真的挂上了 crypto 句柄」时标记 initialized（D9）。
   *
   * 反例：登出后旧 client 的后台任务在本窗口完成 init，但业务侧 `getClient()` 已换成新
   * client —— 此时报 initialized=true 会让 E2EE 判据与真机脚本断言读到「状态与绑定脱钩」。
   */
  private writeInitializedState(
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

  /**
   * 处理 Event.decrypted 事件
   *
   * 更新 eventDecryptedDebugState（count/lastEventId/lastRoomId/lastError）
   */
  handleEventDecrypted(event: MatrixEvent, err?: Error): void {
    const roomId = event.getRoomId()
    this.eventDecryptedDebugState = {
      count: this.eventDecryptedDebugState.count + 1,
      lastEventId: event.getId() ?? null,
      lastRoomId: roomId ?? null,
      lastError: err?.message ?? null
    }
  }

  /** 获取 Rust Crypto 调试状态
   */
  getRustCryptoDebugState(): RustCryptoDebugState {
    const owner = this.stateOwnerClient
    // D9：状态必须自证归属，调用方才能判断 initialized 属于当前会话还是上一个会话。
    return {
      ...this.rustCryptoDebugState,
      userId: owner?.getUserId?.() ?? null,
      deviceId: owner?.getDeviceId?.() ?? null
    }
  }

  /** 获取事件解密调试状态
   */
  getEventDecryptedDebugState(): EventDecryptedDebugState {
    return { ...this.eventDecryptedDebugState }
  }

  /**
   * 解除「已停止的 crypto 绑定」，使**同一个 client** 能重新 `initRustCrypto`。
   *
   * 只在「复用同一 client 重启 sync」的路径上需要（当前唯一调用点：
   * `MatrixClientLifecycle.forceReconnect`，系统唤醒时触发）。SDK 契约（实测
   * node_modules/matrix-js-sdk/lib/client-lifecycle-stop.js，不要凭上游印象改）：
   * `stopClient()` → `releaseCryptoBackend()` 会 `cryptoBackend.stop()` 并**清空**
   * `client.cryptoBackend`（A3）⇒ 正常时序下本方法看到 `getCrypto() === undefined`，
   * 属于 no-op 兜底；保留它是为了 SDK 若回退成「只停不清」时仍能救回 E2EE
   * （那种情况下 `initRustCrypto()` 见非空会 warn + return，静默解不开新消息）。
   *
   * ⚠️ 只应在 `client.stopClient()` **之后**调用。若 crypto 仍在运行（`stopped !== true`），
   * 本方法拒绝解除并告警 —— 否则会让活着的 OlmMachine / IndexedDB 连接泄漏。
   *
   * @returns 是否真的解除了绑定（便于调用方观测与测试）
   */
  releaseStoppedCryptoBinding(client: MatrixClient | null): boolean {
    const outcome = releaseBinding(client as { cryptoBackend?: unknown; getCrypto?: () => unknown } | null)
    if (outcome.ok) {
      this.lifecycle.recordBindingReleased()
      logger.info('已解除已停止的 crypto 绑定，允许同一 client 重新 initRustCrypto')
      return true
    }
    if (outcome.reason === 'crypto-not-stopped') {
      this.lifecycle.rejectBindingRelease(outcome.reason)
      logger.warn(
        'releaseStoppedCryptoBinding 在 crypto 未处于已停止状态时被调用，已跳过（只应在 stopClient 之后调用）'
      )
    }
    return false
  }

  /** 取 crypto 生命周期诊断快照（Batch 4.1）：供 service → store 在运行期读取，使失配不再只在日志里可见。 */
  getCryptoLifecycleDiagnostics(): CryptoLifecycleDiagnostics {
    return this.lifecycle.snapshot()
  }

  /** 重置加密状态追踪器
   */
  resetState(): void {
    // D9：重置同时解除 client 归属并推进代次，使旧 client 的后台续跑任务无法再回写状态。
    this.stateOwnerClient = null
    this.stateOwnerIdentity = null
    this.stateGeneration += 1
    this.rustCryptoDebugState = createInitialRustCryptoDebugState()
    this.eventDecryptedDebugState = createInitialEventDecryptedDebugState()
    this.lifecycle.reset()
  }

  /**
   * 登出时清除 crypto store 记录。
   *
   * 清除 localStorage 中的 lastCryptoUserId 记录，
   * 并删除该用户的 crypto IndexedDB 数据库，确保下次登录时从干净状态开始。
   *
   * @param userId 登出用户的 userId
   */
  async clearCryptoStoreForLogout(userId: string): Promise<void> {
    clearLastCryptoUser()
    if (typeof globalThis.indexedDB !== 'undefined') {
      try {
        const result = await clearStaleCryptoStores(userId)
        if (result.failed > 0 || result.blocked > 0) {
          logger.warn(
            `登出清理部分失败: ${userId} (已删除=${result.deleted}, 失败=${result.failed}, 被阻塞=${result.blocked})`
          )
        } else {
          logger.info(`登出清理完成: ${userId} (已删除 ${result.deleted} 个数据库)`)
        }
      } catch (err) {
        logger.error(`登出清理 IndexedDB 异常: ${userId}`, err)
      }
    } else {
      logger.info(`登出清理完成（无 IndexedDB）: ${userId}`)
    }
  }
}
