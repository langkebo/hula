import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminExternalServices from '../AdminExternalServices.vue'

const holder = vi.hoisted(() => ({ state: {} as Record<string, unknown> }))

vi.mock('@/composables/admin', async () => {
  const { ref } = await import('vue')
  holder.state = {
    services: ref([]),
    healthMap: ref({}),
    loading: ref(false),
    error: ref(null),
    serviceType: ref('all'),
    checkingId: ref(null),
    mutating: ref(false),
    clientHealth: ref(null),
    clientServices: ref([]),
    clientLoading: ref(false),
    clientMutatingId: ref(null),
    loadServices: vi.fn().mockResolvedValue(undefined),
    registerService: vi.fn().mockResolvedValue(true),
    setEnabled: vi.fn().mockResolvedValue(true),
    checkHealth: vi.fn().mockResolvedValue(undefined),
    removeService: vi.fn().mockResolvedValue(true),
    loadClientHealth: vi.fn().mockResolvedValue(undefined),
    setClientEnabled: vi.fn().mockResolvedValue(true),
    removeClientService: vi.fn().mockResolvedValue(true)
  }
  return { useAdminExternalServices: () => holder.state }
})

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const NPageHeader = defineComponent({
    name: 'NPageHeader',
    props: { title: { type: String, default: '' }, subtitle: { type: String, default: '' } },
    setup(props, { slots }) {
      return () => h('header', { class: 'n-page-header' }, [props.title, slots.extra?.()])
    }
  })

  const NAlert = defineComponent({
    name: 'NAlert',
    setup(_, { slots }) {
      return () => h('div', { class: 'n-alert' }, slots.default?.())
    }
  })

  const NButton = defineComponent({
    name: 'NButton',
    props: {
      loading: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false }
    },
    setup(_, { slots }) {
      return () => h('button', { class: 'n-button', type: 'button' }, slots.default?.())
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
          (props.options as { label: string; value: string }[]).map((opt) =>
            h('option', { value: opt.value }, opt.label)
          )
        )
    }
  })

  const NSpin = defineComponent({
    name: 'NSpin',
    setup(_, { slots }) {
      return () => h('div', { class: 'n-spin' }, slots.default?.())
    }
  })

  const NList = defineComponent({
    name: 'NList',
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

  const NTag = defineComponent({
    name: 'NTag',
    setup(_, { slots }) {
      return () => h('span', { class: 'n-tag' }, slots.default?.())
    }
  })

  const NSwitch = defineComponent({
    name: 'NSwitch',
    props: { value: { type: Boolean, default: false } },
    emits: ['update:value'],
    setup(props, { emit }) {
      return () =>
        h('button', {
          class: 'n-switch',
          type: 'button',
          'data-value': String(props.value),
          onClick: () => emit('update:value', !props.value)
        })
    }
  })

  const NPopconfirm = defineComponent({
    name: 'NPopconfirm',
    emits: ['positive-click'],
    setup(_, { slots, emit }) {
      return () =>
        h('span', { class: 'n-popconfirm' }, [
          slots.trigger?.(),
          h('button', { class: 'popconfirm-positive', type: 'button', onClick: () => emit('positive-click') }, 'ok')
        ])
    }
  })

  const NModal = defineComponent({
    name: 'NModal',
    props: { show: { type: Boolean, default: false }, title: { type: String, default: '' } },
    setup(props, { slots }) {
      return () =>
        props.show
          ? h('div', { class: 'n-modal', 'data-testid': 'register-modal' }, [
              props.title,
              slots.default?.(),
              slots.footer?.()
            ])
          : null
    }
  })

  const NForm = defineComponent({
    name: 'NForm',
    setup(_, { slots }) {
      return () => h('form', { class: 'n-form' }, slots.default?.())
    }
  })

  const NFormItem = defineComponent({
    name: 'NFormItem',
    props: { label: { type: String, default: '' } },
    setup(props, { slots }) {
      return () => h('div', { class: 'n-form-item' }, [props.label, slots.default?.()])
    }
  })

  const NInput = defineComponent({
    name: 'NInput',
    props: { value: { type: String, default: '' } },
    emits: ['update:value'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          class: 'n-input',
          value: props.value,
          onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
        })
    }
  })

  const NCard = defineComponent({
    name: 'NCard',
    props: { size: { type: String, default: '' } },
    setup(_, { slots }) {
      return () => h('div', { class: 'n-card' }, [slots.header?.(), slots.default?.()])
    }
  })

  const NEmpty = defineComponent({
    name: 'NEmpty',
    props: { description: { type: String, default: '' } },
    setup(props) {
      return () => h('div', { class: 'n-empty', 'data-testid': 'empty-state' }, props.description)
    }
  })

  return {
    NAlert,
    NButton,
    NCard,
    NEmpty,
    NForm,
    NFormItem,
    NInput,
    NList,
    NListItem,
    NModal,
    NPageHeader,
    NPopconfirm,
    NSelect,
    NSpin,
    NSwitch,
    NTag
  }
})

const state = holder.state as {
  services: { value: unknown[] }
  healthMap: { value: Record<string, unknown> }
  loading: { value: boolean }
  error: { value: string | null }
  serviceType: { value: string }
  checkingId: { value: string | null }
  mutating: { value: boolean }
  clientServices: { value: { id: string; type: string; status: string; last_check?: number }[] }
  clientLoading: { value: boolean }
  clientMutatingId: { value: string | null }
  loadServices: ReturnType<typeof vi.fn>
  registerService: ReturnType<typeof vi.fn>
  setEnabled: ReturnType<typeof vi.fn>
  checkHealth: ReturnType<typeof vi.fn>
  removeService: ReturnType<typeof vi.fn>
  loadClientHealth: ReturnType<typeof vi.fn>
  setClientEnabled: ReturnType<typeof vi.fn>
  removeClientService: ReturnType<typeof vi.fn>
}

const sampleServices = [
  {
    as_id: 'as-1',
    service_type: 'webhook',
    service_id: 'hook-a',
    display_name: 'Hook A',
    is_enabled: true,
    is_healthy: true,
    created_ts: 1700000000000
  },
  {
    as_id: 'as-2',
    service_type: 'slack',
    service_id: 'slack-b',
    display_name: 'Slack B',
    is_enabled: false,
    is_healthy: false,
    created_ts: 1700000000000
  }
]

const mountComponent = async () => {
  const wrapper = mount(AdminExternalServices)
  await flushPromises()
  return wrapper
}

describe('AdminExternalServices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.services.value = []
    state.healthMap.value = {}
    state.loading.value = false
    state.error.value = null
    state.serviceType.value = 'all'
    state.checkingId.value = null
    state.mutating.value = false
    state.clientServices.value = []
    state.clientLoading.value = false
    state.clientMutatingId.value = null
  })

  it('挂载后拉取列表并渲染名称/类型/健康状态', async () => {
    state.services.value = sampleServices
    state.healthMap.value = {
      'hook-a': { service_id: 'hook-a', is_healthy: true, last_check_ts: 1700000001000, last_error: null },
      'slack-b': { service_id: 'slack-b', is_healthy: false, last_check_ts: null, last_error: 'timeout' }
    }
    const wrapper = await mountComponent()

    expect(state.loadServices).toHaveBeenCalledTimes(1)
    const items = wrapper.findAll('[data-testid="service-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Hook A')
    expect(items[0]!.text()).toContain('webhook')
    expect(items[0]!.text()).toContain('admin.externalServices.healthy')
    expect(items[1]!.text()).toContain('admin.externalServices.unhealthy')
    expect(items[1]!.text()).toContain('admin.externalServices.never_checked')
    expect(items[1]!.text()).toContain('timeout')
  })

  it('空列表显示空状态', async () => {
    const wrapper = await mountComponent()
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="service-item"]')).toHaveLength(0)
  })

  it('错误态显示错误提示且不显示空状态，重试再次拉取', async () => {
    state.error.value = 'boom'
    const wrapper = await mountComponent()

    expect(wrapper.find('[data-testid="load-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)

    await wrapper.find('[data-testid="retry"]').trigger('click')
    expect(state.loadServices).toHaveBeenCalledTimes(2)
  })

  it('切换类型过滤触发 loadServices(type)', async () => {
    const wrapper = await mountComponent()

    await wrapper.find('[data-testid="type-filter"]').setValue('slack')

    expect(state.loadServices).toHaveBeenCalledWith('slack')
  })

  it('行内开关触发 setEnabled', async () => {
    state.services.value = sampleServices
    const wrapper = await mountComponent()

    await wrapper.find('[data-testid="toggle-as-1"]').trigger('click')

    expect(state.setEnabled).toHaveBeenCalledWith(sampleServices[0], false)
  })

  it('健康检查按钮触发 checkHealth', async () => {
    state.services.value = sampleServices
    const wrapper = await mountComponent()

    await wrapper.find('[data-testid="check-as-2"]').trigger('click')

    expect(state.checkHealth).toHaveBeenCalledWith(sampleServices[1])
  })

  it('注销确认触发 removeService', async () => {
    state.services.value = sampleServices
    const wrapper = await mountComponent()

    expect(wrapper.find('[data-testid="delete-as-1"]').exists()).toBe(true)
    await wrapper.find('[data-testid="delete-as-1"]').trigger('click')
    await wrapper.findAll('.popconfirm-positive')[0]!.trigger('click')

    expect(state.removeService).toHaveBeenCalledWith(sampleServices[0])
  })

  it('注册表单填写完整后提交触发 registerService', async () => {
    const wrapper = await mountComponent()
    await wrapper.find('[data-testid="register-open"]').trigger('click')

    expect(wrapper.find('[data-testid="register-modal"]').exists()).toBe(true)

    await wrapper.find('[data-testid="draft-id"]').setValue('hook-c')
    await wrapper.find('[data-testid="draft-name"]').setValue('Hook C')
    await wrapper.find('[data-testid="register-submit"]').trigger('click')
    await flushPromises()

    expect(state.registerService).toHaveBeenCalledWith({
      service_type: 'webhook',
      service_id: 'hook-c',
      display_name: 'Hook C',
      webhook_url: '',
      api_key: ''
    })
  })

  it('client 作用域展示健康记录并支持启用/注销', async () => {
    state.clientServices.value = [{ id: 'svc-1', type: 'webhook', status: 'healthy', last_check: 1700000002000 }]
    const wrapper = await mountComponent()

    expect(state.loadClientHealth).toHaveBeenCalledTimes(1)
    const items = wrapper.findAll('[data-testid="client-service-item"]')
    expect(items).toHaveLength(1)
    expect(items[0]!.text()).toContain('svc-1')
    expect(items[0]!.text()).toContain('webhook')

    await wrapper.find('[data-testid="client-disable-svc-1"]').trigger('click')
    expect(state.setClientEnabled).toHaveBeenCalledWith('svc-1', false)

    await wrapper.find('[data-testid="client-delete-svc-1"]').trigger('click')
    await wrapper.findAll('.popconfirm-positive')[0]!.trigger('click')
    expect(state.removeClientService).toHaveBeenCalledWith('svc-1')
  })
})
