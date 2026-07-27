import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, type Ref, ref } from 'vue'

const mockWebviewWindow = { label: 'home' }

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getCurrent: () => mockWebviewWindow
  }
}))

// Step 2.3：mock useResponsiveBreakpoint，提供可变的 mode/centerWidth/isShrink
const modeRef = ref<'wide' | 'normal' | 'shrink'>('wide') as Ref<'wide' | 'normal' | 'shrink'>
const centerWidthRef = ref(280)
const isShrinkRef = ref(false)
const isRightPaneFullscreenRef = ref(false)

vi.mock('@/composables/layout/useResponsiveBreakpoint', () => ({
  useResponsiveBreakpoint: () => ({
    mode: modeRef,
    centerWidth: centerWidthRef,
    isShrink: isShrinkRef,
    isRightPaneFullscreen: isRightPaneFullscreenRef
  })
}))

const mittHandlers = new Map<string, ((data?: unknown) => void)[]>()
vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    on: (event: string, handler: (data?: unknown) => void) => {
      const list = mittHandlers.get(event) ?? []
      list.push(handler)
      mittHandlers.set(event, list)
    },
    emit: (event: string, data?: unknown) => {
      const list = mittHandlers.get(event) ?? []
      list.forEach((fn) => fn(data))
    },
    off: (event: string, handler: (data?: unknown) => void) => {
      const list = mittHandlers.get(event) ?? []
      const idx = list.indexOf(handler)
      if (idx >= 0) list.splice(idx, 1)
    }
  }
}))

vi.mock('@/components/windows/ActionBar.vue', () => ({
  default: defineComponent({
    name: 'ActionBar',
    props: ['shrinkStatus', 'maxW', 'currentLabel'],
    setup: () => () => h('div', { class: 'action-bar-stub' })
  })
}))

vi.mock('vue-router', () => ({
  RouterView: defineComponent({
    name: 'RouterView',
    setup: () => () => h('div', { class: 'router-view-stub' })
  })
}))

import CenterLayout from '../index.vue'

describe('CenterLayout — Step 2.3 响应式断点', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mittHandlers.clear()
    setActivePinia(createPinia())
    modeRef.value = 'wide'
    centerWidthRef.value = 280
    isShrinkRef.value = false
    isRightPaneFullscreenRef.value = false
  })

  afterEach(() => {
    document.body.innerHTML = ''
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  async function mountCenter() {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(CenterLayout, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: {
          RouterView: true
        }
      }
    })
    await nextTick()
    return wrapper
  }

  it('wide 模式中间栏宽度为 280px', async () => {
    centerWidthRef.value = 280
    const wrapper = await mountCenter()
    const center = wrapper.find('#center')
    expect(center.exists()).toBe(true)
    const style = center.attributes('style') || ''
    expect(style).toContain('280px')
    wrapper.unmount()
  })

  it('normal 模式中间栏宽度为 240px', async () => {
    centerWidthRef.value = 240
    const wrapper = await mountCenter()
    const center = wrapper.find('#center')
    const style = center.attributes('style') || ''
    expect(style).toContain('240px')
    wrapper.unmount()
  })

  it('shrink 模式中间栏宽度为 64px', async () => {
    isShrinkRef.value = true
    const wrapper = await mountCenter()
    const center = wrapper.find('#center')
    const style = center.attributes('style') || ''
    expect(style).toContain('64px')
    wrapper.unmount()
  })

  it('shrink 模式下显示 ActionBar', async () => {
    isShrinkRef.value = true
    const wrapper = await mountCenter()
    const actionBar = wrapper.find('.action-bar-stub')
    expect(actionBar.exists()).toBe(true)
    wrapper.unmount()
  })

  it('非 shrink 模式下显示 resize-handle', async () => {
    isShrinkRef.value = false
    const wrapper = await mountCenter()
    const handle = wrapper.find('.resize-handle')
    expect(handle.exists()).toBe(true)
    wrapper.unmount()
  })

  it('shrink 模式下隐藏 resize-handle', async () => {
    isShrinkRef.value = true
    const wrapper = await mountCenter()
    const handle = wrapper.find('.resize-handle')
    expect(handle.attributes('style')).toContain('display: none')
    wrapper.unmount()
  })

  it('断点变化时中间栏宽度跟随更新', async () => {
    centerWidthRef.value = 280
    const wrapper = await mountCenter()
    expect(wrapper.find('#center').attributes('style') || '').toContain('280px')

    centerWidthRef.value = 240
    await nextTick()
    expect(wrapper.find('#center').attributes('style') || '').toContain('240px')

    isShrinkRef.value = true
    await nextTick()
    expect(wrapper.find('#center').attributes('style') || '').toContain('64px')

    wrapper.unmount()
  })

  it('resize-handle 有 touch-action: none 样式（兼容触摸）', async () => {
    isShrinkRef.value = false
    const wrapper = await mountCenter()
    const handle = wrapper.find('.resize-handle')
    expect(handle.attributes('style')).toContain('touch-action: none')
    wrapper.unmount()
  })
})
