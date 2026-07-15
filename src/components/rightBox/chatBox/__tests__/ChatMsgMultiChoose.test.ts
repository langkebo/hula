import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { MittEnum, MsgEnum, RoomTypeEnum, TauriCommand } from '@/enums'
import ChatMsgMultiChoose from '../ChatMsgMultiChoose.vue'

const {
  showFeedbackMock,
  forwardRoomMessagesMock,
  sendStructuredMessageMock,
  invokeWithErrorHandlerMock,
  clearCustomForwardTaskMock,
  resetMultiChooseStateMock,
  buildCustomTaskImageBodyMock,
  openImageViewerMock,
  mittOnMock,
  mittEmitMock,
  loggerErrorMock
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  forwardRoomMessagesMock: vi.fn(),
  sendStructuredMessageMock: vi.fn(),
  invokeWithErrorHandlerMock: vi.fn(),
  clearCustomForwardTaskMock: vi.fn(),
  resetMultiChooseStateMock: vi.fn(),
  buildCustomTaskImageBodyMock: vi.fn(),
  openImageViewerMock: vi.fn(),
  mittOnMock: vi.fn(),
  mittEmitMock: vi.fn(),
  loggerErrorMock: vi.fn()
}))

let chatStore: any
let groupStore: any
let globalStore: any

const createMessage = () => ({
  isCheck: true,
  message: {
    id: 'msg-1',
    roomId: '!source:example.com',
    sendTime: Date.now(),
    type: MsgEnum.TEXT,
    body: {
      content: 'hello'
    }
  },
  fromUser: {
    uid: '@alice:example.com',
    username: 'Alice'
  }
})

const createSession = (overrides: Record<string, unknown> = {}) => ({
  roomId: '!target:example.com',
  remark: '',
  name: 'Target Room',
  avatar: 'mxc://target/avatar',
  type: RoomTypeEnum.GROUP,
  isCheck: false,
  ...overrides
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/services/matrix/messaging/MatrixForwardService', () => ({
  matrixForwardService: {
    forwardRoomMessages: forwardRoomMessagesMock
  }
}))
vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  matrixMessageService: {
    sendStructuredMessage: sendStructuredMessageMock
  }
}))

vi.mock('@/composables/chat/useCustomForwardTask', () => ({
  useCustomForwardTask: () => ({
    clearCustomForwardTask: clearCustomForwardTaskMock,
    resetMultiChooseState: resetMultiChooseStateMock,
    buildCustomTaskImageBody: buildCustomTaskImageBodyMock
  })
}))

vi.mock('@/composables/common/useImageViewer', () => ({
  useImageViewer: () => ({
    openImageViewer: openImageViewerMock
  })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    on: mittOnMock,
    emit: mittEmitMock
  }
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => chatStore
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => groupStore
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStore
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (value?: string) => value ?? ''
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock
  })
}))

vi.mock('@/utils/MessageSelect', () => ({
  isMessageMultiSelectEnabled: () => true
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMac: () => false,
  isWindows: () => false
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeWithErrorHandler: invokeWithErrorHandlerMock
}))

vi.mock('../ChatMultiMsg.vue', () => ({
  default: {
    name: 'ChatMultiMsg',
    template: '<div data-test="chat-multi-msg"></div>'
  }
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  return {
    NModal: defineComponent({
      name: 'NModal',
      props: {
        show: {
          type: Boolean,
          default: false
        }
      },
      emits: ['update:show'],
      setup(props, { slots, emit }) {
        return () =>
          props.show
            ? h('div', { 'data-test': 'modal' }, [
                h(
                  'button',
                  {
                    type: 'button',
                    'data-test': 'modal-close',
                    onClick: () => emit('update:show', false)
                  },
                  'close'
                ),
                slots.default?.()
              ])
            : null
      }
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: {
          type: String,
          default: ''
        }
      },
      emits: ['update:value'],
      setup(props, { emit, slots }) {
        return () =>
          h('div', [
            h('input', {
              value: props.value,
              onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
            }),
            ...(slots.prefix?.() ?? []),
            ...(slots.suffix?.() ?? [])
          ])
      }
    }),
    NScrollbar: passthrough('NScrollbar'),
    NFlex: passthrough('NFlex'),
    NAvatar: passthrough('NAvatar'),
    NIcon: passthrough('NIcon'),
    NCheckbox: defineComponent({
      name: 'NCheckbox',
      props: {
        checked: {
          type: Boolean,
          default: false
        }
      },
      emits: ['update:checked'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            type: 'checkbox',
            checked: props.checked,
            onChange: () => emit('update:checked', !props.checked)
          })
      }
    }),
    NButton: defineComponent({
      name: 'NButton',
      props: {
        disabled: {
          type: Boolean,
          default: false
        }
      },
      emits: ['click'],
      setup(props, { slots, emit }) {
        return () =>
          h(
            'button',
            {
              type: 'button',
              disabled: props.disabled,
              onClick: () => emit('click')
            },
            slots.default?.()
          )
      }
    })
  }
})

const mountComponent = () => mount(ChatMsgMultiChoose)

const getToolbarButtons = (wrapper: ReturnType<typeof mountComponent>) =>
  wrapper.findAll('button').filter((item) => !item.text())

const getButtonByText = (wrapper: ReturnType<typeof mountComponent>, text: string) => {
  const button = wrapper.findAll('button').find((item) => item.text().includes(text))
  if (!button) {
    throw new Error(`按钮不存在: ${text}`)
  }

  return button
}

describe('ChatMsgMultiChoose', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    chatStore = reactive({
      isMsgMultiChoose: true,
      msgMultiChooseMode: 'default',
      customForwardTask: null,
      sessionList: [createSession()],
      chatMessageList: [createMessage()],
      clearMsgCheck: vi.fn(),
      resetSessionSelection: vi.fn(),
      setMsgMultiChoose: vi.fn(),
      deleteMsg: vi.fn(),
      setCustomForwardTask: vi.fn(),
      updateSessionLastActiveTime: vi.fn()
    })

    groupStore = reactive({
      getUserInfo: vi.fn(() => ({ myName: 'Alice' })),
      getGroupDetailByRoomId: vi.fn(() => ({ memberNum: 3 }))
    })

    globalStore = reactive({
      currentSessionRoomId: '!source:example.com'
    })

    forwardRoomMessagesMock.mockResolvedValue([{ success: true }])
    sendStructuredMessageMock.mockResolvedValue(undefined)
    invokeWithErrorHandlerMock.mockResolvedValue(undefined)
    buildCustomTaskImageBodyMock.mockResolvedValue({
      url: 'mxc://image'
    })
  })

  it('uses action feedback for empty delete selection and save-to-pc warning', async () => {
    chatStore.chatMessageList = []
    const wrapper = mountComponent()

    const toolbarButtons = getToolbarButtons(wrapper)
    await toolbarButtons[2]!.trigger('click')
    ;(wrapper.vm as unknown as { handleDeleteClick: () => void }).handleDeleteClick()

    expect(showFeedbackMock).toHaveBeenCalledWith('message.multi_choose.not_implemented', 'warning')
    expect(showFeedbackMock).toHaveBeenCalledWith('message.multi_choose.select_delete_prompt', 'warning')
  })

  it('uses action feedback for missing room during batch delete', async () => {
    globalStore.currentSessionRoomId = ''
    const wrapper = mountComponent()

    await getToolbarButtons(wrapper)[3]!.trigger('click')
    await flushPromises()
    await getButtonByText(wrapper, 'message.multi_choose.delete_action').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('message.multi_choose.room_missing', 'error')
  })

  it('uses action feedback for batch delete success and failure', async () => {
    const wrapper = mountComponent()

    await getToolbarButtons(wrapper)[3]!.trigger('click')
    await flushPromises()
    await getButtonByText(wrapper, 'message.multi_choose.delete_action').trigger('click')
    await flushPromises()

    expect(invokeWithErrorHandlerMock).toHaveBeenCalledWith(
      TauriCommand.DELETE_MESSAGE,
      {
        messageId: 'msg-1',
        roomId: '!source:example.com'
      },
      {
        customErrorMessage: 'message.multi_choose.delete_failed_short',
        errorType: expect.anything()
      }
    )
    expect(showFeedbackMock).toHaveBeenCalledWith('message.multi_choose.delete_success', 'success')
    expect(chatStore.deleteMsg).toHaveBeenCalledWith('msg-1')
    expect(mittEmitMock).toHaveBeenCalledWith(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: '!source:example.com' })

    invokeWithErrorHandlerMock.mockRejectedValueOnce(new Error('delete failed'))
    const failedWrapper = mountComponent()

    await getToolbarButtons(failedWrapper)[3]!.trigger('click')
    await flushPromises()
    await getButtonByText(failedWrapper, 'message.multi_choose.delete_action').trigger('click')
    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('message.multi_choose.delete_failed_retry', 'error')
  })

  it('uses action feedback for forward selection warning and success', async () => {
    const warningWrapper = mountComponent()

    await getToolbarButtons(warningWrapper)[0]!.trigger('click')
    await flushPromises()
    await getButtonByText(warningWrapper, 'message.multi_choose.send_button').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('message.multi_choose.search_placeholder', 'warning')

    chatStore.sessionList[0].isCheck = true
    const successWrapper = mountComponent()

    await getToolbarButtons(successWrapper)[0]!.trigger('click')
    await flushPromises()
    await getButtonByText(successWrapper, 'message.multi_choose.send_button').trigger('click')
    await flushPromises()

    expect(forwardRoomMessagesMock).toHaveBeenCalledWith('!source:example.com', ['msg-1'], ['!target:example.com'])
    expect(showFeedbackMock).toHaveBeenCalledWith('message.multi_choose.forward_success', 'success')
    expect(resetMultiChooseStateMock).toHaveBeenCalled()
  })

  it('uses action feedback for forward failure', async () => {
    chatStore.sessionList[0].isCheck = true
    forwardRoomMessagesMock.mockRejectedValueOnce(new Error('forward failed'))
    const wrapper = mountComponent()

    await getToolbarButtons(wrapper)[0]!.trigger('click')
    await flushPromises()
    await getButtonByText(wrapper, 'message.multi_choose.send_button').trigger('click')
    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('message.multi_choose.forward_failed', 'error')
  })
})
