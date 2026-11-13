import { useI18n } from 'vue-i18n'
import { resolveDisplayMessage, toAppError } from '@/common/errors'

/**
 * 移动端统一的错误展示文案解析。
 *
 * 复用 `src/common/errors.ts` 的分类与 i18n 键映射，避免各页面直出
 * `error.message`（SDK 原始英文/错误码）或各自维护一份 key 映射表。
 */
export function useMobileErrorText() {
  const { t, te } = useI18n()

  /** key 未注册时返回 key 本身，交给 resolveDisplayMessage 回落原始 message */
  const translate = (key: string): string => (te(key) ? t(key) : key)

  /**
   * @param err 任意错误（SDK 错误、Error、字符串）
   * @returns 可供界面直接展示的文案，永不为空
   */
  const resolve = (err: unknown): string => {
    const appError = toAppError(err)
    const text = resolveDisplayMessage(appError, translate)
    return text?.trim() ? text : t('common.error')
  }

  return { resolve }
}
