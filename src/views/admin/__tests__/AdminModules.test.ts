import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminModules from '../AdminModules.vue'

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
    emits: ['click'],
    setup(_, { slots, emit }) {
      return () => h('div', { class: 'n-list-item', onClick: () => emit('click') }, slots.default?.())
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

  return { NButton, NEmpty, NList, NListItem, NSelect, NSpin, NTag }
})

interface ModuleInfo {
  name: string
  version: string
  status: 'loaded' | 'unloaded' | 'failed'
  description?: string
}

const sampleModules: ModuleInfo[] = [
  { name: 'auth-service', version: '1.2.0', status: 'loaded', description: '认证服务模块' },
  { name: 'message-queue', version: '0.8.3', status: 'unloaded', description: '消息队列模块' },
  { name: 'storage-engine', version: '2.1.0', status: 'failed', description: '存储引擎模块' }
]

const mountComponent = (props: Partial<{ modules: ModuleInfo[]; loading: boolean }> = {}) =>
  mount(AdminModules, {
    props: {
      modules: sampleModules,
      loading: false,
      ...props
    }
  })

describe('AdminModules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染模块列表（名称 + 版本 + 状态 + 描述）', () => {
    const wrapper = mountComponent()
    const items = wrapper.findAll('[data-testid="module-item"]')
    expect(items).toHaveLength(3)

    const first = items[0]!
    expect(first.text()).toContain('auth-service')
    expect(first.text()).toContain('1.2.0')
    expect(first.text()).toContain('admin.modules.status_loaded')
    expect(first.text()).toContain('认证服务模块')
  })

  it('loading=true 时显示加载状态', () => {
    const wrapper = mountComponent({ loading: true })
    expect(wrapper.find('.n-spin').classes()).toContain('n-spin--loading')
  })

  it('loading=false 时不显示加载状态', () => {
    const wrapper = mountComponent({ loading: false })
    expect(wrapper.find('.n-spin').classes()).not.toContain('n-spin--loading')
  })

  it('空列表时显示空状态', () => {
    const wrapper = mountComponent({ modules: [] })
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="module-item"]')).toHaveLength(0)
  })

  it('按状态过滤（全部/已加载/未加载/加载失败）', async () => {
    const wrapper = mountComponent()

    // 默认显示全部
    expect(wrapper.findAll('[data-testid="module-item"]')).toHaveLength(3)

    // 过滤：已加载
    await wrapper.find('[data-testid="status-filter"]').setValue('loaded')
    let items = wrapper.findAll('[data-testid="module-item"]')
    expect(items).toHaveLength(1)
    expect(items[0]!.text()).toContain('auth-service')

    // 过滤：未加载
    await wrapper.find('[data-testid="status-filter"]').setValue('unloaded')
    items = wrapper.findAll('[data-testid="module-item"]')
    expect(items).toHaveLength(1)
    expect(items[0]!.text()).toContain('message-queue')

    // 过滤：加载失败
    await wrapper.find('[data-testid="status-filter"]').setValue('failed')
    items = wrapper.findAll('[data-testid="module-item"]')
    expect(items).toHaveLength(1)
    expect(items[0]!.text()).toContain('storage-engine')

    // 切回全部
    await wrapper.find('[data-testid="status-filter"]').setValue('all')
    expect(wrapper.findAll('[data-testid="module-item"]')).toHaveLength(3)
  })

  it('模块状态使用三色标识（online=已加载/busy=加载中/offline=加载失败）', () => {
    const wrapper = mountComponent()

    const loadedDot = wrapper.find('[data-status="loaded"] .status-dot')
    expect(loadedDot.attributes('style')).toContain('--tjg-status-online')

    const unloadedDot = wrapper.find('[data-status="unloaded"] .status-dot')
    expect(unloadedDot.attributes('style')).toContain('--tjg-status-busy')

    const failedDot = wrapper.find('[data-status="failed"] .status-dot')
    expect(failedDot.attributes('style')).toContain('--tjg-status-offline')
  })

  it('点击模块项触发 view-detail 事件', async () => {
    const wrapper = mountComponent()
    const firstItem = wrapper.findAll('[data-testid="module-item"]')[0]!
    await firstItem.trigger('click')

    expect(wrapper.emitted('view-detail')).toBeTruthy()
    expect(wrapper.emitted('view-detail')![0]).toEqual(['auth-service'])
  })

  it('组件有 role=region 可访问性属性', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[role="region"]').exists()).toBe(true)
  })
})
