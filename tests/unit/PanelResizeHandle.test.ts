import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import PanelResizeHandle from '@/components/common/PanelResizeHandle.vue'
import { useSettingStore } from '@/stores/domains/settings/setting'

// happy-dom 可能不提供 PointerEvent 构造函数，使用兼容方式派发事件
function dispatchPointerEvent(type: string, clientX?: number) {
  let event: Event
  try {
    event = new PointerEvent(type, clientX !== undefined ? { clientX } : undefined)
  } catch {
    event = new Event(type)
    if (clientX !== undefined) {
      Object.defineProperty(event, 'clientX', { value: clientX })
    }
  }
  window.dispatchEvent(event)
}

describe('PanelResizeHandle', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders a col-resize handle', () => {
    const wrapper = mount(PanelResizeHandle, { props: { side: 'left' } })
    expect(wrapper.find('[data-testid="panel-resize-handle"]').exists()).toBe(true)
    expect(wrapper.attributes('style')).toContain('cursor: col-resize')
  })

  it('updates panelWidth in store on pointermove', async () => {
    const store = useSettingStore()
    const wrapper = mount(PanelResizeHandle, { props: { side: 'left' } })
    const handle = wrapper.find('[data-testid="panel-resize-handle"]')

    // 模拟 pointerdown → pointermove
    // 新逻辑基于 delta：startX=280, startWidth=320(默认), move 到 320 → delta=40, 新宽度=360
    await handle.trigger('pointerdown', { clientX: 280 })
    // 模拟全局 pointermove
    dispatchPointerEvent('pointermove', 320)
    dispatchPointerEvent('pointerup')

    expect(store.panelWidth.left).toBe(360) // startWidth(320) + delta(40) = 360，在 200-600 范围内
  })

  it('clamps width to min 200 for left', async () => {
    const store = useSettingStore()
    const wrapper = mount(PanelResizeHandle, { props: { side: 'left' } })
    await wrapper.find('[data-testid="panel-resize-handle"]').trigger('pointerdown', { clientX: 280 })
    dispatchPointerEvent('pointermove', 100)
    dispatchPointerEvent('pointerup')
    expect(store.panelWidth.left).toBe(200)
  })
})
