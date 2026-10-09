import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { I18nOptions } from 'vue-i18n'
import { createI18n } from 'vue-i18n'
import { useTypedI18n } from '@/plugins/i18n'
import type { I18nKeyPaths } from '@/typings/i18n'
import admin from '../../../../locales/zh-CN/admin.json'
import common from '../../../../locales/zh-CN/common.json'

// `tests/setup.ts` 为了组件测试把 `vue-i18n` 替换成了只含 `t`/`locale` 的极简桩，
// 本文件要验证的正是「包装透传真实 composer 的 te/tm/rt」，必须用真实实现。
vi.unmock('vue-i18n')

/**
 * `useTypedI18n` 运行时冒烟：证明「收紧 key 的包装」在真实 vue-i18n 上行为与 stock
 * `useI18n()` 一致（翻译、插值、兜底、动态 key、透传 API）。
 *
 * 类型层证据（伪造 key 报 TS 错 / 真实 key 通过）由 `vue-tsc` 探针在任务报告中记录，
 * 这里只钉运行时契约；类型断言部分用一个真实 key 的赋值做最低限度编译期约束。
 */
const REAL_KEY: I18nKeyPaths = 'common.done'

/**
 * vue-i18n 的 messages 泛型来自 `DefineLocaleMessage`（=全量 `I18nKeys`），要求 101 个
 * 命名空间且文案为字面量类型；测试夹具只装 2 个命名空间、JSON 导入也被 widen 成 string，
 * 因此对「夹具」做一次断言。被验证的生产代码（`useTypedI18n`）不含任何断言。
 */
const FIXTURE_MESSAGES = { 'zh-CN': { admin, common } } as unknown as I18nOptions['messages']

const setupWrapper = () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'zh-CN',
    messages: FIXTURE_MESSAGES
  })

  let api: ReturnType<typeof useTypedI18n> | undefined
  const Probe = defineComponent({
    setup() {
      api = useTypedI18n()
      return () => h('div')
    }
  })

  mount(Probe, { global: { plugins: [i18n] } })

  if (!api) throw new Error('useTypedI18n 未在 setup 中返回 API')
  return { api, i18n }
}

describe('useTypedI18n', () => {
  it('真实 key 走真实语言包翻译', () => {
    const { api } = setupWrapper()
    expect(api.t(REAL_KEY)).toBe('完成')
  })

  it('具名插值参数原样生效', () => {
    const { api } = setupWrapper()
    expect(api.t('admin.common.selectedCount', { count: 3 })).toBe('已选择 3 项')
  })

  it('缺失兜底文案形态（第二参为字符串）可用', () => {
    const { api } = setupWrapper()
    expect(api.t(REAL_KEY, '兜底')).toBe('完成')
  })

  it('tDynamic 接受运行时拼接的 key', () => {
    const { api } = setupWrapper()
    const namespace = 'common'
    expect(api.tDynamic(`${namespace}.done`)).toBe('完成')
  })

  it('tDynamic 对不存在的 key 回落为裸 key（与 stock 行为一致）', () => {
    const { api } = setupWrapper()
    expect(api.tDynamic('definitely.not.a.key')).toBe('definitely.not.a.key')
  })

  it('te 原样透传：存在为 true，不存在为 false', () => {
    const { api } = setupWrapper()
    expect(api.te(REAL_KEY)).toBe(true)
    expect(api.te('definitely.not.a.key')).toBe(false)
  })

  it('locale 原样透传且可写', () => {
    const { api } = setupWrapper()
    expect(api.locale.value).toBe('zh-CN')
    api.locale.value = 'zh-CN'
    expect(api.locale.value).toBe('zh-CN')
  })

  it('tm 原样透传：返回语言包节点', () => {
    const { api } = setupWrapper()
    expect(api.tm('common.done')).toBe('完成')
  })

  it('rt 原样透传：直接解析 tm 取到的消息', () => {
    const { api } = setupWrapper()
    expect(api.rt(api.tm('common.done'))).toBe('完成')
  })
})
