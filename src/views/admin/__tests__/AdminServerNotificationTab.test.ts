import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminServerNotificationTab from '../AdminServerNotificationTab.vue'

const mocks = vi.hoisted(() => ({
  getSystemNotifications: vi.fn(),
  getSystemNotification: vi.fn(),
  createSystemNotification: vi.fn(),
  updateSystemNotification: vi.fn(),
  deleteSystemNotification: vi.fn(),
  showFeedback: vi.fn()
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    serverNotifications: {
      getSystemNotifications: mocks.getSystemNotifications,
      getSystemNotification: mocks.getSystemNotification,
      createSystemNotification: mocks.createSystemNotification,
      updateSystemNotification: mocks.updateSystemNotification,
      deleteSystemNotification: mocks.deleteSystemNotification
    }
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: mocks.showFeedback })
}))

vi.mock('@iconify/vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    Icon: defineComponent({
      name: 'Icon',
      props: { icon: { type: String, default: '' } },
      setup() {
        return () => h('svg', { class: 'icon' })
      }
    })
  }
})

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string, tag = 'div', props: string[] = []) =>
    defineComponent({
      name,
      props,
      setup(p, { slots }) {
        const values = p as Record<string, unknown>
        return () =>
          h(tag, { class: name.toLowerCase() }, [
            ...props.map((key) => (values[key] ? String(values[key]) : null)),
            slots.default?.(),
            slots.footer?.()
          ])
      }
    })

  const NSpace = defineComponent({
    name: 'NSpace',
    props: { vertical: { type: Boolean, default: false } },
    setup(_, { slots }) {
      return () => h('div', { class: 'n-space' }, slots.default?.())
    }
  })

  const NAlert = defineComponent({
    name: 'NAlert',
    props: { type: { type: String, default: 'info' } },
    emits: ['close'],
    setup(props, { slots }) {
      return () => h('div', { class: 'n-alert', 'data-type': props.type }, slots.default?.())
    }
  })

  const NInput = defineComponent({
    name: 'NInput',
    props: {
      value: { type: String, default: '' },
      placeholder: { type: String, default: '' },
      rows: { type: Number, default: undefined },
      type: { type: String, default: 'text' }
    },
    emits: ['update:value'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          class: 'n-input',
          value: props.value,
          placeholder: props.placeholder,
          onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
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
          (props.options as { label: string; value: string }[]).map((opt) =>
            h('option', { value: opt.value }, opt.label)
          )
        )
    }
  })

  const NButton = defineComponent({
    name: 'NButton',
    props: {
      size: { type: String, default: 'medium' },
      type: { type: String, default: 'default' },
      loading: { type: Boolean, default: false }
    },
    setup(_, { slots }) {
      return () => h('button', { class: 'n-button', type: 'button' }, slots.default?.())
    }
  })

  const NPopconfirm = defineComponent({
    name: 'NPopconfirm',
    props: { onPositiveClick: { type: Function, default: undefined } },
    setup(props, { slots }) {
      return () =>
        h('span', { class: 'n-popconfirm' }, [
          slots.trigger?.(),
          h(
            'button',
            {
              class: 'popconfirm-positive',
              type: 'button',
              onClick: () => (props.onPositiveClick as (() => void) | undefined)?.()
            },
            'ok'
          )
        ])
    }
  })

  const NTag = defineComponent({
    name: 'NTag',
    props: { size: { type: String, default: 'medium' }, type: { type: String, default: 'default' } },
    setup(props, { slots }) {
      return () => h('span', { class: 'n-tag', 'data-type': props.type }, slots.default?.())
    }
  })

  const NDataTable = defineComponent({
    name: 'NDataTable',
    props: {
      columns: { type: Array, default: () => [] },
      data: { type: Array, default: () => [] },
      loading: { type: Boolean, default: false },
      rowKey: { type: Function, default: undefined }
    },
    setup(props) {
      return () =>
        h(
          'div',
          { class: 'n-data-table' },
          (props.data as Record<string, unknown>[]).map((row, index) =>
            h(
              'div',
              { class: 'n-data-table-row', 'data-testid': `row-${row.id}` },
              (
                props.columns as {
                  key: string
                  render?: (row: unknown, index: number) => unknown
                }[]
              ).map((col) =>
                h(
                  'div',
                  { class: `cell-${col.key}` },
                  col.render ? (col.render(row, index) as never) : String(row[col.key] ?? '')
                )
              )
            )
          )
        )
    }
  })

  const NEmpty = defineComponent({
    name: 'NEmpty',
    props: { description: { type: String, default: '' } },
    setup(props) {
      return () => h('div', { class: 'n-empty' }, props.description)
    }
  })

  const NDrawer = defineComponent({
    name: 'NDrawer',
    props: { show: { type: Boolean, default: false } },
    setup(props, { slots }) {
      return () => (props.show ? h('div', { class: 'n-drawer' }, slots.default?.()) : null)
    }
  })

  const NDrawerContent = defineComponent({
    name: 'NDrawerContent',
    props: { title: { type: String, default: '' } },
    setup(props, { slots }) {
      return () => h('div', { class: 'n-drawer-content' }, [props.title, slots.default?.(), slots.footer?.()])
    }
  })

  return {
    NAlert,
    NButton,
    NDataTable,
    NDrawer,
    NDrawerContent,
    NEmpty,
    NForm: passthrough('NForm'),
    NFormItem: passthrough('NFormItem', 'div', ['label']),
    NInput,
    NPopconfirm,
    NSelect,
    NSpace,
    NTag
  }
})

const sampleNotifications = [
  {
    id: 'n1',
    content: 'maintenance tonight',
    type: 'warning',
    targetUsers: ['@alice:example.org'],
    createdAt: 1700000000000
  },
  {
    id: 'n2',
    content: 'welcome',
    type: 'info',
    targetUsers: [],
    createdAt: null
  }
]

const mountTab = async () => {
  const wrapper = mount(AdminServerNotificationTab)
  await flushPromises()
  return wrapper
}

describe('AdminServerNotificationTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSystemNotifications.mockResolvedValue({ notifications: sampleNotifications, nextToken: undefined })
    mocks.getSystemNotification.mockResolvedValue(sampleNotifications[0])
    mocks.createSystemNotification.mockResolvedValue({ notificationId: 'n3' })
    mocks.updateSystemNotification.mockResolvedValue(undefined)
    mocks.deleteSystemNotification.mockResolvedValue(undefined)
  })

  it('挂载后拉取系统通知并渲染表格', async () => {
    const wrapper = await mountTab()

    expect(mocks.getSystemNotifications).toHaveBeenCalledWith(50, undefined, true)
    expect(wrapper.findAll('[data-testid^="row-"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="row-n1"]').text()).toContain('maintenance tonight')
    expect(wrapper.find('[data-testid="row-n1"] .cell-targetUsers').text()).toBe('1')
    expect(wrapper.find('[data-testid="row-n2"] .cell-createdAt').text()).toBe('-')
  })

  it('空列表显示空状态', async () => {
    mocks.getSystemNotifications.mockResolvedValueOnce({ notifications: [], nextToken: undefined })
    const wrapper = await mountTab()

    expect(wrapper.find('[data-testid="server-notification-empty"]').exists()).toBe(true)
  })

  it('加载失败显示错误提示', async () => {
    mocks.getSystemNotifications.mockRejectedValueOnce(new Error('server offline'))
    const wrapper = await mountTab()

    expect(wrapper.find('[data-testid="server-notification-error"]').text()).toContain('server offline')
  })

  it('新建通知提交内容与目标用户', async () => {
    const wrapper = await mountTab()

    await wrapper.find('[data-testid="server-notification-create"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="server-notification-content"]').setValue('hello all')
    await wrapper.find('[data-testid="server-notification-targets"]').setValue('@alice:example.org, @bob:example.org')
    await wrapper.find('[data-testid="server-notification-submit"]').trigger('click')
    await flushPromises()

    expect(mocks.createSystemNotification).toHaveBeenCalledWith('hello all', 'info', [
      '@alice:example.org',
      '@bob:example.org'
    ])
    expect(mocks.showFeedback).toHaveBeenCalled()
  })

  it('内容为空时不提交并提示', async () => {
    const wrapper = await mountTab()

    await wrapper.find('[data-testid="server-notification-create"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="server-notification-content"]').setValue('   ')
    await wrapper.find('[data-testid="server-notification-submit"]').trigger('click')
    await flushPromises()

    expect(mocks.createSystemNotification).not.toHaveBeenCalled()
    expect(mocks.showFeedback).toHaveBeenCalled()
  })

  it('编辑时先拉取详情再提交更新', async () => {
    const wrapper = await mountTab()

    await wrapper.find('[data-testid="server-notification-edit-n1"]').trigger('click')
    await flushPromises()
    expect(mocks.getSystemNotification).toHaveBeenCalledWith('n1', true)
    const contentInput = wrapper.find('[data-testid="server-notification-content"]')
    expect((contentInput.element as HTMLInputElement).value).toBe('maintenance tonight')

    await wrapper.find('[data-testid="server-notification-content"]').setValue('updated content')
    await wrapper.find('[data-testid="server-notification-submit"]').trigger('click')
    await flushPromises()

    expect(mocks.updateSystemNotification).toHaveBeenCalledWith('n1', {
      content: 'updated content',
      type: 'warning',
      target_users: ['@alice:example.org']
    })
  })

  it('删除通知后刷新列表', async () => {
    const wrapper = await mountTab()
    mocks.getSystemNotifications.mockClear()

    await wrapper.find('[data-testid="server-notification-delete-n1"]').trigger('click')
    await wrapper.find('.popconfirm-positive').trigger('click')
    await flushPromises()

    expect(mocks.deleteSystemNotification).toHaveBeenCalledWith('n1')
    expect(mocks.getSystemNotifications).toHaveBeenCalledTimes(1)
  })

  it('删除失败提示错误', async () => {
    mocks.deleteSystemNotification.mockRejectedValueOnce(new Error('forbidden'))
    const wrapper = await mountTab()
    mocks.getSystemNotifications.mockClear()

    await wrapper.find('[data-testid="server-notification-delete-n1"]').trigger('click')
    await wrapper.find('.popconfirm-positive').trigger('click')
    await flushPromises()

    expect(mocks.showFeedback).toHaveBeenCalled()
    expect(mocks.getSystemNotifications).not.toHaveBeenCalled()
  })
})
