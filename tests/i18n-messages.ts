/**
 * 真实语言表驱动的 vue-i18n 测试替身。
 *
 * ## 为什么存在
 *
 * 组件测试里常见的写法是在 `vi.mock('vue-i18n')` 中手写一张 key → 中文映射表：
 *
 * ```ts
 * vi.mock('vue-i18n', () => ({
 *   useI18n: () => ({
 *     t: (key: string) => ({ 'encryption.recovery_key_required': '请输入恢复密钥' }[key] ?? key)
 *   })
 * }))
 * ```
 *
 * 这张表往往是从**组件源码里抄出来的**，于是当源码把键名写错
 * （例如实际应为 `setting.encryption.recovery_key_required`）时，
 * stub 抄的也是错键名，测试依然全绿 —— 界面在真实运行中渲染裸 key，
 * 测试却毫无察觉。这就是「自洽 stub」反模式。
 *
 * 本助手改为按项目命名空间约定从真实语言表解析：
 *
 *   `locales/{lang}/{ns}.json` 的**文件名即顶层命名空间**
 *   （`setting.encryption.title` → `locales/zh-CN/setting.json` 的 `encryption.title`）
 *
 * 组件一旦引用了无法解析的键，`t()` 会原样返回裸 key，
 * 断言里立刻暴露，无法再被 stub 掩盖。
 *
 * ## 用法
 *
 * ```ts
 * import { createI18nMock } from '~/tests/i18n-messages'
 *
 * vi.mock('vue-i18n', () => createI18nMock())
 * ```
 *
 * 若组件引用了语言表中确实缺失的键（已知内容缺口），
 * 用 `provisional` 显式声明，并写明缺口来源与补齐后必须删除：
 *
 * ```ts
 * vi.mock('vue-i18n', () => createI18nMock({
 *   provisional: { 'encryption.foo.bar': '临时文案' }
 * }))
 * ```
 */

import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

/** zh-CN 语言表目录（真实语言表，非 stub）。 */
export const LOCALE_DIR = resolvePath(__dirname, '..', 'locales', 'zh-CN')

const namespaceCache = new Map<string, unknown>()

const loadNamespace = (localeDir: string, ns: string): unknown => {
  const cacheKey = `${localeDir}::${ns}`
  if (!namespaceCache.has(cacheKey)) {
    namespaceCache.set(cacheKey, JSON.parse(readFileSync(resolvePath(localeDir, `${ns}.json`), 'utf8')))
  }
  return namespaceCache.get(cacheKey)
}

/**
 * 按命名空间约定解析一个 i18n 键。
 *
 * @param key 形如 `setting.encryption.title` 的完整键
 * @param localeDir 语言表目录，默认 zh-CN
 * @returns 命中则返回文案；未命中或中途不是对象则返回 `undefined`
 */
export const resolveMessage = (key: string, localeDir: string = LOCALE_DIR): string | undefined => {
  const [ns, ...path] = key.split('.')
  if (!ns) return undefined
  let node: unknown = loadNamespace(localeDir, ns)
  for (const segment of path) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[segment]
  }
  return typeof node === 'string' ? node : undefined
}

/** 把语言表占位符 `{name}` 替换为实际参数值。 */
export const interpolate = (text: string, params?: Record<string, unknown>): string =>
  params ? text.replace(/\{(\w+)\}/g, (_match, name: string) => String(params[name] ?? '')) : text

export interface I18nMockOptions {
  /**
   * 语言表中确实缺失、但用例需要可读文案的键。
   * 仅用于**已记录在案的内容缺口**，缺口补齐后必须删除对应条目。
   */
  provisional?: Record<string, string>
  /** 语言表目录，默认 zh-CN。 */
  localeDir?: string
}

/**
 * 生成 `vi.mock('vue-i18n')` 所需的模块对象。
 *
 * 未解析到的键**不抛错**，而是原样返回键名 —— 这样断言会直接看到
 * 未翻译的裸键，缺陷不会被吞掉。
 */
export const createI18nMock = (options: I18nMockOptions = {}) => {
  const { provisional = {}, localeDir = LOCALE_DIR } = options

  const t = (key: string, params?: Record<string, unknown>): string => {
    const text = resolveMessage(key, localeDir) ?? provisional[key]
    return text === undefined ? key : interpolate(text, params)
  }

  return {
    useI18n: () => ({
      t,
      te: (key: string) => resolveMessage(key, localeDir) !== undefined,
      locale: { value: 'zh-CN' },
      availableLocales: ['zh-CN', 'en']
    })
  }
}
