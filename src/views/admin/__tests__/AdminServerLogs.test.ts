import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import AdminServerLogs from '../AdminServerLogs.vue'

const { loadPanelMock, state } = vi.hoisted(() => ({
  loadPanelMock: vi.fn(),
  state: {
    loading: false,
    status: null as { status: string; uptime?: number } | null,
    health: null as { healthy: boolean; checks?: Record<string, unknown> } | null,
    version: null as { serverVersion?: string; pythonVersion?: string } | null,
    stats: null as { userCount?: number; roomCount?: number; dailyActiveUsers?: number } | null
  }
}))

vi.mock('@/composables/admin', () => ({
  useAdminServerLogs: () => ({
    loading: ref(state.loading),
    status: ref(state.status),
    health: ref(state.health),
    version: ref(state.version),
    stats: ref(state.stats),
    loadPanel: loadPanelMock
  })
}))

vi.mock('@/components/common/EmptyState.vue', () => ({
  default: {
    name: 'EmptyState',
    props: ['icon', 'description'],
    template: '<div data-test="EmptyState">{{ description }}</div>'
  }
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      props: ['show', 'title', 'subtitle', 'type', 'bordered', 'column', 'labelPlacement', 'size', 'label'],
      setup(props, { slots }) {
        return () =>
          h(tag, { 'data-test': name }, [
            props.title ? h('span', { 'data-test': `${name}-title` }, String(props.title)) : null,
            props.label ? h('span', { 'data-test': `${name}-label` }, String(props.label)) : null,
            slots.default?.(),
            slots.extra?.()
          ])
      }
    })

  return {
    NAlert: passthrough('NAlert'),
    NButton: defineComponent({
      name: 'NButton',
      props: ['loading'],
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NCard: passthrough('NCard'),
    NDescriptions: passthrough('NDescriptions'),
    NDescriptionsItem: passthrough('NDescriptionsItem'),
    NPageHeader: passthrough('NPageHeader'),
    NSpin: passthrough('NSpin'),
    NTag: defineComponent({
      name: 'NTag',
      props: ['type'],
      setup(props, { slots }) {
        return () => h('span', { 'data-test': 'NTag', 'data-type': props.type }, slots.default?.())
      }
    })
  }
})

describe('AdminServerLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.loading = false
    state.status = { status: 'online', uptime: 90061000 }
    state.health = { healthy: true, checks: { db: 'ok' } }
    state.version = { serverVersion: '1.2.3', pythonVersion: '3.11' }
    state.stats = { userCount: 100, roomCount: 50, dailyActiveUsers: 42 }
    loadPanelMock.mockResolvedValue(undefined)
  })

  const mountComponent = () => mount(AdminServerLogs)

  it('挂载时加载服务器面板数据', async () => {
    mountComponent()
    await flushPromises()

    expect(loadPanelMock).toHaveBeenCalledTimes(1)
  })

  it('渲染状态、健康、版本与统计信息', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('Online')
    expect(wrapper.text()).toContain('Healthy')
    expect(wrapper.text()).toContain('1.2.3')
    expect(wrapper.text()).toContain('3.11')
    expect(wrapper.text()).toContain('100')
    expect(wrapper.text()).toContain('50')
    expect(wrapper.text()).toContain('42')
  })

  it('在线状态使用 success 标签类型', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const statusTag = wrapper.findAllComponents({ name: 'NTag' })[0]
    expect(statusTag.attributes('data-type')).toBe('success')
  })

  it('降级状态显示 Degraded 并使用 warning 标签', async () => {
    state.status = { status: 'degraded', uptime: 1000 }
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('Degraded')
    const statusTag = wrapper.findAllComponents({ name: 'NTag' })[0]
    expect(statusTag.attributes('data-type')).toBe('warning')
  })

  it('不健康状态显示 Unhealthy 与 error 标签', async () => {
    state.health = { healthy: false, checks: {} }
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('Unhealthy')
    const healthTag = wrapper.findAllComponents({ name: 'NTag' })[1]
    expect(healthTag.attributes('data-type')).toBe('error')
  })

  it('运行时长格式化为天/时/分', async () => {
    // 90061000 ms > 1_000_000 → 按秒处理：90061s = 1d 1h 1m
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('1d 1h 1m')
  })

  it('全部数据为空时展示 EmptyState', async () => {
    state.status = null
    state.health = null
    state.version = null
    state.stats = null
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'EmptyState' }).exists()).toBe(true)
  })

  it('点击刷新按钮重新加载面板', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    loadPanelMock.mockClear()

    const refreshButton = wrapper.findAll('button').find((b) => b.text().includes('common.refresh'))
    await refreshButton!.trigger('click')
    await flushPromises()

    expect(loadPanelMock).toHaveBeenCalledTimes(1)
  })
})
