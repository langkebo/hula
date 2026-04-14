/**
 * 国际化配置
 * 参考文档: HuLa前端方案规划文档2026.md 第九章
 */
import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

export const i18n = createI18n({
  legacy: false, // 使用组合式 API
  locale: 'zh-CN', // 默认语言
  fallbackLocale: 'en-US', // 回退语言
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  },
  missingWarn: false,
  fallbackWarn: false
})

type I18nGlobal = typeof i18n.global

/**
 * 切换语言
 */
export function setLocale(locale: 'zh-CN' | 'en-US') {
  ;(i18n.global.locale as I18nGlobal['locale']).value = locale
  localStorage.setItem('hula-locale', locale)
}

/**
 * 获取当前语言
 */
export function getLocale(): 'zh-CN' | 'en-US' {
  return i18n.global.locale.value as 'zh-CN' | 'en-US'
}

/**
 * 初始化语言设置
 */
export function initLocale() {
  const saved = localStorage.getItem('hula-locale')
  if (saved && ['zh-CN', 'en-US'].includes(saved)) {
    ;(i18n.global.locale as I18nGlobal['locale']).value = saved as 'zh-CN' | 'en-US'
  }
}

export default i18n
