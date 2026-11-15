import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminCas from '../AdminCas.vue'

const { showFeedbackMock, dialogMock, composable } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  dialogMock: { warning: vi.fn() },
  composable: {
    loadServices: vi.fn().mockResolvedValue(undefined),
    createService: vi.fn().mockResolvedValue(true),
    deleteService: vi.fn().mockResolvedValue(true),
    loadUserAttributes: vi.fn().mockResolvedValue(true),
    saveUserAttribute: vi.fn().mockResolvedValue(true)
  }
}))

const serviceItem = {
  id: 'svc',
  name: 'Svc',
  service_url: 'https://app.example.com/*',
  enabled: true
}

vi.mock('@/composables/admin', async () => {
  const { ref } = await import('vue')
  return {
    useAdminCas: () => ({
      services: ref([serviceItem]),
      servicesLoading: ref(false),
      servicesError: ref(null),
      creating: ref(false),
      deleting: ref(false),
      attributes: ref([]),
      attributesLoading: ref(false),
      attributesSaving: ref(false),
      attributesError: ref(null),
      ...composable
    })
  }
})

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string) =>
    defineComponent({
      name,
      props: ['title', 'type', 'label', 'description', 'bordered', 'size'],
      setup(props, { slots }) {
        return () =>
          h('div', { 'data-test': name }, [
            props.title ? h('span', String(props.title)) : null,
            props.description ? h('span', String(props.description)) : null,
            slots.default?.(),
            slots.extra?.(),
            slots['header-extra']?.()
          ])
      }
    })

  const input = () =>
    defineComponent({
      name: 'NInput',
      props: { value: { type: [String, Number], default: '' }, type: String, placeholder: String, rows: Number },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            value: props.value,
            onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
          })
      }
    })

  return {
    NAlert: passthrough('NAlert'),
    NButton: defineComponent({
      name: 'NButton',
      props: ['loading', 'disabled', 'type', 'tertiary', 'size'],
      emits: ['click'],
      setup(props, { slots, emit }) {
        return () =>
          h('button', { type: 'button', disabled: props.disabled, onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NCard: passthrough('NCard'),
    NDataTable: defineComponent({
      name: 'NDataTable',
      props: ['data', 'columns', 'loading', 'rowKey', 'scrollX'],
      setup(props) {
        return () =>
          h(
            'div',
            { 'data-test': 'NDataTable' },
            ((props.data ?? []) as Array<Record<string, unknown>>).flatMap((row) =>
              ((props.columns ?? []) as Array<{ key?: string; render?: (row: unknown) => unknown }>).map((column) =>
                h(
                  'div',
                  { 'data-test': `cell-${column.key ?? 'unknown'}` },
                  column.render ? (column.render(row) as never) : String(row[column.key ?? ''] ?? '')
                )
              )
            )
          )
      }
    }),
    NEmpty: passthrough('NEmpty'),
    NInput: input(),
    NSpace: passthrough('NSpace'),
    NTag: passthrough('NTag'),
    useDialog: () => dialogMock
  }
})

describe('AdminCas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('挂载后自动读取服务列表', async () => {
    mount(AdminCas)
    await flushPromises()

    expect(composable.loadServices).toHaveBeenCalledTimes(1)
  })

  it('注册服务缺少必填字段时拦截提交', async () => {
    const wrapper = mount(AdminCas)
    await flushPromises()

    await wrapper.find('[data-testid="admin-cas-service-submit"]').trigger('click')

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.cas.requiredFields', 'error')
    expect(composable.createService).not.toHaveBeenCalled()
  })

  it('注册服务按表单字段透传', async () => {
    const wrapper = mount(AdminCas)
    await flushPromises()

    await wrapper.find('[data-testid="admin-cas-service-id"]').setValue('svc')
    await wrapper.find('[data-testid="admin-cas-service-name"]').setValue('Svc')
    await wrapper.find('[data-testid="admin-cas-service-url"]').setValue('https://app.example.com/*')
    await wrapper.find('[data-testid="admin-cas-service-submit"]').trigger('click')
    await flushPromises()

    expect(composable.createService).toHaveBeenCalledWith({
      service_id: 'svc',
      name: 'Svc',
      service_url_pattern: 'https://app.example.com/*',
      description: undefined
    })
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.cas.createSuccess', 'success')
  })

  it('删除服务需二次确认', async () => {
    const wrapper = mount(AdminCas)
    await flushPromises()

    await wrapper.find('[data-test="cell-actions"] button').trigger('click')

    expect(dialogMock.warning).toHaveBeenCalledTimes(1)
    const options = dialogMock.warning.mock.calls[0][0]
    await options.onPositiveClick()

    expect(composable.deleteService).toHaveBeenCalledWith('svc')
  })

  it('未填写用户 ID 时拦截属性读取', async () => {
    const wrapper = mount(AdminCas)
    await flushPromises()

    await wrapper.find('[data-testid="admin-cas-attributes-load"]').trigger('click')

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.cas.userIdRequired', 'error')
    expect(composable.loadUserAttributes).not.toHaveBeenCalled()
  })

  it('写入属性时校验属性名', async () => {
    const wrapper = mount(AdminCas)
    await flushPromises()

    await wrapper.find('[data-testid="admin-cas-attributes-user-id"]').setValue('@alice:example.org')
    await wrapper.find('[data-testid="admin-cas-attribute-submit"]').trigger('click')

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.cas.attributeNameRequired', 'error')
    expect(composable.saveUserAttribute).not.toHaveBeenCalled()
  })
})
