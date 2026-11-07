import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useGlassEffectStore } from '@/stores/domains/settings/glassEffect'
import TjGlass from '../TjGlass.vue'

function mountGlass(props: Record<string, unknown> = {}) {
  return mount(TjGlass, {
    props,
    slots: { default: '<span class="tj-glass-content">内容</span>' }
  })
}

describe('TjGlass', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('默认渲染 panel 变体，玻璃开启并输出档位', () => {
    const wrapper = mountGlass()

    expect(wrapper.classes()).toContain('tj-glass')
    expect(wrapper.classes()).toContain('tj-glass--panel')
    expect(wrapper.classes()).toContain('tj-glass--radius-panel')
    expect(wrapper.attributes('data-glass')).toBe('on')
    expect(wrapper.attributes('data-tier')).toBe('high')
    expect(wrapper.find('.tj-glass-content').exists()).toBe(true)
  })

  it('subtle 变体渲染对应类名', () => {
    const wrapper = mountGlass({ variant: 'subtle' })

    expect(wrapper.classes()).toContain('tj-glass--subtle')
    expect(wrapper.attributes('data-glass')).toBe('on')
  })

  it('row 变体渲染纯色列表行且不进入增强路径', () => {
    const wrapper = mountGlass({ variant: 'row' })

    expect(wrapper.classes()).toContain('tj-glass--row')
    expect(wrapper.attributes('data-glass')).toBe('on')
    expect(wrapper.find('.tj-glass__engine').exists()).toBe(false)
  })

  it('variant="none" 输出 data-glass="off"', () => {
    const wrapper = mountGlass({ variant: 'none' })

    expect(wrapper.classes()).toContain('tj-glass--none')
    expect(wrapper.attributes('data-glass')).toBe('off')
  })

  it('tone 与 radius 映射为对应类名', () => {
    const wrapper = mountGlass({ tone: 'sheet', radius: 'full' })

    expect(wrapper.classes()).toContain('tj-glass--tone-sheet')
    expect(wrapper.classes()).toContain('tj-glass--radius-full')
  })

  it('默认不渲染折射增强节点', () => {
    const wrapper = mountGlass()

    expect(wrapper.find('.tj-glass__engine').exists()).toBe(false)
  })

  it('high 档 + auto + 显式开启折射时渲染增强节点', () => {
    const glass = useGlassEffectStore()
    glass.advancedRefraction = true
    glass.syncTier('high')

    const wrapper = mountGlass()

    const engine = wrapper.find('.tj-glass__engine')
    expect(engine.exists()).toBe(true)
    expect(engine.attributes('aria-hidden')).toBe('true')
  })

  it('engine="off" 时即使满足条件也不渲染增强节点', () => {
    const glass = useGlassEffectStore()
    glass.advancedRefraction = true
    glass.syncTier('high')

    const wrapper = mountGlass({ engine: 'off' })

    expect(wrapper.find('.tj-glass__engine').exists()).toBe(false)
  })

  it('用户关闭玻璃时追加纯色兜底类', () => {
    const glass = useGlassEffectStore()
    glass.mode = 'off'

    const wrapper = mountGlass()

    expect(wrapper.classes()).toContain('tj-glass--flat')
  })

  it('low 档追加纯色兜底类并同步 data-tier', () => {
    const glass = useGlassEffectStore()
    glass.syncTier('low')

    const wrapper = mountGlass()

    expect(wrapper.classes()).toContain('tj-glass--flat')
    expect(wrapper.attributes('data-tier')).toBe('low')
    expect(wrapper.find('.tj-glass__engine').exists()).toBe(false)
  })
})
