import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { useRefreshOnReactivate } from '../useRefreshOnReactivate'

/**
 * `useRefreshOnReactivate` 的两半语义必须同时钉住：
 * ① 首次挂载只加载一次（mounted 与 activated 同时触发，不能双请求）
 * ② 再次激活必须刷新（切 Tab 回来只走 activate，onMounted 不会重跑）
 *
 * 只测 ② 会漏掉「首次双请求」，只测 ① 会漏掉「根本不刷新」，两者都要。
 */

const refresh = vi.fn()
const load = vi.fn()

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

/** 被测组件：只暴露 composable 行为，不掺 UI */
const Probe = defineComponent({
  name: 'RefreshProbe',
  setup() {
    useRefreshOnReactivate(() => refresh())
    return {}
  },
  template: '<div />'
})

function mountInKeepAlive() {
  const Host = defineComponent({
    name: 'RefreshProbeHost',
    components: { Probe },
    props: { visible: { type: Boolean, default: true } },
    template: '<KeepAlive><Probe v-if="visible" /></KeepAlive>'
  })
  return mount(Host, { props: { visible: true } })
}

describe('useRefreshOnReactivate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refresh.mockResolvedValue(undefined)
  })

  it('首次挂载只调用一次', async () => {
    mountInKeepAlive()
    await flushPromises()

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('重新激活（切 Tab 回来）时再调用一次', async () => {
    const wrapper = mountInKeepAlive()
    await flushPromises()
    expect(refresh).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    await flushPromises()

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('多次来回切换每次都刷新，不会只刷一次', async () => {
    const wrapper = mountInKeepAlive()
    await flushPromises()

    for (let i = 0; i < 3; i += 1) {
      await wrapper.setProps({ visible: false })
      await wrapper.setProps({ visible: true })
      await flushPromises()
    }

    expect(refresh).toHaveBeenCalledTimes(4)
  })

  it('不在 keep-alive 内时只按 mounted 加载一次，不报错', async () => {
    mount(Probe)
    await flushPromises()

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('刷新回调抛错时不产生未捕获 rejection，也不影响后续激活', async () => {
    const wrapper = mountInKeepAlive()
    await flushPromises()

    refresh.mockRejectedValueOnce(new Error('boom'))
    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    await flushPromises()

    // 抛错那次计数仍然发生，且组件还活着，下一次激活照常刷新
    expect(refresh).toHaveBeenCalledTimes(2)

    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    await flushPromises()
    expect(refresh).toHaveBeenCalledTimes(3)
  })

  it('回调同步抛错时被兜住，不冒泡到渲染', async () => {
    const throwing = vi.fn(() => {
      throw new Error('sync boom')
    })
    const SyncProbe = defineComponent({
      name: 'SyncThrowProbe',
      setup() {
        useRefreshOnReactivate(throwing)
        return {}
      },
      template: '<div />'
    })

    expect(() => mount(SyncProbe)).not.toThrow()
    await flushPromises()
    expect(throwing).toHaveBeenCalledTimes(1)
  })

  /**
   * 双回调语义：初次加载与再次激活必须是两次不同的调用。
   *
   * 这不是洁癖：曾经只给一个回调、并在里写 { silent: true }，
   * 结果首次加载也静默，`loading` 初值为 true 的页面永久卡在加载态。
   */
  it('mount 用 load、activate 用 refresh，两者互不串用', async () => {
    const Host = defineComponent({
      name: 'TwoCallbackHost',
      components: {
        Probe: defineComponent({
          name: 'TwoCallbackProbe',
          setup() {
            useRefreshOnReactivate(
              () => load(),
              () => refresh()
            )
            return {}
          },
          template: '<div />'
        })
      },
      props: { visible: { type: Boolean, default: true } },
      template: '<KeepAlive><Probe v-if="visible" /></KeepAlive>'
    })

    const wrapper = mount(Host, { props: { visible: true } })
    await flushPromises()

    expect(load).toHaveBeenCalledTimes(1)
    expect(refresh).not.toHaveBeenCalled()

    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    await flushPromises()

    expect(load).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
