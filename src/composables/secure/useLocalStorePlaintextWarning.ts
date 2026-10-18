import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useI18nGlobal } from '@/services/i18n'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { deriveLocalStoreEncryptionLevel } from '@/services/secure/localStoreEncryptionStatus'
import { getSecureStorageBackendInfo } from '@/services/secure/secureStorage'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('LocalStorePlaintextWarning')

/**
 * 「本机密钥库未加密」的**一次性**提示（F-4 / D1）。
 *
 * ## 为什么只提示一次
 *
 * 这是**状态告知**，不是需要立刻处理的错误：每次启动弹同一个 toast 会变成噪音，
 * 最后用户闭着眼点掉（与"错误告警被训练忽略"是同一个失败模式）。
 * 持续可见的状态放在 设置 → 安全 → 本地密钥库 状态卡里。
 *
 * ## 提示强度
 *
 * 用户已确认：一次性 toast。**不**阻断启动 —— 阻断属于 B1 的范畴，
 * 需要先有「设本地解锁密码」的入口，否则会把用户锁在门外。
 *
 * ## 判据
 *
 * 只对 `plaintext`（实测 store 未加密）提示。`encrypted-degraded` **不提示** ——
 * 那种情况下 store 仍然是加密的，只是密钥保管弱一档。
 */

/**
 * 「已提示过」的持久化位（localStorage）。
 *
 * 名称含 `STORAGE_KEY` 以被 `scripts/check-settings-wiring.mjs` 纳管为持久化 key。
 */
export const LOCAL_STORE_PLAINTEXT_WARNED_STORAGE_KEY = 'tjg-local-store-plaintext-warned-v1'

function hasWarned(): boolean {
  try {
    return globalThis.localStorage?.getItem(LOCAL_STORE_PLAINTEXT_WARNED_STORAGE_KEY) === '1'
  } catch {
    // 读不到就当作没提示过：宁可多提示一次，也不要漏掉「明文落盘」这件事
    return false
  }
}

function markWarned(): void {
  try {
    globalThis.localStorage?.setItem(LOCAL_STORE_PLAINTEXT_WARNED_STORAGE_KEY, '1')
  } catch (err) {
    logger.warn('写入「已提示明文落盘」标记失败', err)
  }
}

/** 清除标记（登出 / 测试用） */
export function resetLocalStorePlaintextWarning(): void {
  try {
    globalThis.localStorage?.removeItem(LOCAL_STORE_PLAINTEXT_WARNED_STORAGE_KEY)
  } catch {
    // 忽略
  }
}

export function useLocalStorePlaintextWarning() {
  const { showFeedback } = useActionFeedback()

  /**
   * 检查并（必要时）提示一次。安全：内部全量 try/catch，
   * 启动路径不希望因为一个提示把应用初始化搞挂。
   */
  async function warnIfNeeded(): Promise<boolean> {
    if (hasWarned()) return false

    let storeEncrypted: boolean | null = null
    try {
      storeEncrypted = matrixClientService.getRustCryptoDebugState().storeEncrypted
    } catch {
      storeEncrypted = null
    }

    let info = null
    try {
      info = await getSecureStorageBackendInfo()
    } catch {
      info = null
    }

    if (deriveLocalStoreEncryptionLevel(storeEncrypted, info) !== 'plaintext') return false

    const t = useI18nGlobal().t
    showFeedback(t('setting.security.local_store_plaintext_toast'), 'warning', 'assertive')
    markWarned()
    logger.error('本机安全存储不可用，crypto store 未加密（已一次性告知用户）')
    return true
  }

  return { warnIfNeeded }
}
