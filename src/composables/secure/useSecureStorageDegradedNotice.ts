import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useI18nGlobal } from '@/services/i18n'
import { getSecureStorageBackendInfo } from '@/services/secure/secureStorage'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SecureStorageDegradedNotice')

/**
 * 「安全存储降级 / 已恢复」的一次性提示（B3）。
 *
 * ## 为什么需要
 *
 * 降级（系统密钥库不可用 ⇒ 退化为受主密钥保护的文件）过去只写日志：用户既不知道
 * 自己的密钥保管强度掉了一档，也不知道后来系统密钥库恢复可用后已经回到原生后端。
 * 设置页状态卡只有主动点进去才看得到，等同于「缺少用户提示」。
 *
 * ## 提示策略
 *
 * - 状态类告知，**每种状态只提示一次**（同 `useLocalStorePlaintextWarning` 的理由：
 *   每次启动重复弹会变成噪音），持续状态仍以设置页状态卡为准；
 * - 降级用 warning，恢复用 success，都走 polite，不抢焦点也不打断输入；
 * - 明文落盘（`available=false`）不在这里处理 —— 那是
 *   `useLocalStorePlaintextWarning` 的链路，两条链路互不改写对方状态。
 */

/**
 * 「上次告知用户的后端状态」持久化位（localStorage）。
 *
 * 有值 = 上次提示的是降级，值为降级时的 backend；无值 = 上次是原生后端。
 * 名称含 `STORAGE_KEY` 以被 `scripts/check-settings-wiring.mjs` 纳管为持久化 key。
 */
export const SECURE_STORAGE_NOTICE_STATE_STORAGE_KEY = 'tjg-secure-storage-notice-state-v1'

function readNotifiedBackend(): string | null {
  try {
    return globalThis.localStorage?.getItem(SECURE_STORAGE_NOTICE_STATE_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

function writeNotifiedBackend(backend: string | null): void {
  try {
    if (backend === null) {
      globalThis.localStorage?.removeItem(SECURE_STORAGE_NOTICE_STATE_STORAGE_KEY)
    } else {
      globalThis.localStorage?.setItem(SECURE_STORAGE_NOTICE_STATE_STORAGE_KEY, backend)
    }
  } catch (err) {
    logger.warn('写入「安全存储提示状态」失败', err)
  }
}

/** 清除标记（登出 / 测试用） */
export function resetSecureStorageDegradedNotice(): void {
  try {
    globalThis.localStorage?.removeItem(SECURE_STORAGE_NOTICE_STATE_STORAGE_KEY)
  } catch {
    // 忽略
  }
}

export type SecureStorageNoticeResult = 'degraded' | 'recovered' | null

export function useSecureStorageDegradedNotice() {
  const { showFeedback } = useActionFeedback()

  /**
   * 检查并（必要时）提示一次。内部全量兜底：启动路径不希望一个提示把初始化搞挂。
   *
   * @returns 'degraded' 本次提示了降级；'recovered' 本次提示了恢复；null 无需提示
   */
  async function notifyIfNeeded(): Promise<SecureStorageNoticeResult> {
    let info = null
    try {
      info = await getSecureStorageBackendInfo()
    } catch (err) {
      logger.warn('读取安全存储后端信息失败，跳过降级提示', err)
      return null
    }

    // 安全存储完全不可用（明文落盘）由 useLocalStorePlaintextWarning 负责
    if (!info?.available) return null

    const t = useI18nGlobal().t
    const notifiedBackend = readNotifiedBackend()

    if (info.degraded) {
      const backend = info.backend ?? 'unknown'
      if (notifiedBackend === backend) return null
      showFeedback(t('setting.security.local_store_degraded_toast'), 'warning', 'polite')
      writeNotifiedBackend(backend)
      logger.warn(`安全存储降级已告知用户：backend=${backend}`)
      return 'degraded'
    }

    if (notifiedBackend !== null) {
      showFeedback(t('setting.security.local_store_recovered_toast'), 'success', 'polite')
      writeNotifiedBackend(null)
      logger.info(`安全存储已恢复系统密钥库（上次降级 backend=${notifiedBackend}）`)
      return 'recovered'
    }

    return null
  }

  return { notifyIfNeeded }
}
