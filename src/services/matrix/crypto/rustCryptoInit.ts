/**
 * Rust Crypto 初始化步骤（从 `MatrixCryptoStateTracker` 下沉，Batch 4.3）。
 *
 * 抽出的原因：storageKey 获取、旧 store 提前清理、失败后「清理 + 重试」这三段
 * 都是与状态机无关的 IO 编排，留在 tracker 里让 `doEnsureCrypto` 同时承担
 * 「准备环境」与「写调试状态」两件事，既不直观也难以单独验证。
 *
 * 本模块只做两件事，且都不写调试状态：
 *   1. {@link prepareRustCryptoStore}：取 storageKey，并按身份 / 加密原语变化提前清理旧 store；
 *   2. {@link initRustCryptoWithCleanupRetry}：调用 `initRustCrypto`，失败时清理重试一次。
 *
 * 不依赖 `matrix-js-sdk` 运行时（仅类型引用），故不受 `check:sdk-boundary` 约束。
 */
import { getOrCreateCryptoStorageKey, logCryptoStorageKeyBackend } from '@/services/secure/cryptoStorageKey'
import { createLogger } from '@/utils/Logger'
import type { RustCryptoCapableClient } from '../MatrixCryptoStateTrackerCore'
import { normalizeCryptoError } from './cryptoErrorNormalize'
import {
  readLastCryptoEncrypted,
  readLastCryptoUser,
  writeLastCryptoEncrypted,
  writeLastCryptoUser
} from './cryptoLocalState'
import { clearStaleCryptoStores } from './cryptoStoreCleanup'

const logger = createLogger('MatrixCrypto')

/** 调用方已确认 `initRustCrypto` 存在；这里把它收窄成必选，避免重复判空。 */
export type RustCryptoInitClient = RustCryptoCapableClient & {
  initRustCrypto: NonNullable<RustCryptoCapableClient['initRustCrypto']>
}

export interface PrepareRustCryptoStoreParams {
  userId: string
  deviceId: string
  useIndexedDB: boolean
}

export interface RustCryptoStorePreparation {
  /** 系统 keychain 取到的 32 字节密钥；null 表示本次必须 fail-closed（由调用方处理） */
  storageKey: Uint8Array | null
  /** 是否以加密 store 初始化，用于写入调试状态 */
  storeEncrypted: boolean
  /** `userId:deviceId`，用于写 initialized 状态时的归属说明 */
  identity: string
}

/**
 * 准备 crypto store：取 storageKey、按需提前清理旧库、回写身份标记。
 *
 * 提前清理的两种场景（都在 `initRustCrypto` 之前做，省掉「失败 → 清理 → 重试」的耗时）：
 *   1. `userId:deviceId` 变化（同一用户换设备登录，旧 store 残留会报 account mismatch）；
 *   2. 加密状态 / 加密原语变化（上次不加密→这次加密，或 storageKey↔storagePassword 切换）。
 *
 * 加密原语标记（见 `cryptoStorageKey.ts`）：`k1` = storageKey，`p1`/`1`/`0` = 历史标记。
 * 只比较「是否加密」发现不了原语切换，所以把原语编进标记。
 */
export async function prepareRustCryptoStore({
  userId,
  deviceId,
  useIndexedDB
}: PrepareRustCryptoStoreParams): Promise<RustCryptoStorePreparation> {
  const identity = `${userId}:${deviceId}`
  const lastCryptoUser = readLastCryptoUser()

  // ISSUE-08 对接：keychain 不可用时返回 null，由调用方 fail-closed（不写明文 store）。
  const storageKey = await getOrCreateCryptoStorageKey(userId, deviceId)
  const storeEncrypted = storageKey !== null
  const currentEncrypted = storeEncrypted ? 'k1' : '0'
  const lastEncrypted = readLastCryptoEncrypted()

  const userChanged = lastCryptoUser !== identity
  const encryptedChanged = lastCryptoUser === identity && lastEncrypted !== null && lastEncrypted !== currentEncrypted

  if (useIndexedDB && (userChanged || encryptedChanged)) {
    const reason = userChanged
      ? `用户/设备变化（${lastCryptoUser} → ${identity}）`
      : `加密状态/原语变化（${lastEncrypted} → ${currentEncrypted}）`
    logger.info(`检测到 crypto ${reason}，提前清理旧 crypto store 避免 initRustCrypto 失败`)
    await clearStaleCryptoStores(userId)
  }
  if (userChanged || encryptedChanged || lastEncrypted === null) {
    writeLastCryptoUser(identity)
    writeLastCryptoEncrypted(currentEncrypted)
  }

  if (storeEncrypted) {
    await logCryptoStorageKeyBackend(userId, deviceId)
  }

  return { storageKey, storeEncrypted, identity }
}

export interface InitRustCryptoParams {
  userId: string
  useIndexedDB: boolean
  /** 调用方已确认非 null（无密钥在准备阶段就 fail-closed） */
  storageKey: Uint8Array | null
}

export type RustCryptoInitOutcome = { ok: true; retried: boolean } | { ok: false; error: string; retried: boolean }

/**
 * 调用 `initRustCrypto`；失败且 IndexedDB 可用时，清理旧 store 后重试一次。
 *
 * WASM 抛出的错误通常是空对象 `{}`（wasm-bindgen 转换），无法按具体错误字符串分支，
 * 因此只要 IndexedDB 可用就无条件清理重试。常见触发场景：
 *   - "account in the store doesn't match"（换设备登录，旧 store 残留）
 *   - "An object failed to be decrypted while unpickling"（storageKey 跨会话不一致）
 *   - store 损坏 / 版本不兼容
 *
 * @returns 成功/失败与错误串；失败串已归一化，供调用方写入调试状态
 */
export async function initRustCryptoWithCleanupRetry(
  client: RustCryptoInitClient,
  { userId, useIndexedDB, storageKey }: InitRustCryptoParams
): Promise<RustCryptoInitOutcome> {
  const args = { useIndexedDB, ...(storageKey ? { storageKey } : {}) }

  try {
    await client.initRustCrypto(args)
    return { ok: true, retried: false }
  } catch (err) {
    const errMsg = normalizeCryptoError(err)

    if (!useIndexedDB) {
      logger.warn(`Rust Crypto 初始化失败，继续以非加密模式启动: ${errMsg}`)
      return { ok: false, error: errMsg, retried: false }
    }

    logger.warn(`Rust Crypto 初始化失败（${errMsg}），尝试清除旧 crypto 数据后重试...`)
    try {
      const cleanupResult = await clearStaleCryptoStores(userId)
      // 等待浏览器释放 IndexedDB 连接句柄，避免重试时数据库仍被占用。
      // 如果有数据库删除失败/超时（通常是 meta 被 SDK 持有），延长等待到 1s。
      const waitMs = cleanupResult.failed > 0 || cleanupResult.blocked > 0 ? 1_000 : 100
      if (waitMs > 100) {
        logger.warn(
          `IndexedDB 清理部分失败 (failed=${cleanupResult.failed}, blocked=${cleanupResult.blocked})，等待 ${waitMs}ms 后重试`
        )
      }
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      await client.initRustCrypto(args)
      return { ok: true, retried: true }
    } catch (retryErr) {
      const retryMsg = normalizeCryptoError(retryErr)
      logger.warn(`Rust Crypto 重试仍失败，继续以非加密模式启动: ${retryMsg}`)
      return { ok: false, error: retryMsg, retried: true }
    }
  }
}
