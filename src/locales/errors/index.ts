/**
 * §9.3.5 错误文案中心化 — 解析入口
 *
 * 提供 errcode → 用户可读文案 的统一查询能力，作为代码层单一事实源。
 * 优先从 errcode 映射查询；未命中时回退到 AppError.message 或调用方提供的 fallback。
 */
import type { AppError } from '@/common/errors'
import { errorMessagesEn } from './en'
import { errorMessagesZh } from './zh'

export type ErrorLocale = 'zh' | 'en'

const MESSAGES_BY_LOCALE: Record<ErrorLocale, Record<string, string>> = {
  zh: errorMessagesZh,
  en: errorMessagesEn
}

/** 归一化 errcode 为大写，用于大小写不敏感查询 */
function normalizeErrcode(errcode: string): string {
  return errcode.toUpperCase()
}

/**
 * 根据 errcode 解析用户可读文案。
 *
 * @param errcode Matrix errcode 或自定义错误码（大小写不敏感）
 * @param locale 语言，默认 'zh'
 * @param fallback 未命中时的回退文案；未提供则返回 errcode 本身
 */
export function resolveErrorMessage(errcode: string, locale: ErrorLocale = 'zh', fallback?: string): string {
  if (!errcode) {
    return fallback ?? ''
  }
  const table = MESSAGES_BY_LOCALE[locale] ?? MESSAGES_BY_LOCALE.zh
  const key = normalizeErrcode(errcode)
  const message = table[key]
  if (message) return message
  return fallback ?? errcode
}

/**
 * 从 AppError 解析用户可读文案。
 *
 * 优先按 AppError.code 查询 errcode 映射；未命中时回退到 AppError.message。
 *
 * @param appError 已分类的应用错误
 * @param locale 语言，默认 'zh'
 */
export function getLocalizedMessageFromAppError(appError: AppError, locale: ErrorLocale = 'zh'): string {
  // AppError 是联合类型，AppErrorNotFound 没有 code 字段，使用 in 操作符安全缩窄
  const code = 'code' in appError ? appError.code : undefined
  if (code) {
    const table = MESSAGES_BY_LOCALE[locale] ?? MESSAGES_BY_LOCALE.zh
    const message = table[normalizeErrcode(code)]
    if (message) return message
  }
  return appError.message || resolveErrorMessage('UNKNOWN', locale)
}
