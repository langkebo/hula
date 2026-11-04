import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SmartVirtualList from '../SmartVirtualList.vue'

const source = readFileSync(
  resolve(process.cwd(), 'src/mobile/components/virtual-scroll/SmartVirtualList.vue'),
  'utf-8'
)

class ResizeObserverStub {
  static instances: ResizeObserverStub[] = []

  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn(() => {
    this.disconnected = true
  })

  disconnected = false

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.push(this)
  }

  trigger(height: number) {
    if (this.disconnected) return
    this.callback([{ contentRect: { height } } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}

const makeItems = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `item-${index}` }))

const mountList = () =>
  mount(SmartVirtualList, {
    props: { items: makeItems(200), itemHeight: 50, buffer: 5 },
    global: {
      stubs: { 'van-loading': true }
    }
  })

describe('SmartVirtualList sizing', () => {
  beforeEach(() => {
    ResizeObserverStub.instances = []
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('tracks container height with a ResizeObserver', () => {
    expect(source).toContain('new ResizeObserver')
    expect(source).toContain("typeof ResizeObserver !== 'undefined'")
    expect(source).toContain('containerHeight.value')
  })

  it('reads the fallback row height reactively', () => {
    expect(source).toContain('const itemHeight = computed(() => props.itemHeight)')
    expect(source).not.toContain('const ITEM_HEIGHT = props.itemHeight')
  })

  it('coalesces measurement into one animation frame', () => {
    expect(source).toContain('requestAnimationFrame')
    expect(source).not.toContain('nextTick(() => {\n    updateItemHeights()\n  })')
  })

  it('observes the container and disconnects on unmount', () => {
    const wrapper = mountList()

    expect(ResizeObserverStub.instances).toHaveLength(1)
    const observer = ResizeObserverStub.instances[0]
    expect(observer.observe).toHaveBeenCalledTimes(1)
    expect(observer.observe).toHaveBeenCalledWith(wrapper.find('.smart-virtual-list').element)

    wrapper.unmount()
    expect(observer.disconnect).toHaveBeenCalledTimes(1)
  })

  it('recomputes the render range when the container resizes', async () => {
    const wrapper = mountList()
    const observer = ResizeObserverStub.instances[0]

    const initialCount = wrapper.findAll('.virtual-item').length
    expect(initialCount).toBe(21)

    observer.trigger(1000)
    await wrapper.vm.$nextTick()

    const resizedCount = wrapper.findAll('.virtual-item').length
    expect(resizedCount).toBe(31)
    expect(resizedCount).not.toBe(initialCount)

    observer.trigger(300)
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.virtual-item').length).toBe(17)
  })

  it('rebuilds total height and render range when itemHeight changes', async () => {
    const wrapper = mountList()
    const observer = ResizeObserverStub.instances[0]

    observer.trigger(1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.virtual-item').length).toBe(31)
    expect(wrapper.find('.phantom').attributes('style')).toContain('10000px')

    await wrapper.setProps({ itemHeight: 20 })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.phantom').attributes('style')).toContain('4000px')
    expect(wrapper.findAll('.virtual-item').length).toBe(61)
  })

  it('falls back to a window resize listener without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const wrapper = mountList()

    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function))

    wrapper.unmount()

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})
