/**
 * Crypto 调试状态类型（从 `MatrixCryptoStateTracker` 抽出，Batch 4.2）。
 *
 * 抽出的原因：这两个接口是**对外可观测契约**（`MatrixClientService` / `MatrixClientState`
 * 直接 import 它们），与 tracker 的内部实现细节无关；留在 tracker 里会让该文件长期贴警戒线。
 *
 * 不依赖 `matrix-js-sdk`，故不受 `check:sdk-boundary` 约束。
 */

/** rustCryptoDebugState：Rust Crypto 初始化的可观测状态。 */
export interface RustCryptoDebugState {
  attempted: boolean
  initialized: boolean
  skippedReason: string | null
  error: string | null
  usedIndexedDB: boolean | null
  /**
   * crypto store 是否以加密方式打开。
   *
   * `true` = 提供了 32 字节 storageKey；`false` = keychain 不可用，store 未加密
   * （私钥与房间密钥将以明文落盘）；`null` = 未尝试。
   *
   * 之所以要显式暴露：SDK 只对「未加密的**内存** store」默认拒绝，
   * 未加密的 **IndexedDB** store 是被静默允许的 —— 若不把它暴露出来，
   * 生产环境的密钥库降级将没有任何可观测信号。
   */
  storeEncrypted: boolean | null
}

/** eventDecryptedDebugState：事件解密结果的可观测状态。 */
export interface EventDecryptedDebugState {
  count: number
  lastEventId: string | null
  lastRoomId: string | null
  lastError: string | null
}

/**
 * 构造「初始（未尝试）」的 Rust Crypto 状态。
 *
 * 用工厂而非共享常量：tracker 里多处会把它赋给实例字段并随后整体替换，
 * 共享可变对象容易被就地改写而互相污染。
 */
export function createInitialRustCryptoDebugState(): RustCryptoDebugState {
  return {
    attempted: false,
    initialized: false,
    skippedReason: null,
    error: null,
    usedIndexedDB: null,
    storeEncrypted: null
  }
}

/** 构造「初始」的事件解密状态（见 {@link createInitialRustCryptoDebugState} 的说明）。 */
export function createInitialEventDecryptedDebugState(): EventDecryptedDebugState {
  return { count: 0, lastEventId: null, lastRoomId: null, lastError: null }
}
