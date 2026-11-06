import { useI18nGlobal } from '@/services/i18n'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('TauriErrorTranslator')

/** 形如 `CODE` 或 `CODE: detail`，CODE 为大写下划线标识。 */
const ERROR_CODE_PATTERN = /^([A-Z][A-Z0-9_]+)(?:: ([\s\S]*))?$/

interface ParsedCommandError {
  code: string
  detail?: string
}

/**
 * 解析 Rust 侧命令错误码。
 * 不符合约定的字符串（普通错误文案）返回 null。
 */
export function parseCommandError(error: string): ParsedCommandError | null {
  const matched = ERROR_CODE_PATTERN.exec(error.trim())
  if (!matched) return null
  const code = matched[1]
  if (!code) return null
  const detail = matched[2]
  return detail === undefined ? { code } : { code, detail }
}

/**
 * 把 Rust 侧 `CODE` / `CODE: detail` 形式的错误翻译为当前语言文案。
 * 未登记或非错误码的字符串原样返回，保证未知错误仍可见。
 */
export function translateTauriError(error: string): string {
  const parsed = parseCommandError(error)
  if (!parsed) return error

  const key = `error.cmd.${parsed.code.toLowerCase()}`
  const translated = useI18nGlobal().t(key, parsed.detail === undefined ? undefined : { detail: parsed.detail })
  if (translated === key) {
    logger.warn(`未登记的命令错误码，回落原文: ${parsed.code}`)
    return error
  }
  return translated
}
