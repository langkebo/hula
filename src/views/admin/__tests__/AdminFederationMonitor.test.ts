import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminFederationMonitor from '../AdminFederationMonitor.vue'

const { getBlacklistMock, getServerStatusMock, reconnectMock, showFeedbackMock } = vi.hoisted(() => ({
  getBlacklistMock: vi.fn(),
  getServerStatusMock: vi.fn(),
  reconnectMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getFederationBlacklist: getBlacklistMock,
    getFederationServerStatus: getServerStatusMock,
    reconnectFederation: reconnectMock
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('@/components/federation/FedStatusBadge.vue', () => ({
  default: {
    name: 'FedStatusBadge',
    props: ['status', 'size'],
    template: '<span data-test="FedStatusBadge">{{ status }}</span>'
  }
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      props: [
        'show',
        'title',
        'subtitle',
        'cols',
        'xGap',
        'yGap',
        'responsive',
        'itemResponsive',
        'span',
        'size',
        'label'
      ],
      setup(props, { slots }) {
        return () =>
          h(tag, { 'data-test': name }, [
            props.label ? h('span', { 'data-test': `${name}-label` }, String(props.label)) : null,
            slots.default?.(),
            slots.extra?.()
          ])
      }
    })

  return {
    NButton: defineComponent({
      name: 'NButton',
      props: ['loading', 'type', 'size'],
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NCard: passthrough('NCard'),
    NDataTable: defineComponent({
      name: 'NDataTable',
      props: ['data', 'columns', 'loading', 'pagination', 'rowKey', 'striped'],
      setup(props) {
        return () => h('div', { 'data-test': 'NDataTable' }, JSON.stringify(props.data ?? []))
      }
    }),
    NGi: passthrough('NGi'),
    NGrid: passthrough('NGrid'),
    NInput: defineComponent({
      name: 'NInput',
      props: ['value', 'placeholder', 'clearable'],
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            'data-test': 'NInput',
            value: props.value as string,
            onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
          })
      }
    }),
    NPageHeader: passthrough('NPageHeader'),
    NSpace: passthrough('NSpace'),
    NStatistic: passthrough('NStatistic')
  }
})

describe('AdminFederationMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getBlacklistMock.mockResolvedValue([{ domain: 'matrix.org' }, { domain: 'example.com' }])
    getServerStatusMock.mockImplementation(async (serverName: string) => {
      if (serverName === 'matrix.org') {
        return { reachable: true, failure_count: 0, last_successful_stream_ordering: 1700000000000 }
      }
      return { reachable: false }
    })
    reconnectMock.mockResolvedValue(undefined)
  })

  const mountComponent = () => mount(AdminFederationMonitor)

  it('挂载时加载联邦服务器列表', async () => {
    mountComponent()
    await flushPromises()

    expect(getBlacklistMock).toHaveBeenCalledTimes(1)
    expect(getServerStatusMock).toHaveBeenCalledWith('matrix.org')
    expect(getServerStatusMock).toHaveBeenCalledWith('example.com')
  })

  it('根据服务器可达性与失败数计算状态统计', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    // matrix.org → online，example.com → offline
    expect(wrapper.text()).toContain('1') // online count
    const table = wrapper.findComponent({ name: 'NDataTable' })
    expect(table.text()).toContain('matrix.org')
    expect(table.text()).toContain('offline')
  })

  it('可达但有失败记录的服务器标记为 degraded', async () => {
    getServerStatusMock.mockResolvedValue({ reachable: true, failure_count: 3 })
    const wrapper = mountComponent()
    await flushPromises()

    const table = wrapper.findComponent({ name: 'NDataTable' })
    expect(table.text()).toContain('degraded')
  })

  it('搜索框过滤服务器列表', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const searchInput = wrapper.find('input[data-test="NInput"]')
    await searchInput.setValue('matrix')
    await flushPromises()

    const table = wrapper.findComponent({ name: 'NDataTable' })
    expect(table.text()).toContain('matrix.org')
    expect(table.text()).not.toContain('example.com')
  })

  it('加载失败时记录日志但不崩溃', async () => {
    getBlacklistMock.mockRejectedValue(new Error('network down'))
    const wrapper = mountComponent()
    await flushPromises()

    // 页面仍然渲染，表格为空
    const table = wrapper.findComponent({ name: 'NDataTable' })
    expect(table.exists()).toBe(true)
    expect(table.text()).toBe('[]')
  })
})
