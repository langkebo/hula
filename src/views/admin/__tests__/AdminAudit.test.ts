import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import AdminAudit from '../AdminAudit.vue'

const { loadLogsMock, showFeedbackMock, state } = vi.hoisted(() => ({
  loadLogsMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  state: {
    logs: [] as Array<{
      id: string
      type: string
      user_id: string
      target?: string
      timestamp: number
      details?: Record<string, unknown>
    }>,
    loading: false
  }
}))

vi.mock('@/composables/admin', () => ({
  useAdminAudit: () => ({
    logs: ref(state.logs),
    loading: ref(state.loading),
    selected: ref(null),
    loadingDetail: ref(false),
    loadLogs: loadLogsMock,
    loadDetail: vi.fn(),
    clearSelected: vi.fn()
  })
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

// URL.createObjectURL 在 happy-dom 中不可用；保留 URL 构造器仅覆盖静态方法，
// 避免锚点 click 触发的 happy-dom 导航因 `new URL()` 失败而抛出噪音错误
const OriginalURL = globalThis.URL
vi.stubGlobal(
  'URL',
  class extends OriginalURL {
    static override createObjectURL = vi.fn(() => 'blob:mock')
    static override revokeObjectURL = vi.fn()
  }
)

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      props: [
        'show',
        'title',
        'subtitle',
        'preset',
        'column',
        'bordered',
        'labelPlacement',
        'label',
        'code',
        'language'
      ],
      setup(props, { slots }) {
        return () =>
          h(tag, { 'data-test': name }, [
            props.title ? h('span', String(props.title)) : null,
            props.label ? h('span', { 'data-test': `${name}-label` }, String(props.label)) : null,
            slots.default?.(),
            slots.extra?.(),
            slots.action?.()
          ])
      }
    })

  return {
    NButton: defineComponent({
      name: 'NButton',
      props: ['loading', 'disabled', 'size', 'quaternary'],
      emits: ['click'],
      setup(props, { slots, emit }) {
        return () =>
          h('button', { type: 'button', disabled: props.disabled, onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NCode: passthrough('NCode', 'pre'),
    NDataTable: defineComponent({
      name: 'NDataTable',
      props: ['data', 'columns', 'loading', 'pagination', 'rowKey', 'striped'],
      setup(props) {
        return () => h('div', { 'data-test': 'NDataTable' }, JSON.stringify(props.data ?? []))
      }
    }),
    NDatePicker: defineComponent({
      name: 'NDatePicker',
      props: ['value', 'type', 'clearable', 'placeholder'],
      emits: ['update:value'],
      setup(_props, { emit }) {
        return () =>
          h('input', {
            'data-test': 'NDatePicker',
            onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
          })
      }
    }),
    NDescriptions: passthrough('NDescriptions'),
    NDescriptionsItem: passthrough('NDescriptionsItem'),
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
    NModal: defineComponent({
      name: 'NModal',
      props: ['show', 'preset', 'title'],
      setup(props, { slots }) {
        return () => (props.show ? h('div', { 'data-test': 'NModal' }, [slots.default?.(), slots.action?.()]) : null)
      }
    }),
    NPageHeader: passthrough('NPageHeader'),
    NSelect: defineComponent({
      name: 'NSelect',
      props: ['value', 'options', 'placeholder', 'clearable'],
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h(
            'select',
            {
              'data-test': 'NSelect',
              onChange: (e: Event) => emit('update:value', (e.target as HTMLSelectElement).value || null)
            },
            (props.options as Array<{ label: string; value: string }> | undefined)?.map((opt) =>
              h('option', { value: opt.value }, opt.label)
            ) ?? []
          )
      }
    }),
    NSpace: passthrough('NSpace'),
    NTag: defineComponent({
      name: 'NTag',
      props: ['type', 'size'],
      setup(props, { slots }) {
        return () => h('span', { 'data-test': 'NTag', 'data-type': props.type }, slots.default?.())
      }
    })
  }
})

describe('AdminAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.logs = [
      {
        id: 'evt1',
        type: 'admin.user.deactivate',
        user_id: '@admin:server',
        target: '@bad:server',
        timestamp: 1700000000000
      },
      { id: 'evt2', type: 'auth.login', user_id: '@user:server', timestamp: 1700000100000 },
      { id: 'evt3', type: 'room.create', user_id: '@user:server', target: '!room:server', timestamp: 1700000200000 }
    ]
    state.loading = false
    loadLogsMock.mockResolvedValue(undefined)
  })

  const mountComponent = () => mount(AdminAudit)

  it('挂载时加载审计日志', async () => {
    mountComponent()
    await flushPromises()

    expect(loadLogsMock).toHaveBeenCalledWith({ userId: undefined, type: undefined })
  })

  it('渲染日志数据到表格', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const table = wrapper.findComponent({ name: 'NDataTable' })
    expect(table.text()).toContain('evt1')
    expect(table.text()).toContain('@admin:server')
  })

  it('按类型与用户筛选后刷新', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    loadLogsMock.mockClear()

    // 设置用户筛选
    const userInput = wrapper.find('input[data-test="NInput"]')
    await userInput.setValue('@admin:server')

    // 设置类型筛选
    const typeSelect = wrapper.find('select[data-test="NSelect"]')
    await typeSelect.setValue('admin')

    // 点击刷新
    const refreshButton = wrapper.findAll('button').find((b) => b.text().includes('common.refresh'))
    await refreshButton!.trigger('click')
    await flushPromises()

    expect(loadLogsMock).toHaveBeenCalledWith({ userId: '@admin:server', type: 'admin' })
  })

  it('导出 CSV 触发下载并展示成功反馈', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const csvButton = wrapper.findAll('button').find((b) => b.text().includes('admin.audit.export_csv'))
    expect(csvButton!.attributes('disabled')).toBeUndefined()

    await csvButton!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.audit.export_success', 'success')
  })

  it('导出 JSON 触发下载并展示成功反馈', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const jsonButton = wrapper.findAll('button').find((b) => b.text().includes('admin.audit.export_json'))
    await jsonButton!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.audit.export_success', 'success')
  })

  it('无日志时导出按钮禁用', async () => {
    state.logs = []
    const wrapper = mountComponent()
    await flushPromises()

    const csvButton = wrapper.findAll('button').find((b) => b.text().includes('admin.audit.export_csv'))
    const jsonButton = wrapper.findAll('button').find((b) => b.text().includes('admin.audit.export_json'))
    expect(csvButton!.attributes('disabled')).toBeDefined()
    expect(jsonButton!.attributes('disabled')).toBeDefined()
  })
})
