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
 * 结构（拆分自原 712 行单文件）：
 * - 状态归属 / 代次守卫 / 调试快照 / 重置与登出清理 → `MatrixCryptoStateTrackerCore`
 * - Web Locks 串行化 / 超时与后台续跑 / 解锁补初始化 → `MatrixCryptoStateTrackerInit`
 * - storageKey 获取 / 旧 store 提前清理 / 失败清理重试 → `crypto/rustCryptoInit`（Batch 4.3）
 * - 本文件仅保留 `doEnsureCrypto` 的状态机编排与调试状态写入
 *
 * @see codebase-design — 深模块：ensureCrypto/handleEventDecrypted/getDebugState 小接口 +
 * IndexedDB 清理重试 + crypto 状态机复杂实现
 */
import type { RustCryptoInitClient } from '@/services/matrix/crypto/rustCryptoInit'
import { initRustCryptoWithCleanupRetry, prepareRustCryptoStore } from '@/services/matrix/crypto/rustCryptoInit'
import { createLogger } from '@/utils/Logger'
import { rejectMissingStorageKeyState } from './cryptoDebugState'
import type { RustCryptoCapableClient } from './MatrixCryptoStateTrackerCore'
import { MatrixCryptoStateTrackerInit } from './MatrixCryptoStateTrackerInit'

const logger = createLogger('MatrixCrypto')

// 这两个状态类型已抽到 crypto/cryptoDebugStateTypes.ts（Batch 4.2）；
// 此处 re-export 保持既有 import 点（MatrixClientService / MatrixClientState）不变。
export type { EventDecryptedDebugState, RustCryptoDebugState } from './crypto/cryptoDebugStateTypes'

/**
 * Crypto 状态追踪器
 *
 * 深模块：小接口（ensureCrypto/handleEventDecrypted/getState）+ 大实现
 * （Rust Crypto 初始化、IndexedDB 清理重试、账户不匹配处理、状态追踪）
 */
export class MatrixCryptoStateTracker extends MatrixCryptoStateTrackerInit {
  /**
   * 实际执行 `initRustCrypto`：准备 store → 初始化 → 按结果写调试状态。
   *
   * 由外层 `ensureCrypto` 用 Web Locks / Promise.race 包装超时；超时后此任务仍会在
   * 后台继续执行（fire-and-forget），最终更新 rustCryptoDebugState。
   */
  protected override async doEnsureCrypto(cryptoClient: RustCryptoCapableClient, generation: number): Promise<void> {
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

    // storageKey 获取 + 旧 store 提前清理（细节见 crypto/rustCryptoInit.ts）。
    const prepared = await prepareRustCryptoStore({ userId, deviceId, useIndexedDB })

    if (!prepared.storageKey) {
      // fail-closed：拿不到 storageKey 时不写明文（原因与恢复路径见 cryptoDebugState.ts）
      this.writeState(generation, rejectMissingStorageKeyState(userId, deviceId, useIndexedDB))
      // D9：本地解锁密码来源但本会话尚未解锁时，storageKey 就是 null。
      // 只报状态不够 —— 用户随后解锁后没人再触发 init，整个会话都拿不到 E2EE。
      this.armStorageKeyRetry(cryptoClient, generation, userId, deviceId)
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
      storeEncrypted: prepared.storeEncrypted
    })

    const outcome = await initRustCryptoWithCleanupRetry(cryptoClient as RustCryptoInitClient, {
      userId,
      useIndexedDB,
      storageKey: prepared.storageKey
    })

    if (outcome.ok) {
      this.writeInitializedState(
        cryptoClient,
        generation,
        prepared.identity,
        useIndexedDB,
        prepared.storeEncrypted,
        outcome.retried ? 'Rust Crypto 重试初始化完成' : 'Rust Crypto 初始化完成'
      )
      return
    }

    this.writeState(generation, {
      attempted: true,
      initialized: false,
      skippedReason: null,
      error: outcome.error,
      usedIndexedDB: useIndexedDB,
      storeEncrypted: prepared.storeEncrypted
    })
  }
}
