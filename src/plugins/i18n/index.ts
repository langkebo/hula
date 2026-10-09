import type { TranslateOptions } from 'vue-i18n'
import { useI18n } from 'vue-i18n'
import type { I18nKeyPaths } from '@/typings/i18n'

/**
 * `t()` 的具名插值参数（`t('key', { count })`）。
 */
export type I18nTranslateParams = Record<string, unknown> | readonly unknown[] | string | number

/**
 * `t()` 的第三参数：vue-i18n 的翻译选项（`locale` / `plural` 等）。
 */
export type I18nTranslateOptions = TranslateOptions

/**
 * 收紧 key 的 `t()`：只接受 `locales/zh-CN` 里真实存在的点分 key。
 *
 * 重载刻意与仓库实际用到的形态一一对应（具名插值 / 列表插值 / 复数 / 缺失兜底文案），
 * 而不是保留 vue-i18n 的 `Key extends string` 自由泛型——后者正是伪造 key 不报错的原因。
 */
export interface TypedTranslate {
  /** 仅 key */
  (key: I18nKeyPaths): string
  /** key + 插值/复数/兜底文案 */
  (key: I18nKeyPaths, params: I18nTranslateParams): string
  /** key + 插值 + 翻译选项 */
  (key: I18nKeyPaths, params: I18nTranslateParams, options: I18nTranslateOptions): string
}

/**
 * 动态 key 的显式出口：key 由运行时拼接，静态不可知，因此不参与收紧。
 * 每一处使用都必须能说清「为什么静态写不出来」。
 */
export interface DynamicTranslate {
  /** 动态 key */
  (key: string): string
  /** 动态 key + 插值/复数/兜底文案 */
  (key: string, params: I18nTranslateParams): string
  /** 动态 key + 插值 + 翻译选项 */
  (key: string, params: I18nTranslateParams, options: I18nTranslateOptions): string
}

/**
 * 边界内部的形态：vue-i18n 的 `t` 有十来个重载（还接受 MessageFunction、可能返回
 * MessageContext），这里只需要「key 为 string、返回 string」这一条实用签名，由下面
 * 唯一一次 `as unknown as` 断言收敛。运行时行为完全不变，只是丢掉用不到的返回值重载。
 */
type RawTranslate = (key: string, params?: I18nTranslateParams, options?: I18nTranslateOptions) => string

/**
 * 类型安全的 i18n composer 包装。
 *
 * - `t` 的 key 收紧为 `I18nKeyPaths`：写错 key 会在 `vue-tsc` 阶段报错。
 * - `tDynamic` 是唯一允许动态 key 的出口。
 * - `te` / `tm` / `rt` / `locale` 原样透传（类型与运行时都与 stock `useI18n()` 一致），
 *   因此逐步迁移期间未迁移的文件继续使用 stock `useI18n()` 也不会出现类型不一致。
 *
 * @returns 收紧后的 `t`、动态出口 `tDynamic`，以及原样透传的 `te`/`tm`/`rt`/`locale`
 */
export const useTypedI18n = () => {
  const { t, te, tm, rt, locale } = useI18n()

  // 唯一一次 `as unknown as`：vue-i18n 的 t 是重载接口，无法直接窄化首参，
  // 先收敛成 RawTranslate。
  const rawTranslate = t as unknown as RawTranslate

  // 依赖函数参数逆变（RawTranslate 收 string，TypedTranslate 只传 I18nKeyPaths 子集）
  // 把同一个实现标成两种出口类型，无需第二次断言。
  const typedTranslate: TypedTranslate = rawTranslate
  const dynamicTranslate: DynamicTranslate = rawTranslate

  return {
    t: typedTranslate,
    tDynamic: dynamicTranslate,
    te,
    tm,
    rt,
    locale
  }
}
