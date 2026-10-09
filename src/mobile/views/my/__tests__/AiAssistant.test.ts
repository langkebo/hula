import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { Plugin } from 'vue'

// siliconFlowService 会拉起 HttpClient / Logger，测试里不需要真实网络栈
vi.mock('@/services/siliconflow/SiliconFlowService', () => ({
  siliconFlowService: {
    testConnection: vi.fn(),
    chatStream: vi.fn()
  }
}))

// setup.ts 全局把 vue-i18n 换成了返回 key 的 t 桩；本文件断言的是真实语言包文案，
// 必须还原真实实现（否则 t('ai_assistant.suggestions.translate') 只会回吐 key，
// 测试就变成了自证。locale JSON 也直接读 `locales/` 下的真实文件。
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual }
})

vi.mock('@iconify/vue', () => ({
  Icon: { template: '<span class="icon-stub" />' }
}))

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, showToast: vi.fn() }
})

// 必须在 vi.mock('vue-i18n') 之后导入：拿到的是上面的 mock 工厂透传出来的真实实现，
// 与组件内部 useI18n 共享同一个模块实例（用 vi.importActual 另起实例会导致
// injection symbol 不一致，useI18n() 拿不到 mount 时注入的 i18n）。
import { createI18n } from 'vue-i18n'
import AiAssistant from '../AiAssistant.vue'

const ROOT = resolve(__dirname, '..', '..', '..', '..', '..')
const readAiAssistantPack = (locale: string) =>
  JSON.parse(readFileSync(resolve(ROOT, 'locales', locale, 'ai_assistant.json'), 'utf-8'))

const PACKS = {
  'zh-CN': readAiAssistantPack('zh-CN'),
  en: readAiAssistantPack('en')
} as const

/** 本测试只关心渲染文案，用一个宽松的 i18n 句柄类型避开全局 Messages esquema 的类型推导。 */
type I18nInstance = {
  global: {
    t: (key: string) => string
    locale: { value: string }
  }
}
let i18n: I18nInstance

/**
 * 用真实语言包建 i18n；legacy:false + 全局 scope，组件内 useI18n() 才会拿到这些消息。
 * 注意命名空间：`locales/{lang}/ai_assistant.json` 的文件名就是顶层命名空间，
 * 所以必须再包一层 `{ ai_assistant: pack }`，否则 `ai_assistant.*` 全部解析失败。
 */
const buildI18n = (locale: 'zh-CN' | 'en'): I18nInstance =>
  createI18n({
    legacy: false,
    globalInjection: true,
    locale,
    fallbackLocale: 'zh-CN',
    messages: {
      'zh-CN': { ai_assistant: PACKS['zh-CN'] },
      en: { ai_assistant: PACKS.en }
    }
    // createI18n 的重载会把 messages 反推成字面量 locale 联合类型，
    // 与本仓 `src/typings/i18n.d.ts` 的全局声明冲突；测试里只要运行时可解析即可。
  } as never) as unknown as I18nInstance

const STUBS = {
  AutoFixHeightPage: { template: '<div><slot name="header" /><slot name="container" /></div>' },
  HeaderBar: { template: '<div class="header-stub" />' },
  Icon: { template: '<span class="icon-stub" />' },
  'van-cell-group': { template: '<div><slot /></div>' },
  'van-cell': { template: '<div><slot name="title" /><slot name="value" /></div>' },
  'van-tag': { template: '<span class="van-tag-stub"><slot /></span>' },
  'van-picker': { template: '<div class="van-picker-stub" />' },
  'van-loading': { template: '<span class="van-loading-stub" />' },
  'van-field': {
    template: '<textarea class="van-field-stub" :value="modelValue" />',
    props: ['modelValue']
  },
  'van-button': { template: '<button class="van-button-stub"><slot /></button>' },
  'van-popup': { template: '<div class="van-popup-stub"><slot /></div>' },
  'van-empty': { template: '<div class="van-empty-stub" />' },
  'van-icon': { template: '<i class="van-icon-stub" />' }
}

const mountPage = () =>
  mount(AiAssistant, {
    global: {
      plugins: [i18n as unknown as Plugin, createTestingPinia({ createSpy: vi.fn })],
      stubs: STUBS
    }
  })

describe('AiAssistant 建议卡文案', () => {
  it('渲染 zh-CN 真实文案而不是 i18n key', async () => {
    i18n = buildI18n('zh-CN')
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()

    const text = wrapper.text()

    // 渲染输出里不得出现任何裸 key
    expect(text).not.toContain('ai_assistant.suggestions.')
    // 且必须是真实语言包里的中文文案（标题与描述都验到）
    expect(text).toContain(PACKS['zh-CN'].suggestions.translate)
    expect(text).toContain(PACKS['zh-CN'].suggestions.translate_desc)
    expect(text).toContain(PACKS['zh-CN'].suggestions.summarize)
    expect(text).toContain(PACKS['zh-CN'].suggestions.summarize_desc)
    expect(text).toContain(PACKS['zh-CN'].suggestions.code)
    expect(text).toContain(PACKS['zh-CN'].suggestions.code_desc)
    expect(text).toContain(PACKS['zh-CN'].suggestions.chat)
    expect(text).toContain(PACKS['zh-CN'].suggestions.chat_desc)
  })

  it('切到 en 后建议卡文案随语言切换（computed 而非模块级常量）', async () => {
    i18n = buildI18n('zh-CN')
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain(PACKS['zh-CN'].suggestions.translate)

    i18n.global.locale.value = 'en'
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain(PACKS.en.suggestions.translate)
    expect(wrapper.text()).not.toContain(PACKS['zh-CN'].suggestions.translate)
  })

  it('建议卡的 prompt 使用翻译后的文案（点击后进入输入框）', async () => {
    i18n = buildI18n('zh-CN')
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()

    const cards = wrapper.findAll('.grid > div')
    expect(cards.length).toBe(4)

    await cards[0].trigger('click')
    await wrapper.vm.$nextTick()

    const field = wrapper.find('textarea.van-field-stub')
    expect((field.element as HTMLTextAreaElement).value).toBe(PACKS['zh-CN'].suggestions.translate_prompt)
  })
})
