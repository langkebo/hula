import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ForwardDialog from '../ForwardDialog.vue'

const { getRoomMessageMock, forwardEventToMultipleRoomsMock, showFeedbackMock, loggerErrorMock } = vi.hoisted(() => ({
  getRoomMessageMock: vi.fn(),
  forwardEventToMultipleRoomsMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  loggerErrorMock: vi.fn()
}))

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

vi.mock('@/composables/chat/useChatMessageActions', () => ({
  useChatMessageActions: () => ({
    getRoomMessage: getRoomMessageMock,
    forwardEventToMultipleRooms: forwardEventToMultipleRoomsMock
  })
}))

vi.mock('@/stores/domains/chat/room', () => ({
  useRoomStore: () => ({
    rooms: new Map([
      [
        '!source:example.com',
        {
          roomId: '!source:example.com',
          name: 'Source Room',
          avatarUrl: 'mxc://source/avatar',
          isEncrypted: false
        }
      ],
      [
        '!target:example.com',
        {
          roomId: '!target:example.com',
          name: 'Target Room',
          avatarUrl: 'mxc://target/avatar',
          isEncrypted: true
        }
      ]
    ])
  })
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
      setup(props, { slots }) {
        return () => (props.show ? h('div', [slots.default?.(), slots.footer?.()]) : null)
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
            ...(slots.prefix?.() ?? [])
          ])
      }
    }),
    NScrollbar: passthrough('NScrollbar'),
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
    NAvatar: passthrough('NAvatar'),
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

const mountDialog = () =>
  mount(ForwardDialog, {
    props: {
      visible: true,
      eventId: '$event',
      roomId: '!source:example.com'
    }
  })

const getSendButton = (wrapper: ReturnType<typeof mountDialog>) => {
  const button = wrapper.findAll('button').find((item) => item.text().includes('message.forward.send'))
  if (!button) {
    throw new Error('发送按钮不存在')
  }
  return button
}

describe('ForwardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRoomMessageMock.mockResolvedValue({ event_id: '$event' })
    forwardEventToMultipleRoomsMock.mockResolvedValue([{ success: true }])
  })

  it('uses action feedback for forward success', async () => {
    const wrapper = mountDialog()

    await wrapper.get('.room-item').trigger('click')
    await getSendButton(wrapper).trigger('click')
    await flushPromises()

    expect(getRoomMessageMock).toHaveBeenCalledWith('!source:example.com', '$event')
    expect(forwardEventToMultipleRoomsMock).toHaveBeenCalledWith({ event_id: '$event' }, ['!target:example.com'])
    expect(showFeedbackMock).toHaveBeenCalledWith('message.forward.success', 'success')
    expect(wrapper.emitted('forwarded')).toEqual([[['!target:example.com']]])
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it('uses action feedback for forward failure', async () => {
    forwardEventToMultipleRoomsMock.mockRejectedValueOnce(new Error('forward failed'))
    const wrapper = mountDialog()

    await wrapper.get('.room-item').trigger('click')
    await getSendButton(wrapper).trigger('click')
    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('message.forward.failed', 'error')
  })
})
