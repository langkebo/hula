import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminModules from '../AdminModules.vue'

const { listModules } = vi.hoisted(() => ({ listModules: vi.fn() }))

vi.mock('@/services/matrix/admin', () => ({
  adminModuleService: { listModules }
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const NList = defineComponent({
    name: 'NList',
    props: { bordered: { type: Boolean, default: false } },
    setup(_, { slots }) {
      return () => h('div', { class: 'n-list' }, slots.default?.())
    }
  })

  const NListItem = defineComponent({
    name: 'NListItem',
    setup(_, { slots }) {
      return () => h('div', { class: 'n-list-item' }, slots.default?.())
    }
  })

  const NSelect = defineComponent({
    name: 'NSelect',
    props: {
      value: { type: String, default: '' },
      options: { type: Array, default: () => [] }
    },
    emits: ['update:value'],
    setup(props, { emit }) {
      return () =>
        h(
          'select',
          {
            class: 'n-select',
            value: props.value,
            onChange: (e: Event) => emit('update:value', (e.target as HTMLSelectElement).value)
          },
          props.options.map((opt: any) => h('option', { value: opt.value }, opt.label))
        )
    }
  })

  const NSpin = defineComponent({
    name: 'NSpin',
    props: { show: { type: Boolean, default: false } },
    setup(props, { slots }) {
      return () => h('div', { class: ['n-spin', { 'n-spin--loading': props.show }] }, slots.default?.())
    }
  })

  const NEmpty = defineComponent({
    name: 'NEmpty',
    props: { description: { type: String, default: '' } },
    setup(props) {
      return () => h('div', { class: 'n-empty', 'data-testid': 'empty-state' }, props.description)
    }
  })

  const NTag = defineComponent({
    name: 'NTag',
    props: {
      type: { type: String, default: 'default' },
      size: { type: String, default: 'medium' },
      round: { type: Boolean, default: false }
    },
    setup(_, { slots }) {
      return () => h('span', { class: 'n-tag', 'data-testid': 'module-status' }, slots.default?.())
    }
  })

  const NAlert = defineComponent({
    name: 'NAlert',
    props: { type: { type: String, default: 'default' } },
    setup(_, { slots }) {
      return () => h('div', { class: 'n-alert' }, slots.default?.())
    }
  })

  const NButton = defineComponent({
    name: 'NButton',
    props: {
      type: { type: String, default: 'default' },
      size: { type: String, default: 'medium' }
    },
    emits: ['click'],
    setup(_, { slots, emit }) {
      return () => h('button', { class: 'n-button', type: 'button', onClick: () => emit('click') }, slots.default?.())
    }
  })

  return { NAlert, NButton, NEmpty, NList, NListItem, NSelect, NSpin, NTag }
})

const sampleModules = [
  {
    id: 1,
    name: 'auth-service',
    type: 'auth',
    version: '1.2.0',
    status: 'loaded' as const,
    description: '认证服务模块',
    priority: 1,
    executionCount: 10,
    errorCount: 0,
    lastExecutedTs: null
  },
  {
    id: 2,
    name: 'message-queue',
    type: 'queue',
    version: '0.8.3',
    status: 'unloaded' as const,
    description: '消息队列模块',
    priority: 2,
    executionCount: 0,
    errorCount: 0,
    lastExecutedTs: null
  },
  {
    id: 3,
    name: 'storage-engine',
    type: 'storage',
    version: '2.1.0',
    status: 'failed' as const,
    description: '存储引擎模块',
    priority: 3,
    executionCount: 3,
    errorCount: 2,
    lastError: 'timeout',
    lastExecutedTs: 1700000000000
  }
]

const mountComponent = async () => {
  const wrapper = mount(AdminModules)
  await flushPromises()
  return wrapper
}

describe('AdminModules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listModules.mockResolvedValue({ modules: sampleModules, nextBatch: null })
  })

  it('挂载后拉取模块并渲染名称 + 版本 + 状态 + 描述', async () => {
    const wrapper = await mountComponent()
    expect(listModules).toHaveBeenCalledTimes(1)

    const items = wrapper.findAll('[data-testid="module-item"]')
    expect(items).toHaveLength(3)

    const first = items[0]!
    expect(first.text()).toContain('auth-service')
    expect(first.text()).toContain('1.2.0')
    expect(first.text()).toContain('admin.modules.status_loaded')
    expect(first.text()).toContain('认证服务模块')
  })

  it('加载中显示加载状态', async () => {
    listModules.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(AdminModules)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.n-spin').classes()).toContain('n-spin--loading')
  })

  it('空列表时显示空状态', async () => {
    listModules.mockResolvedValue({ modules: [], nextBatch: null })
    const wrapper = await mountComponent()
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="module-item"]')).toHaveLength(0)
  })

  it('拉取失败显示错误提示且不显示空状态', async () => {
    listModules.mockRejectedValue(new Error('network down'))
    const wrapper = await mountComponent()

    expect(wrapper.find('[data-testid="modules-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  it('错误提示的重试按钮会重新拉取', async () => {
    listModules.mockRejectedValueOnce(new Error('network down'))
    const wrapper = await mountComponent()
    expect(wrapper.find('[data-testid="modules-error"]').exists()).toBe(true)

    listModules.mockResolvedValue({ modules: sampleModules, nextBatch: null })
    await wrapper.find('[data-testid="modules-retry"]').trigger('click')
    await flushPromises()

    expect(listModules).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="modules-error"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="module-item"]')).toHaveLength(3)
  })

  it('按状态过滤（全部/已加载/未加载/加载失败）', async () => {
    const wrapper = await mountComponent()

    expect(wrapper.findAll('[data-testid="module-item"]')).toHaveLength(3)

    await wrapper.find('[data-testid="status-filter"]').setValue('loaded')
    let items = wrapper.findAll('[data-testid="module-item"]')
    expect(items).toHaveLength(1)
    expect(items[0]!.text()).toContain('auth-service')

    await wrapper.find('[data-testid="status-filter"]').setValue('unloaded')
    items = wrapper.findAll('[data-testid="module-item"]')
    expect(items).toHaveLength(1)
    expect(items[0]!.text()).toContain('message-queue')

    await wrapper.find('[data-testid="status-filter"]').setValue('failed')
    items = wrapper.findAll('[data-testid="module-item"]')
    expect(items).toHaveLength(1)
    expect(items[0]!.text()).toContain('storage-engine')

    await wrapper.find('[data-testid="status-filter"]').setValue('all')
    expect(wrapper.findAll('[data-testid="module-item"]')).toHaveLength(3)
  })

  it('模块状态使用三色类名标识，不写内联样式', async () => {
    const wrapper = await mountComponent()

    const loadedDot = wrapper.find('[data-status="loaded"] .status-dot')
    expect(loadedDot.classes()).toContain('status-dot--loaded')
    expect(loadedDot.attributes('style')).toBeUndefined()

    const unloadedDot = wrapper.find('[data-status="unloaded"] .status-dot')
    expect(unloadedDot.classes()).toContain('status-dot--unloaded')

    const failedDot = wrapper.find('[data-status="failed"] .status-dot')
    expect(failedDot.classes()).toContain('status-dot--failed')
  })

  it('组件有 role=region 可访问性属性', async () => {
    const wrapper = await mountComponent()
    expect(wrapper.find('[role="region"]').exists()).toBe(true)
  })
})
