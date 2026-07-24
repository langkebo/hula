import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { useSettingStore } from '@/stores/domains/settings/setting'

const mockWebviewWindow = {
  label: 'home'
}

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getCurrent: () => mockWebviewWindow
  }
}))

vi.mock('@vueuse/core', () => ({
  useWindowSize: () => ({
    width: { value: 1920 },
    height: { value: 1080 }
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

const timerManagerMock = {
  setTimeout: vi.fn((cb: () => void, _delay: number) => {
    cb()
    return 0
  }),
  clearTimeout: vi.fn(),
  clearAll: vi.fn()
}
vi.mock('@/utils/TimerManager', () => ({
  useTimerManager: () => timerManagerMock
}))

vi.mock('vue-router', () => ({
  RouterView: defineComponent({
    name: 'RouterView',
    setup: () => () => h('div', { class: 'router-view-stub' })
  })
}))

import CenterLayout from '../index.vue'

// jsdom 不做真实布局，getBoundingClientRect 返回 0
// 需要 mock 为合理的布局尺寸，避免组件进入 shrink 模式
function setupLayoutDOM() {
  const layout = document.createElement('div')
  layout.id = 'layout'
  layout.style.width = '1920px'

  const left = document.createElement('div')
  left.className = 'left'
  left.style.width = '64px'

  layout.appendChild(left)
  document.body.appendChild(layout)

  // Mock getBoundingClientRect for layout and left elements
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.id === 'layout') {
      return { width: 1920, height: 1080, x: 0, y: 0, top: 0, left: 0, right: 1920, bottom: 1080, toJSON: () => ({}) }
    }
    if (this.classList?.contains('left')) {
      return { width: 64, height: 1080, x: 0, y: 0, top: 0, left: 0, right: 64, bottom: 1080, toJSON: () => ({}) }
    }
    return originalGetBoundingClientRect.call(this)
  })
}

describe('CenterLayout — 中间栏宽度持久化', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mittHandlers.clear()
    setActivePinia(createPinia())
    setupLayoutDOM()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  async function mountCenter() {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useSettingStore()

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
    return { wrapper, store }
  }

  it('从 settingStore 恢复持久化的宽度', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useSettingStore()
    store.setPanelWidth(320)

    const wrapper = mount(CenterLayout, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: { RouterView: true }
      }
    })
    await nextTick()

    const center = wrapper.find('#center')
    expect(center.exists()).toBe(true)
    // centerStyle 的 width 应基于 store 中持久化的 320px
    const style = center.attributes('style') || ''
    expect(style).toContain('320px')

    wrapper.unmount()
  })

  it('pointerdown 在 resize-handle 上启动拖拽并设置 cursor', async () => {
    const { wrapper } = await mountCenter()

    const handle = wrapper.find('.resize-handle')
    expect(handle.exists()).toBe(true)

    await handle.trigger('pointerdown', { clientX: 500, clientY: 100 })

    expect(document.body.style.cursor).toBe('col-resize')
    expect(document.body.style.userSelect).toBe('none')

    wrapper.unmount()
  })

  it('pointermove 拖拽时宽度被限制在 240-360px 范围内', async () => {
    const { wrapper } = await mountCenter()

    const handle = wrapper.find('.resize-handle')
    await handle.trigger('pointerdown', { clientX: 500, clientY: 100 })

    // 模拟向左大幅拖拽（起始宽度 280，向左移动 500px → 应被限制到 240）
    const moveEvent = new PointerEvent('pointermove', { clientX: 0, clientY: 100 })
    document.dispatchEvent(moveEvent)
    await nextTick()
    // 等待 requestAnimationFrame 回调
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await nextTick()

    const center = wrapper.find('#center')
    const style = center.attributes('style') || ''
    // 宽度不应低于 240
    expect(style).toContain('240px')

    wrapper.unmount()
  })

  it('pointerup 结束拖拽时持久化宽度到 store', async () => {
    const { wrapper, store } = await mountCenter()
    const initialWidth = store.panelWidth

    const handle = wrapper.find('.resize-handle')
    await handle.trigger('pointerdown', { clientX: 500, clientY: 100 })

    // 模拟拖拽到 300px 位置（从 280 起始，向右移动 20px → 300）
    const moveEvent = new PointerEvent('pointermove', { clientX: 520, clientY: 100 })
    document.dispatchEvent(moveEvent)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await nextTick()

    // 结束拖拽
    const upEvent = new PointerEvent('pointerup')
    document.dispatchEvent(upEvent)
    await nextTick()

    // store 应被更新（宽度从 280 变为 300）
    expect(store.panelWidth).not.toBe(initialWidth)
    expect(store.panelWidth).toBeGreaterThanOrEqual(240)
    expect(store.panelWidth).toBeLessThanOrEqual(360)

    wrapper.unmount()
  })

  it('pointerup 结束后清除 cursor 样式', async () => {
    const { wrapper } = await mountCenter()

    const handle = wrapper.find('.resize-handle')
    await handle.trigger('pointerdown', { clientX: 500, clientY: 100 })
    expect(document.body.style.cursor).toBe('col-resize')

    const upEvent = new PointerEvent('pointerup')
    document.dispatchEvent(upEvent)
    await nextTick()

    expect(document.body.style.cursor).toBe('')

    wrapper.unmount()
  })

  it('resize-handle 有 touch-action: none 样式（兼容触摸）', async () => {
    const { wrapper } = await mountCenter()
    const handle = wrapper.find('.resize-handle')
    expect(handle.attributes('style')).toContain('touch-action: none')
    wrapper.unmount()
  })
})
