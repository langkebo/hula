import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import SpaceCreateRoomPane from '../SpaceCreateRoomPane.vue'

// === Mocks ===
const { createRoomInSpaceMock, openMsgSessionMock, showFeedbackMock, formValidateMock } = vi.hoisted(() => ({
  createRoomInSpaceMock: vi.fn(),
  openMsgSessionMock: vi.fn(async () => undefined),
  showFeedbackMock: vi.fn(),
  formValidateMock: vi.fn().mockResolvedValue(true)
}))

// createError 必须在 vi.hoisted 外部声明（ref 在 hoisting 阶段不可用）
const createErrorRef = ref('')

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/composables/space/useSpaceRooms', () => ({
  useSpaceRooms: () => ({
    createRoomInSpace: createRoomInSpaceMock,
    error: createErrorRef
  })
}))

vi.mock('@/composables/chat/openMsgSession', () => ({
  openMsgSessionByRoomId: openMsgSessionMock
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() })
}))

// Mock naive-ui：NModal 渲染 default + footer 插槽；NForm 暴露 validate()；NInput/NSwitch 受控
vi.mock('naive-ui', () => {
  return {
    NModal: defineComponent({
      name: 'NModal',
      props: { show: Boolean },
      setup(_, { slots }) {
        return () => h('div', { class: 'n-modal' }, [slots.default?.(), slots.footer?.()])
      }
    }),
    NForm: defineComponent({
      name: 'NForm',
      props: { model: Object, rules: Object, labelPlacement: String, labelWidth: [String, Number] },
      setup(_, { slots }) {
        return () => h('form', { class: 'n-form' }, [slots.default?.()])
      },
      methods: { validate: formValidateMock }
    }),
    NFormItem: defineComponent({
      name: 'NFormItem',
      props: { label: String, path: String },
      setup(_, { slots }) {
        return () => h('div', { class: 'n-form-item' }, [h('label', _.label), slots.default?.()])
      }
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: { type: String, default: '' },
        placeholder: String,
        type: { type: String, default: 'text' }
      },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('textarea', {
            class: 'n-input',
            value: props.value,
            placeholder: props.placeholder,
            onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
          })
      }
    }),
    NSwitch: defineComponent({
      name: 'NSwitch',
      props: { value: { type: Boolean, default: false } },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('button', {
            class: ['n-switch', props.value ? 'is-on' : ''],
            'data-checked': props.value ? 'true' : 'false',
            onClick: () => emit('update:value', !props.value)
          })
      }
    }),
    NButton: defineComponent({
      name: 'NButton',
      props: { type: String, loading: Boolean, tertiary: Boolean },
      emits: ['click'],
      setup(props, { slots, emit }) {
        return () =>
          h(
            'button',
            {
              class: ['n-button', `n-button--${props.type || 'default'}`, props.tertiary ? 'n-button--tertiary' : ''],
              disabled: props.loading,
              onClick: (e: MouseEvent) => emit('click', e)
            },
            [slots.default?.()]
          )
      }
    })
  }
})

// === Fixtures ===
const mountPane = (props: Record<string, unknown> = {}) =>
  mount(SpaceCreateRoomPane, {
    props: { spaceId: '!space-1:server', show: true, ...props }
  })

const setFormData = async (wrapper: ReturnType<typeof mountPane>, name: string, topic = '') => {
  const inputs = wrapper.findAll('.n-input')
  await inputs[0].setValue(name)
  await inputs[1].setValue(topic)
  await wrapper.vm.$nextTick()
}

describe('SpaceCreateRoomPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createErrorRef.value = ''
    formValidateMock.mockResolvedValue(true)
    createRoomInSpaceMock.mockResolvedValue('!new-room:server')
    openMsgSessionMock.mockResolvedValue(undefined)
  })

  // (a) 渲染
  it('renders the create room form with name, topic and suggested fields', () => {
    const wrapper = mountPane()
    expect(wrapper.find('.n-modal').exists()).toBe(true)
    expect(wrapper.findAll('.n-form-item')).toHaveLength(3)
    expect(wrapper.find('button.n-button--primary').exists()).toBe(true)
  })

  // (b) 输入绑定
  it('binds name and topic inputs to form data', async () => {
    const wrapper = mountPane()
    await setFormData(wrapper, 'My Room', 'A topic')

    const vm = wrapper.vm as unknown as { formData: { name: string; topic: string; suggested: boolean } }
    expect(vm.formData.name).toBe('My Room')
    expect(vm.formData.topic).toBe('A topic')
  })

  // (c) 提交调用 createRoomInSpace
  it('calls createRoomInSpace on submit with trimmed form data', async () => {
    const wrapper = mountPane()
    await setFormData(wrapper, '  My Room  ', '  Topic  ')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(createRoomInSpaceMock).toHaveBeenCalledWith({
      name: 'My Room',
      topic: 'Topic',
      suggested: false
    })
  })

  // (d) suggested 开关
  it('passes suggested flag from the switch', async () => {
    const wrapper = mountPane()
    await setFormData(wrapper, 'My Room', 'Topic')
    await wrapper.find('.n-switch').trigger('click')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(createRoomInSpaceMock).toHaveBeenCalledWith({
      name: 'My Room',
      topic: 'Topic',
      suggested: true
    })
  })

  // (e) 成功后：emit created + 关闭 + 跳转 + 成功 toast
  it('emits created, closes modal and navigates on success', async () => {
    const wrapper = mountPane()
    await setFormData(wrapper, 'My Room')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('created')).toEqual([['!new-room:server']])
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    expect(openMsgSessionMock).toHaveBeenCalledWith('!new-room:server')
    expect(showFeedbackMock).toHaveBeenCalledWith('space.create_room_success', 'success')
  })

  // (f) 同名房间：错误含 M_ROOM_IN_USE → 提示"已存在同名房间"，不 emit created
  it('shows duplicate-name feedback and does not emit created on M_ROOM_IN_USE', async () => {
    createRoomInSpaceMock.mockResolvedValue(null)
    createErrorRef.value = 'M_ROOM_IN_USE: Room name is already in use'
    const wrapper = mountPane()
    await setFormData(wrapper, 'My Room')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('created')).toBeUndefined()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.create_room_duplicate', 'error')
  })

  // (g) 其它失败：通用失败 toast
  it('shows generic failure feedback when createRoomInSpace returns null', async () => {
    createRoomInSpaceMock.mockResolvedValue(null)
    createErrorRef.value = 'some other error'
    const wrapper = mountPane()
    await setFormData(wrapper, 'My Room')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('space.create_room_failed', 'error')
  })

  // (h) 表单校验失败不提交
  it('does not call createRoomInSpace when form validation fails', async () => {
    formValidateMock.mockRejectedValue(new Error('validation failed'))
    const wrapper = mountPane()
    await setFormData(wrapper, 'My Room')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(createRoomInSpaceMock).not.toHaveBeenCalled()
  })

  // (i) 取消按钮关闭弹窗（update:show false）
  it('emits update:show false when cancel button clicked', async () => {
    const wrapper = mountPane()
    await wrapper.find('button.n-button--tertiary').trigger('click')
    expect(wrapper.emitted('update:show')).toEqual([[false]])
  })
})
