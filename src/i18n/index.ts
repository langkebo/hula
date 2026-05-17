/**
 * 兼容旧入口，统一复用实际运行时的 i18n 实例。
 * 新代码请直接从 `@/services/i18n` 导入。
 */
import { i18n, loadLanguage, useI18nGlobal } from '@/services/i18n'

export { i18n }

/**
 * 切换语言
 */
export async function setLocale(locale: 'zh-CN' | 'en-US' | 'en') {
  const normalizedLocale = locale === 'en-US' ? 'en' : locale
  localStorage.setItem('hula-locale', normalizedLocale)
  await loadLanguage(normalizedLocale)
}

/**
 * 获取当前语言
 */
export function getLocale(): 'zh-CN' | 'en-US' | 'en' {
  return useI18nGlobal().locale.value as 'zh-CN' | 'en-US' | 'en'
}

/**
 * 初始化语言设置
 */
export async function initLocale() {
  const saved = localStorage.getItem('hula-locale')
  if (saved && ['zh-CN', 'en-US', 'en'].includes(saved)) {
    await loadLanguage((saved === 'en-US' ? 'en' : saved) as 'zh-CN' | 'en')
  }
}

export default i18n
