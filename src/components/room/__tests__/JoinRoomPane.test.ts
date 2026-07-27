import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import JoinRoomPane from '../JoinRoomPane.vue'

// === Mocks ===
const { joinRoomMock, openMsgSessionMock, showFeedbackMock, routerBackMock, formValidateMock } = vi.hoisted(() => ({
  joinRoomMock: vi.fn(),
  openMsgSessionMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  routerBackMock: vi.fn(),
  formValidateMock: vi.fn().mockResolvedValue(true)
}))

// draftData 必须在 vi.hoisted 外部声明（reactive 在 hoisting 阶段不可用）
const draftData = reactive({ roomIdOrAlias: '', reason: '' })

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/composables/chat/openMsgSession', () => ({
  openMsgSession: openMsgSessionMock
}))

vi.mock('@/services/matrix/room/ActionFacade', () => ({
  matrixRoomActionFacade: { joinRoom: joinRoomMock }
}))

vi.mock('@/stores/domains/widget/rightViewDraft', () => ({
  useRightViewDraftStore: () => ({
    // Pinia setup store 自动解包 ref，mock 中直接返回 reactive 对象模拟此行为
    joinRoom: draftData,
    saveJoinRoom: vi.fn((patch: Partial<typeof draftData>) => {
      Object.assign(draftData, patch)
    }),
    clearJoinRoom: vi.fn(() => {
      draftData.roomIdOrAlias = ''
      draftData.reason = ''
    }),
    restoredHint: null,
    setRestoredHint: vi.fn()
  })
}))

vi.mock('@/router', () => ({
  default: { back: routerBackMock, push: vi.fn(), replace: vi.fn() }
}))

vi.mock('@/enums', () => ({
  RoomTypeEnum: { GROUP: 'group', SINGLE: 'single' }
}))

// Mock naive-ui: NForm exposes validate() via ref
vi.mock('naive-ui', () => {
  return {
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
        clearable: Boolean,
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
    NButton: defineComponent({
      name: 'NButton',
      props: { type: String, loading: Boolean, size: String },
      emits: ['click'],
      setup(props, { slots, emit }) {
        return () =>
          h(
            'button',
            {
              class: ['n-button', `n-button--${props.type || 'default'}`],
              disabled: props.loading,
              onClick: (e: MouseEvent) => emit('click', e)
            },
            [slots.default?.()]
          )
      }
    }),
    NScrollbar: defineComponent({
      name: 'NScrollbar',
      setup(_, { slots }) {
        return () => h('div', { class: 'n-scrollbar' }, [slots.default?.()])
      }
    }),
    NAlert: defineComponent({
      name: 'NAlert',
      props: { type: String, bordered: Boolean },
      setup(_, { slots }) {
        return () => h('div', { class: 'n-alert' }, [slots.default?.()])
      }
    })
  }
})

// === Fixtures ===
const mountPane = () => mount(JoinRoomPane)

const setFormData = async (wrapper: ReturnType<typeof mountPane>, roomIdOrAlias: string, reason = '') => {
  const inputs = wrapper.findAll('.n-input')
  // 第一个 input 是 roomIdOrAlias，第二个是 reason
  await inputs[0].setValue(roomIdOrAlias)
  await inputs[1].setValue(reason)
  await wrapper.vm.$nextTick()
}

describe('JoinRoomPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    draftData.roomIdOrAlias = ''
    draftData.reason = ''
    formValidateMock.mockResolvedValue(true)
    joinRoomMock.mockResolvedValue({ roomId: '!new-room:server', name: 'New Room' })
    openMsgSessionMock.mockResolvedValue(undefined)
  })

  // (a) 渲染
  it('renders the join room form with roomIdOrAlias and reason fields', () => {
    const wrapper = mountPane()
    expect(wrapper.find('.join-room-pane').exists()).toBe(true)
    expect(wrapper.findAll('.n-form-item')).toHaveLength(2)
    expect(wrapper.find('button.n-button--primary').exists()).toBe(true)
  })

  // (b) 输入 roomIdOrAlias
  it('binds roomIdOrAlias and reason inputs to form data', async () => {
    const wrapper = mountPane()
    await setFormData(wrapper, '!room:server', 'want to join')

    const vm = wrapper.vm as unknown as { formData: { roomIdOrAlias: string; reason: string } }
    expect(vm.formData.roomIdOrAlias).toBe('!room:server')
    expect(vm.formData.reason).toBe('want to join')
  })

  // (c) 提交调用 matrixRoomActionFacade.joinRoom
  it('calls matrixRoomActionFacade.joinRoom on submit', async () => {
    const wrapper = mountPane()
    await setFormData(wrapper, '!room:server', 'reason')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(joinRoomMock).toHaveBeenCalledWith('!room:server')
  })

  // (e) 成功后跳转 chat
  it('opens message session and navigates back on successful join', async () => {
    const wrapper = mountPane()
    await setFormData(wrapper, '!room:server')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(openMsgSessionMock).toHaveBeenCalledWith('!new-room:server', 'group')
    expect(showFeedbackMock).toHaveBeenCalledWith('room.join.success', 'success')
    expect(routerBackMock).toHaveBeenCalled()
  })

  it('clears draft on successful join', async () => {
    const wrapper = mountPane()
    await setFormData(wrapper, '!room:server')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    // clearJoinRoom 重置 draftData
    expect(draftData.roomIdOrAlias).toBe('')
    expect(draftData.reason).toBe('')
  })

  // (f) 错误 Toast — 各种 errcode
  it('shows not_found error toast when joinRoom rejects with M_NOT_FOUND', async () => {
    joinRoomMock.mockRejectedValue({ errcode: 'M_NOT_FOUND' })
    const wrapper = mountPane()
    await setFormData(wrapper, '!missing:server')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.join.not_found', 'error')
  })

  it('shows already_joined warning when joinRoom rejects with M_ALREADY_JOINED', async () => {
    joinRoomMock.mockRejectedValue({ errcode: 'M_ALREADY_JOINED' })
    const wrapper = mountPane()
    await setFormData(wrapper, '!joined:server')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.join.already_joined', 'warning')
  })

  it('shows forbidden error when joinRoom rejects with M_FORBIDDEN', async () => {
    joinRoomMock.mockRejectedValue({ errcode: 'M_FORBIDDEN' })
    const wrapper = mountPane()
    await setFormData(wrapper, '!forbidden:server')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.join.forbidden', 'error')
  })

  it('shows generic error toast for unknown error codes', async () => {
    joinRoomMock.mockRejectedValue(new Error('network'))
    const wrapper = mountPane()
    await setFormData(wrapper, '!room:server')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.join.failed', 'error')
  })

  // 表单校验失败不提交
  it('does not call joinRoom when form validation fails', async () => {
    formValidateMock.mockRejectedValue(new Error('validation failed'))
    const wrapper = mountPane()
    await setFormData(wrapper, '!room:server')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(joinRoomMock).not.toHaveBeenCalled()
  })

  // (d) 草稿恢复
  it('restores draft from store on mount and shows hint', async () => {
    draftData.roomIdOrAlias = '!draft:server'
    draftData.reason = 'draft reason'
    const wrapper = mountPane()
    await flushPromises()

    const vm = wrapper.vm as unknown as { formData: { roomIdOrAlias: string; reason: string } }
    expect(vm.formData.roomIdOrAlias).toBe('!draft:server')
    expect(vm.formData.reason).toBe('draft reason')
    expect(wrapper.find('.join-room-pane__hint').exists()).toBe(true)
  })

  it('does not show restored hint when no draft exists', () => {
    const wrapper = mountPane()
    expect(wrapper.find('.join-room-pane__hint').exists()).toBe(false)
  })

  // 自动同步草稿
  it('saves draft to store when form data changes', async () => {
    const wrapper = mountPane()
    await setFormData(wrapper, '!sync:server', 'sync reason')
    await flushPromises()

    expect(draftData.roomIdOrAlias).toBe('!sync:server')
    expect(draftData.reason).toBe('sync reason')
  })
})
