import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminAccountPolicy from '../AdminAccountPolicy.vue'

const { showFeedback } = vi.hoisted(() => ({ showFeedback: vi.fn() }))
const { api } = vi.hoisted(() => ({ api: {} as Record<string, any> }))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback })
}))

vi.mock('@/composables/admin', async () => {
  const { ref } = await import('vue')
  Object.assign(api, {
    validity: ref(null),
    validityLoading: ref(false),
    validitySaving: ref(false),
    validityError: ref(null),
    providers: ref([]),
    providersLoading: ref(false),
    providersSaving: ref(false),
    providersError: ref(null),
    policyStatus: ref(null),
    policyLoading: ref(false),
    policyChecking: ref(false),
    policyError: ref(null),
    policyResult: ref(null),
    rateLimit: ref(null),
    rateLimitLoading: ref(false),
    rateLimitError: ref(null),
    loadValidity: vi.fn().mockResolvedValue(undefined),
    setValidity: vi.fn().mockResolvedValue(true),
    renewValidity: vi.fn().mockResolvedValue(true),
    loadProviders: vi.fn().mockResolvedValue(undefined),
    createProvider: vi.fn().mockResolvedValue(true),
    loadPolicyStatus: vi.fn().mockResolvedValue(undefined),
    runPolicyCheck: vi.fn().mockResolvedValue(true),
    loadRateLimit: vi.fn().mockResolvedValue(undefined)
  })
  return { useAdminAccountPolicy: () => api }
})

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const NAlert = defineComponent({
    name: 'NAlert',
    props: { type: { type: String, default: 'default' }, bordered: Boolean, closable: Boolean },
    emits: ['close'],
    setup(props, { slots }) {
      return () => h('div', { class: ['n-alert', `n-alert--${props.type}`] }, slots.default?.())
    }
  })

  const NButton = defineComponent({
    name: 'NButton',
    props: { type: { type: String, default: 'default' }, loading: Boolean },
    setup(_, { slots }) {
      return () => h('button', { class: 'n-button', type: 'button' }, slots.default?.())
    }
  })

  const NCard = defineComponent({
    name: 'NCard',
    props: { title: { type: String, default: '' } },
    setup(props, { slots }) {
      return () =>
        h('div', { class: 'n-card' }, [
          props.title ? h('div', { class: 'n-card-header' }, props.title) : null,
          slots.default?.()
        ])
    }
  })

  const NDataTable = defineComponent({
    name: 'NDataTable',
    props: {
      columns: { type: Array, default: () => [] },
      data: { type: Array, default: () => [] },
      loading: Boolean,
      rowKey: { type: Function, default: undefined },
      scrollX: { type: [Number, String], default: undefined }
    },
    setup(props) {
      return () =>
        h(
          'table',
          { class: 'n-data-table' },
          h(
            'tbody',
            {},
            (props.data as any[]).map((row) =>
              h(
                'tr',
                { 'data-testid': `account-policy-provider-row-${row.id}` },
                (props.columns as any[]).map((col) =>
                  h('td', {}, col.render ? col.render(row) : String(row[col.key] ?? ''))
                )
              )
            )
          )
        )
    }
  })

  const NDatePicker = defineComponent({
    name: 'NDatePicker',
    props: { value: { type: Number, default: null } },
    emits: ['update:value'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          class: 'n-date-picker',
          value: props.value ?? '',
          onInput: (e: Event) => emit('update:value', Number((e.target as HTMLInputElement).value))
        })
    }
  })

  const NDescriptions = defineComponent({
    name: 'NDescriptions',
    props: { column: { type: Number, default: 1 }, bordered: Boolean, size: String, labelPlacement: String },
    setup(_, { slots }) {
      return () => h('div', { class: 'n-descriptions' }, slots.default?.())
    }
  })

  const NDescriptionsItem = defineComponent({
    name: 'NDescriptionsItem',
    props: { label: { type: String, default: '' } },
    setup(props, { slots }) {
      return () =>
        h('div', { class: 'n-descriptions-item' }, [
          h('span', { class: 'n-descriptions-label' }, props.label),
          h('span', { class: 'n-descriptions-value' }, slots.default?.())
        ])
    }
  })

  const NEmpty = defineComponent({
    name: 'NEmpty',
    props: { description: { type: String, default: '' } },
    setup(props) {
      return () => h('div', { class: 'n-empty' }, props.description)
    }
  })

  const NForm = defineComponent({
    name: 'NForm',
    props: { labelPlacement: String },
    setup(_, { slots }) {
      return () => h('form', { class: 'n-form' }, slots.default?.())
    }
  })

  const NFormItem = defineComponent({
    name: 'NFormItem',
    props: { label: { type: String, default: '' } },
    setup(props, { slots }) {
      return () => h('div', { class: 'n-form-item' }, [h('label', {}, props.label), slots.default?.()])
    }
  })

  const NInput = defineComponent({
    name: 'NInput',
    props: {
      value: { type: String, default: '' },
      placeholder: { type: String, default: '' },
      type: { type: String, default: 'text' },
      rows: { type: Number, default: 2 },
      clearable: Boolean
    },
    emits: ['update:value'],
    setup(props, { emit }) {
      const onInput = (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
      return () =>
        props.type === 'textarea'
          ? h('textarea', { class: 'n-input', value: props.value, rows: props.rows, onInput })
          : h('input', { class: 'n-input', value: props.value, placeholder: props.placeholder, onInput })
    }
  })

  const NInputNumber = defineComponent({
    name: 'NInputNumber',
    props: { value: { type: Number, default: null }, min: { type: Number, default: undefined } },
    emits: ['update:value'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          class: 'n-input-number',
          type: 'number',
          value: props.value ?? '',
          onInput: (e: Event) => {
            const raw = (e.target as HTMLInputElement).value
            emit('update:value', raw === '' ? null : Number(raw))
          }
        })
    }
  })

  const NSelect = defineComponent({
    name: 'NSelect',
    props: { value: { type: String, default: '' }, options: { type: Array, default: () => [] } },
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
          (props.options as any[]).map((opt) => h('option', { value: opt.value }, opt.label))
        )
    }
  })

  const NSpace = defineComponent({
    name: 'NSpace',
    props: { vertical: Boolean, align: String, size: [String, Number], wrap: Boolean },
    setup(_, { slots }) {
      return () => h('div', { class: 'n-space' }, slots.default?.())
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
          'aria-checked': props.value,
          onClick: () => emit('update:value', !props.value)
        })
    }
  })

  const NTabs = defineComponent({
    name: 'NTabs',
    props: { value: { type: String, default: '' }, type: String, animated: Boolean },
    emits: ['update:value'],
    setup(_, { slots }) {
      return () => h('div', { class: 'n-tabs' }, slots.default?.())
    }
  })

  const NTabPane = defineComponent({
    name: 'NTabPane',
    props: { name: { type: String, required: true }, tab: { type: String, default: '' } },
    setup(props, { slots }) {
      return () => h('div', { class: 'n-tab-pane', 'data-pane': props.name }, slots.default?.())
    }
  })

  const NTag = defineComponent({
    name: 'NTag',
    props: { type: { type: String, default: 'default' }, size: String },
    setup(_, { slots }) {
      return () => h('span', { class: 'n-tag' }, slots.default?.())
    }
  })

  return {
    NAlert,
    NButton,
    NCard,
    NDataTable,
    NDatePicker,
    NDescriptions,
    NDescriptionsItem,
    NEmpty,
    NForm,
    NFormItem,
    NInput,
    NInputNumber,
    NSelect,
    NSpace,
    NSwitch,
    NTabPane,
    NTabs,
    NTag
  }
})

const validityInfo = {
  user_id: '@alice:example.org',
  expiration_ts: 1700000000000,
  last_check_at: 1690000000000,
  renewal_token: 'renew-token',
  is_valid: true,
  created_ts: 1680000000000,
  updated_ts: 1695000000000
}

const provider = {
  id: 1,
  provider_name: 'ldap',
  provider_type: 'ldap',
  config: { host: 'ldap.local' },
  is_enabled: true,
  priority: 10,
  created_ts: 1680000000000,
  updated_ts: 1680000000000
}

const policyStatus = { enabled: true, endpoint: 'http://policy.local', fail_mode: 'fail_closed' }

const rateLimitStatus = {
  enabled: true,
  backend: 'redis',
  redis_available: true,
  active_rules: 12,
  exempt_paths: 3,
  metrics: {
    requests_total: 1000,
    rejected_total: 25,
    allowed_total: 975,
    exempt_total: 10,
    fail_open_total: 0,
    fail_closed_total: 0,
    rejected_ratio_percent: 2.5
  }
}

const mountView = async () => {
  const wrapper = mount(AdminAccountPolicy)
  await flushPromises()
  return wrapper
}

describe('AdminAccountPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.validity.value = null
    api.validityError.value = null
    api.providers.value = []
    api.providersError.value = null
    api.policyStatus.value = null
    api.policyError.value = null
    api.policyResult.value = null
    api.rateLimit.value = null
    api.rateLimitError.value = null
  })

  it('挂载时并发加载四块数据并渲染状态', async () => {
    api.providers.value = [provider]
    api.policyStatus.value = policyStatus
    api.rateLimit.value = rateLimitStatus

    const wrapper = await mountView()

    expect(api.loadProviders).toHaveBeenCalledTimes(1)
    expect(api.loadPolicyStatus).toHaveBeenCalledTimes(1)
    expect(api.loadRateLimit).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="account-policy-provider-row-1"]').text()).toContain('ldap')
    expect(wrapper.find('[data-testid="account-policy-policy-status"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="account-policy-rate-limit-status"]').text()).toContain('redis')
    expect(wrapper.findAll('.metric-item')).toHaveLength(7)
    expect(wrapper.text()).toContain('2.5%')
  })

  it('查询有效期：未填用户 ID 提示，填写后调用服务并渲染卡片', async () => {
    api.validity.value = validityInfo
    const wrapper = await mountView()

    await wrapper.find('[data-testid="account-policy-validity-load"]').trigger('click')
    expect(api.loadValidity).not.toHaveBeenCalled()
    expect(showFeedback).toHaveBeenCalledWith('admin.accountPolicy.validity.userIdRequired', 'error')

    await wrapper.find('[data-testid="account-policy-validity-user-id"]').setValue(' @alice:example.org ')
    await wrapper.find('[data-testid="account-policy-validity-load"]').trigger('click')
    await flushPromises()

    expect(api.loadValidity).toHaveBeenCalledWith('@alice:example.org')
    expect(wrapper.find('[data-testid="account-policy-validity-card"]').exists()).toBe(true)
  })

  it('设置有效期：缺时间提示，补齐后提交并在成功后提示成功', async () => {
    const wrapper = await mountView()
    await wrapper.find('[data-testid="account-policy-validity-user-id"]').setValue('@alice:example.org')

    await wrapper.find('[data-testid="account-policy-validity-set"]').trigger('click')
    expect(api.setValidity).not.toHaveBeenCalled()
    expect(showFeedback).toHaveBeenCalledWith('admin.accountPolicy.validity.expirationRequired', 'error')

    await wrapper.find('[data-testid="account-policy-validity-expiration"]').setValue('1700000000000')
    await wrapper.find('[data-testid="account-policy-validity-set"]').trigger('click')
    await flushPromises()

    expect(api.setValidity).toHaveBeenCalledWith('@alice:example.org', 1700000000000)
    expect(showFeedback).toHaveBeenCalledWith('admin.accountPolicy.validity.setSuccess', 'success')
  })

  it('续期：缺令牌提示，补齐后提交去除空白的令牌', async () => {
    const wrapper = await mountView()
    await wrapper.find('[data-testid="account-policy-validity-user-id"]').setValue('@alice:example.org')
    await wrapper.find('[data-testid="account-policy-validity-renew-expiration"]').setValue('1800000000000')

    await wrapper.find('[data-testid="account-policy-validity-renew"]').trigger('click')
    expect(api.renewValidity).not.toHaveBeenCalled()
    expect(showFeedback).toHaveBeenCalledWith('admin.accountPolicy.validity.renewalTokenRequired', 'error')

    await wrapper.find('[data-testid="account-policy-validity-renew-token"]').setValue(' renew-token ')
    await wrapper.find('[data-testid="account-policy-validity-renew"]').trigger('click')
    await flushPromises()

    expect(api.renewValidity).toHaveBeenCalledWith('@alice:example.org', 'renew-token', 1800000000000)
  })

  it('新建提供方：校验必填与 JSON，成功提交后重置表单', async () => {
    const wrapper = await mountView()

    await wrapper.find('[data-testid="account-policy-provider-submit"]').trigger('click')
    expect(api.createProvider).not.toHaveBeenCalled()
    expect(showFeedback).toHaveBeenCalledWith('admin.accountPolicy.providers.nameRequired', 'error')

    await wrapper.find('[data-testid="account-policy-provider-name"]').setValue('ldap')
    await wrapper.find('[data-testid="account-policy-provider-submit"]').trigger('click')
    expect(showFeedback).toHaveBeenCalledWith('admin.accountPolicy.providers.typeRequired', 'error')

    await wrapper.find('[data-testid="account-policy-provider-type"]').setValue('ldap')
    await wrapper.find('[data-testid="account-policy-provider-config"]').setValue('[1,2]')
    await wrapper.find('[data-testid="account-policy-provider-submit"]').trigger('click')
    expect(api.createProvider).not.toHaveBeenCalled()
    expect(showFeedback).toHaveBeenCalledWith('admin.accountPolicy.providers.configInvalid', 'error')

    await wrapper.find('[data-testid="account-policy-provider-config"]').setValue('{"host":"ldap.local"}')
    await wrapper.find('[data-testid="account-policy-provider-submit"]').trigger('click')
    await flushPromises()

    expect(api.createProvider).toHaveBeenCalledWith({
      providerName: 'ldap',
      providerType: 'ldap',
      config: { host: 'ldap.local' },
      isEnabled: true,
      priority: 100
    })
    expect(wrapper.find('[data-testid="account-policy-provider-name"]').element).toHaveProperty('value', '')
    expect(wrapper.find('[data-testid="account-policy-provider-config"]').element).toHaveProperty('value', '{}')
  })

  it('新建提供方失败时提示失败且保留表单内容', async () => {
    api.createProvider.mockResolvedValueOnce(false)
    const wrapper = await mountView()
    await wrapper.find('[data-testid="account-policy-provider-name"]').setValue('ldap')
    await wrapper.find('[data-testid="account-policy-provider-type"]').setValue('ldap')

    await wrapper.find('[data-testid="account-policy-provider-submit"]').trigger('click')
    await flushPromises()

    expect(showFeedback).toHaveBeenCalledWith(expect.any(String), 'error')
    expect(wrapper.find('[data-testid="account-policy-provider-name"]').element).toHaveProperty('value', 'ldap')
  })

  it('策略检查：缺参数提示，补齐后提交并渲染结果', async () => {
    api.policyResult.value = { allowed: false, result: 'deny', reason: 'banned' }
    const wrapper = await mountView()

    await wrapper.find('[data-testid="account-policy-policy-check"]').trigger('click')
    expect(api.runPolicyCheck).not.toHaveBeenCalled()
    expect(showFeedback).toHaveBeenCalledWith('admin.accountPolicy.policy.required', 'error')

    await wrapper.find('[data-testid="account-policy-policy-room"]').setValue(' !room:example.org ')
    await wrapper.find('[data-testid="account-policy-policy-user"]').setValue('@alice:example.org')
    await wrapper.find('[data-testid="account-policy-policy-check"]').trigger('click')
    await flushPromises()

    expect(api.runPolicyCheck).toHaveBeenCalledWith({
      room_id: '!room:example.org',
      user_id: '@alice:example.org',
      action: 'join'
    })
    expect(wrapper.find('[data-testid="account-policy-policy-result"]').classes()).toContain('n-alert--warning')
    expect(wrapper.text()).toContain('banned')
  })

  it('四块错误状态各自渲染错误横幅', async () => {
    api.validityError.value = 'validity failed'
    api.providersError.value = 'providers failed'
    api.policyError.value = 'policy failed'
    api.rateLimitError.value = 'rate limit failed'

    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="account-policy-validity-error"]').text()).toContain('validity failed')
    expect(wrapper.find('[data-testid="account-policy-provider-error"]').text()).toContain('providers failed')
    expect(wrapper.find('[data-testid="account-policy-policy-error"]').text()).toContain('policy failed')
    expect(wrapper.find('[data-testid="account-policy-rate-limit-error"]').text()).toContain('rate limit failed')
  })

  it('刷新按钮分别触发对应加载函数', async () => {
    const wrapper = await mountView()

    await wrapper.find('[data-testid="account-policy-provider-refresh"]').trigger('click')
    await wrapper.find('[data-testid="account-policy-policy-refresh"]').trigger('click')
    await wrapper.find('[data-testid="account-policy-rate-limit-refresh"]').trigger('click')

    expect(api.loadProviders).toHaveBeenCalledTimes(2)
    expect(api.loadPolicyStatus).toHaveBeenCalledTimes(2)
    expect(api.loadRateLimit).toHaveBeenCalledTimes(2)
  })
})
