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
 * - 本文件仅保留 `initRustCrypto` 的实际实现（storageKey、IndexedDB 清理重试）
 *
 * @see codebase-design — 深模块：ensureCrypto/handleEventDecrypted/getDebugState 小接口 +
 * IndexedDB 清理重试 + crypto 状态机复杂实现
 */
import { normalizeCryptoError } from '@/services/matrix/crypto/cryptoErrorNormalize'
import {
  readLastCryptoEncrypted,
  readLastCryptoUser,
  writeLastCryptoEncrypted,
  writeLastCryptoUser
} from '@/services/matrix/crypto/cryptoLocalState'
import { clearStaleCryptoStores } from '@/services/matrix/crypto/cryptoStoreCleanup'
import { getOrCreateCryptoStorageKey, logCryptoStorageKeyBackend } from '@/services/secure/cryptoStorageKey'
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
   * 实际执行 `initRustCrypto`：storageKey 获取、旧 store 提前清理、失败清理重试。
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
      // D9：本地解锁密码来源但本会话尚未解锁时，storageKey 就是 null。
      // 只报状态不够 —— 用户随后解锁后没人再触发 init，整个会话都拿不到 E2EE。
      this.armStorageKeyRetry(cryptoClient, generation)
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
}
