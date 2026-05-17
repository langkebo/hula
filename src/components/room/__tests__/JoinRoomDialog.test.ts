import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JoinRoomDialog from '../JoinRoomDialog.vue'

const { validateMock, joinRoomMock, showFeedbackMock, loggerErrorMock } = vi.hoisted(() => ({
  validateMock: vi.fn(),
  joinRoomMock: vi.fn(),
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

vi.mock('@/composables/room/useRoomActions', () => ({
  useRoomActions: () => ({
    joinRoom: joinRoomMock
  })
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
    NForm: defineComponent({
      name: 'NForm',
      setup(_, { slots, expose }) {
        expose({ validate: validateMock })
        return () => h('form', slots.default?.())
      }
    }),
    NFormItem: passthrough('NFormItem'),
    NAlert: passthrough('NAlert'),
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: {
          type: String,
          default: ''
        }
      },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            value: props.value,
            onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
          })
      }
    }),
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () =>
          h(
            'button',
            {
              type: 'button',
              onClick: () => emit('click')
            },
            slots.default?.()
          )
      }
    })
  }
})

describe('JoinRoomDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateMock.mockResolvedValue(undefined)
    joinRoomMock.mockResolvedValue({ roomId: '!room:example.com' })
  })

  it('uses action feedback for join success and error states', async () => {
    const wrapper = mount(JoinRoomDialog, {
      props: {
        visible: true
      }
    })

    await wrapper.findAll('input')[0]!.setValue('!room:example.com')
    await wrapper.findAll('button')[1]!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.join.success', 'success')
    expect(wrapper.emitted('joined')?.[0]).toEqual(['!room:example.com'])

    joinRoomMock.mockRejectedValueOnce({ errcode: 'M_ALREADY_JOINED' })

    await wrapper.findAll('button')[1]!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.join.already_joined', 'warning')
  })
})
