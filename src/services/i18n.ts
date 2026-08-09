/**
 * Each locale is split into multiple domain-based translation fragments
 * eg: (home.json, room.json, common.json...) stored in locales/{lang}/.
 * This fragmented structure improves maintainability and prevents large
 * single-file translation bundles.
 *
 * On language switch, all fragments of the selected locale are dynamically
 * imported and merged into a complete message set.
 */

import type { App } from 'vue'
import type { Locale } from 'vue-i18n'
import * as VueI18n from 'vue-i18n'
import { setDayjsLocale } from '@/utils/ComputedTime'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('I18n')

const getCreateI18n = () => {
  if (!('createI18n' in VueI18n)) {
    return null
  }

  const createI18nFn = Reflect.get(VueI18n, 'createI18n')
  return typeof createI18nFn === 'function' ? createI18nFn : null
}

const createI18nFn = getCreateI18n()

const i18n = createI18nFn
  ? createI18nFn({
      legacy: false,
      locale: 'zh-CN'
    })
  : null

type FallbackComposer = {
  locale: { value: Locale }
  t: (key: string, params?: Record<string, unknown>) => string
}

const fallbackLocaleModules = import.meta.glob('../../locales/{zh-CN,en}/**/*.json', {
  eager: true
}) as Record<string, { default: Record<string, unknown> }>

const fallbackMessages = Object.entries(fallbackLocaleModules).reduce(
  (acc, [path, mod]) => {
    const match = path.match(/\/locales\/([\w-]+)\/([\w-]+)\.json$/)
    if (!match) return acc

    const [, locale, part] = match
    acc[locale as Locale] ??= {}
    acc[locale as Locale][part] = mod.default
    return acc
  },
  {} as Record<Locale, Record<string, unknown>>
)

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const resolveFallbackMessage = (locale: Locale, key: string): string | null => {
  const segments = key.split('.')
  let current: unknown = fallbackMessages[locale]

  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      return null
    }
    current = current[segment]
  }

  return typeof current === 'string' ? current : null
}

const formatFallbackMessage = (message: string, params?: Record<string, unknown>) => {
  if (!params) return message
  return message.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params[token]
    return value === undefined ? `{${token}}` : String(value)
  })
}

// Preload zh-CN messages synchronously so the UI never shows English
// before the async bootstrap completes.
if (i18n && fallbackMessages['zh-CN']) {
  // @ts-expect-error — Dynamic JSON imports yield Record<string, unknown>,
  // but vue-i18n's setLocaleMessage expects RemoveIndexSignature<...> with
  // 86+ schema-inferred named properties that cannot be satisfied without
  // a type assertion. This is a known type boundary for dynamic locale loading.
  i18n.global.setLocaleMessage('zh-CN', fallbackMessages['zh-CN'])
}

const fallbackComposer: FallbackComposer = {
  locale: {
    value: 'zh-CN' as Locale
  },
  t: (key, params) => {
    const localized =
      resolveFallbackMessage(fallbackComposer.locale.value, key) ??
      resolveFallbackMessage('en', key) ??
      resolveFallbackMessage('zh-CN', key) ??
      key
    return formatFallbackMessage(localized, params)
  }
}

const getGlobalComposer = (): FallbackComposer => {
  const globalComposer = i18n?.global
  if (globalComposer) {
    return globalComposer as unknown as FallbackComposer
  }
  return fallbackComposer
}

/**
 * 在 setup 外使用，这似乎与 vue-i18n v9.x 相悖
 * 如非必要，请不要直接使用它!!!
 */
export const useI18nGlobal = (): FallbackComposer => {
  return getGlobalComposer()
}

// 动态导入所有 JSON 文件
type LoadLocale = () => Promise<{ default: Record<string, string> }>

const locales = Object.entries(import.meta.glob('../../locales/**/*.json'))
  .map(([path, loader]) => {
    const match = path.match(/\/locales\/([\w-]+)\/([\w-]+)\.json$/)
    if (!match) return null

    const [, locale, part] = match
    return [locale, part, loader as LoadLocale] as const
  })
  .reduce(
    (acc, item) => {
      if (!item) return acc
      const [locale, part, loader] = item
      acc[locale] ??= {}
      acc[locale][part] = loader
      return acc
    },
    {} as Record<Locale, Record<string, LoadLocale>>
  )

const availableLocales = Object.keys(locales)

const loadedLanguages: Locale[] = []
type LanguagePreference = Locale | 'AUTO' | string

// Obtain language prefix
function getLangPrefix(lang: string) {
  const normalized = lang.replace('_', '-').trim()
  const parts = normalized.split('-')
  return parts[0].toLowerCase()
}

// 统一的前缀映射表，后续需要支持其他语言时只需在此添加映射
const PREFIX_LANG_MAP: Record<string, Locale> = {
  zh: 'zh-CN',
  en: 'en'
}

// 根据语言前缀映射受支持的 locale，未匹配则回退中文
const mapByPrefix = (lang: string): Locale => {
  return PREFIX_LANG_MAP[getLangPrefix(lang)] ?? 'en'
}

// AUTO 语言解析：使用映射表限定支持的前缀，其他一律回退中文
const resolveAutoLanguage = (): Locale => {
  if (typeof navigator !== 'undefined') {
    return mapByPrefix(navigator.language)
  }
  return 'en'
}

// 归一化语言值：优先显式支持的语言，其次按前缀映射，最后回退中文
const normalizeLang = (lang: string): Locale => {
  if (lang === 'AUTO') {
    return resolveAutoLanguage()
  }

  if (availableLocales.includes(lang)) {
    return lang as Locale
  }

  return mapByPrefix(lang)
}

// 应用语言到 i18n 和 html 标签
function setI18nLanguage(lang: LanguagePreference) {
  const resolved = normalizeLang(lang)
  getGlobalComposer().locale.value = resolved
  setDayjsLocale(resolved)
  if (typeof document !== 'undefined') {
    document.querySelector('html')?.setAttribute('lang', resolved)
  }
  return resolved
}

function findLocales(lang: string) {
  const exact = locales[lang]
  if (exact) return exact

  const prefix = getLangPrefix(lang)
  const like = availableLocales.find((lang) => getLangPrefix(lang) === prefix)
  return locales[like ?? 'en']
}

// 加载语言包并切换语言，确保 lang 被归一化后再加载
export async function loadLanguage(lang: LanguagePreference) {
  const resolvedLang = normalizeLang(lang)
  const globalComposer = getGlobalComposer()
  if (globalComposer.locale.value === resolvedLang) {
    return setI18nLanguage(resolvedLang)
  }

  if (loadedLanguages.includes(resolvedLang)) {
    return setI18nLanguage(resolvedLang)
  }

  const messageParts = findLocales(resolvedLang)
  if (!messageParts) {
    logger.warn(`No locale data found for: ${resolvedLang}`)
    return
  }

  // 将每个文件的 Promise 收集起来
  const tasks = Object.entries(messageParts).map(async ([key, loader]) => {
    const mod = await loader()
    return [key, mod.default]
  })

  // 等待所有 JSON 完成加载
  const modules = await Promise.all(tasks)

  // 文件结构是 { home: {...}, room: {...} }
  // 合并成一个 messages = { ...home, ...room }
  const messages = Object.fromEntries(modules)

  // 设置语言包
  if (i18n?.global && typeof i18n.global.setLocaleMessage === 'function') {
    i18n.global.setLocaleMessage(resolvedLang, messages)
  }

  loadedLanguages.push(resolvedLang)

  return setI18nLanguage(resolvedLang)
}

export async function applyLanguagePreference(lang?: LanguagePreference) {
  return loadLanguage(lang ?? 'AUTO')
}

/**
 * Ensure that pinia is initialized first.
 */
export const setupI18n = (app: App) => {
  if (i18n) {
    app.use(i18n)
  }

  void import('../stores/domains/settings/setting')
    .then(({ useSettingStore }) => {
      const settingStore = useSettingStore()
      return applyLanguagePreference(settingStore.languagePreference)
    })
    .catch((error) => {
      logger.warn('Failed to load setting store during i18n setup, falling back to AUTO', error)
      return applyLanguagePreference('AUTO')
    })
}
