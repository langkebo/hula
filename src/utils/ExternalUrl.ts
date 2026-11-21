import { invoke } from '@tauri-apps/api/core'
import { TauriCommand } from '@/enums'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ExternalUrl')

/**
 * 交给系统打开的外部地址必须过协议白名单，与 Rust 侧 `open_external_url` 保持一致：
 * `javascript:` / `data:` / `file:` 等协议一律拒绝，避免消息内容诱导本地执行或读文件。
 */
const WEB_SCHEME_PATTERN = /^(https?:\/\/|mailto:)/i
const SETTINGS_SCHEME_PATTERN = /^(x-apple\.systempreferences:|ms-settings:)/i

export const isAllowedExternalUrl = (url: string) => WEB_SCHEME_PATTERN.test(url) || SETTINGS_SCHEME_PATTERN.test(url)

/**
 * 打开外部链接。
 *
 * 走自定义 Tauri 命令而非 `@tauri-apps/plugin-opener` 的 `openUrl`：
 * 插件的 `open-url` 权限只能按 URL 通配（`https://*`），无法限制协议。
 */
export const openExternalUrl = async (url: string): Promise<boolean> => {
  const target = url?.trim() ?? ''
  if (!target || !isAllowedExternalUrl(target)) {
    logger.warn('已拒绝打开不受支持的外链协议:', target)
    return false
  }

  if (!hasTauriRuntime()) {
    window.open(target, '_blank', 'noopener,noreferrer')
    return true
  }

  try {
    await invoke(TauriCommand.OPEN_EXTERNAL_URL, { url: target })
    return true
  } catch (error) {
    logger.error('打开链接失败:', error)
    return false
  }
}
