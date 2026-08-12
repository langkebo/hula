import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import AdminRegistrationTokens from '../AdminRegistrationTokens.vue'

const { loadTokensMock, createTokenMock, updateTokenMock, deleteTokenMock, showFeedbackMock, state } = vi.hoisted(
  () => ({
    loadTokensMock: vi.fn(),
    createTokenMock: vi.fn(),
    updateTokenMock: vi.fn(),
    deleteTokenMock: vi.fn(),
    showFeedbackMock: vi.fn(),
    state: {
      tokens: [] as Array<{
        token: string
        usesAllowed?: number | null
        expiryTime?: number | null
        pending: number
        completed: number
      }>,
      loading: false,
      creating: false
    }
  })
)

vi.mock('@/composables/admin', () => ({
  useAdminRegistrationTokens: () => ({
    tokens: ref(state.tokens),
    loading: ref(state.loading),
    creating: ref(state.creating),
    loadTokens: loadTokensMock,
    createToken: createTokenMock,
    updateToken: updateTokenMock,
    deleteToken: deleteTokenMock
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      props: [
        'show',
        'title',
        'preset',
        'model',
        'labelPlacement',
        'labelWidth',
        'vertical',
        'align',
        'justify',
        'size'
      ],
      setup(_props, { slots }) {
        return () => h(tag, { 'data-test': name }, [slots.default?.(), slots.action?.(), slots.trigger?.()])
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
    NDataTable: defineComponent({
      name: 'NDataTable',
      props: ['data', 'columns', 'loading', 'pagination', 'bordered', 'size'],
      setup(props) {
        return () => h('div', { 'data-test': 'NDataTable' }, JSON.stringify(props.data ?? []))
      }
    }),
    NDatePicker: defineComponent({
      name: 'NDatePicker',
      props: ['value', 'type', 'clearable'],
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            'data-test': 'NDatePicker',
            type: 'number',
            value: props.value as number,
            onInput: (e: Event) => emit('update:value', Number((e.target as HTMLInputElement).value))
          })
      }
    }),
    NFlex: passthrough('NFlex'),
    NForm: passthrough('NForm'),
    NFormItem: defineComponent({
      name: 'NFormItem',
      props: ['label'],
      setup(props, { slots }) {
        return () => h('div', { 'data-test': 'NFormItem' }, [h('label', String(props.label ?? '')), slots.default?.()])
      }
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: ['value', 'placeholder', 'disabled'],
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            'data-test': 'NInput',
            value: props.value as string,
            disabled: props.disabled,
            onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
          })
      }
    }),
    NInputNumber: defineComponent({
      name: 'NInputNumber',
      props: ['value', 'min', 'placeholder'],
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            'data-test': 'NInputNumber',
            type: 'number',
            value: props.value as number,
            onInput: (e: Event) => emit('update:value', Number((e.target as HTMLInputElement).value))
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
    NPopconfirm: defineComponent({
      name: 'NPopconfirm',
      emits: ['positiveClick'],
      setup(_, { slots, emit }) {
        return () =>
          h('div', { 'data-test': 'NPopconfirm' }, [
            slots.trigger?.(),
            h('button', { 'data-test': 'popconfirm-yes', onClick: () => emit('positiveClick') }, 'yes')
          ])
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

describe('AdminRegistrationTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.tokens = [
      { token: 'tok_active', usesAllowed: 10, expiryTime: null, pending: 0, completed: 2 },
      { token: 'tok_expired', usesAllowed: 5, expiryTime: 1000, pending: 0, completed: 5 }
    ]
    state.loading = false
    state.creating = false
    loadTokensMock.mockResolvedValue(undefined)
    createTokenMock.mockResolvedValue({ token: 'new_tok', pending: 0, completed: 0 })
    updateTokenMock.mockResolvedValue(undefined)
    deleteTokenMock.mockResolvedValue(undefined)
  })

  const mountComponent = () => mount(AdminRegistrationTokens)

  it('挂载时加载注册令牌列表', async () => {
    mountComponent()
    await flushPromises()

    expect(loadTokensMock).toHaveBeenCalledTimes(1)
  })

  it('渲染令牌数据到表格', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const table = wrapper.findComponent({ name: 'NDataTable' })
    expect(table.exists()).toBe(true)
    expect(table.text()).toContain('tok_active')
    expect(table.text()).toContain('tok_expired')
  })

  it('加载失败时展示错误反馈', async () => {
    loadTokensMock.mockRejectedValue(new Error('load failed'))
    mountComponent()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.registration_tokens.load_failed', 'error')
  })

  it('点击创建按钮打开创建对话框', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const createButton = wrapper.findAll('button').find((b) => b.text().includes('admin.registration_tokens.create'))
    await createButton!.trigger('click')
    await flushPromises()

    const modal = wrapper.findComponent({ name: 'NModal' })
    expect(modal.exists()).toBe(true)
  })

  it('创建令牌成功后展示成功反馈并关闭对话框', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const createButton = wrapper.findAll('button').find((b) => b.text().includes('admin.registration_tokens.create'))
    await createButton!.trigger('click')
    await flushPromises()

    // 填写 token 输入框
    const tokenInput = wrapper.find('input[data-test="NInput"]')
    await tokenInput.setValue('my_new_token')

    const confirmButton = wrapper.findAll('button').find((b) => b.text().includes('common.confirm'))
    await confirmButton!.trigger('click')
    await flushPromises()

    expect(createTokenMock).toHaveBeenCalledWith({ token: 'my_new_token' })
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.registration_tokens.create_success', 'success')
  })

  it('创建失败时展示错误反馈', async () => {
    createTokenMock.mockRejectedValue(new Error('create failed'))
    const wrapper = mountComponent()
    await flushPromises()

    const createButton = wrapper.findAll('button').find((b) => b.text().includes('admin.registration_tokens.create'))
    await createButton!.trigger('click')
    await flushPromises()

    const confirmButton = wrapper.findAll('button').find((b) => b.text().includes('common.confirm'))
    await confirmButton!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.registration_tokens.create_failed', 'error')
  })
})
