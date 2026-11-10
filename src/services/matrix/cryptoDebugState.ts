import { createLogger } from '@/utils/Logger'
import type { RustCryptoDebugState } from './MatrixCryptoStateTracker'

const logger = createLogger('CryptoDebugState')

/**
 * 拿不到 storageKey 时的 crypto 调试状态（F-4 / B1，fail-closed）。
 *
 * 从 `MatrixCryptoStateTracker` 抽出：该文件已超 400 行硬限且不得增长。
 *
 * 背景：历史行为是「只记一条 error 日志，然后 initRustCrypto({ useIndexedDB })」，
 * 而 SDK 对未加密的 IndexedDB store 是**静默允许**的 —— 设备私钥与房间密钥会以明文落盘。
 * 现在的行为是**拒绝初始化**：代价是本次会话 E2EE 不可用，
 * 但这正是「宁可不可用，也不要偷偷把私钥写进明文文件」。
 *
 * 恢复路径由 UI 的本地解锁门禁提供（设置/输入本地解锁密码后重新登录）。
 */
/**
 * 拿不到 storageKey 时的 crypto 调试状态（F-4 / B1，fail-closed）。
 *
 * 历史行为：只记一条 error 日志，然后 initRustCrypto({ useIndexedDB }) ——
 * SDK 对「未加密的 IndexedDB store」是**静默允许**的，于是设备私钥与房间密钥
 * 以明文落盘，而用户毫不知情。
 *
 * 现在：拒绝初始化。代价是本次会话 E2EE 不可用（解不开加密消息），
 * 但这正是「宁可不可用，也不要偷偷把私钥写进明文文件」。
 * 恢复路径由 UI 的本地解锁门禁提供（设置/输入本地解锁密码后重新登录）。
 */
export function rejectMissingStorageKeyState(
  userId: string,
  deviceId: string,
  useIndexedDB: boolean
): RustCryptoDebugState {
  logger.error(
    `未获取到 crypto storageKey，已拒绝以不加密方式初始化 crypto store（fail-closed）: ${userId}/${deviceId}`
  )
  return {
    attempted: true,
    initialized: false,
    skippedReason: 'local-unlock-required',
    error: null,
    usedIndexedDB: useIndexedDB,
    storeEncrypted: false,
    userId,
    deviceId
  }
}
