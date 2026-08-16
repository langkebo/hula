import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InviteDialog from '../InviteDialog.vue'

const { inviteUserMock, showFeedbackMock, loggerErrorMock, searchUsersMock } = vi.hoisted(() => ({
  inviteUserMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  searchUsersMock: vi.fn()
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

vi.mock('@/services/matrix/room/ActionFacade', () => ({
  matrixRoomActionFacade: {
    inviteUser: inviteUserMock
  }
}))

vi.mock('@/services/matrix/MatrixSearchService', () => ({
  matrixSearchService: {
    searchUsers: searchUsersMock
  }
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
      emits: ['update:value', 'keydown.enter'],
      setup(props, { emit, slots }) {
        return () =>
          h('div', [
            h('input', {
              value: props.value,
              onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value),
              onKeydown: (event: KeyboardEvent) => {
                if (event.key === 'Enter') {
                  emit('keydown.enter')
                }
              }
            }),
            ...(slots.suffix?.() ?? []),
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
    NDivider: passthrough('NDivider'),
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

describe('InviteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchUsersMock.mockResolvedValue([])
    inviteUserMock.mockResolvedValue(undefined)
  })

  it('uses action feedback for invalid id, invite success and invite failure', async () => {
    const wrapper = mount(InviteDialog, {
      props: {
        show: true,
        roomId: '!room:example.com'
      },
      global: {
        stubs: {
          BaseRightDrawer: { template: '<div><slot /><slot name="footer" /></div>' }
        }
      }
    })

    const inputs = wrapper.findAll('input')
    await inputs[1]!.setValue('invalid-id')
    await wrapper.findAll('button')[0]!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.invite.invalid_user_id', 'warning')

    await inputs[1]!.setValue('@alice:example.com')
    await wrapper.findAll('button')[0]!.trigger('click')
    await flushPromises()

    await wrapper.findAll('button')[2]!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.invite.success', 'success')
    expect(wrapper.emitted('invited')?.[0]).toEqual([['@alice:example.com']])

    inviteUserMock.mockRejectedValueOnce(new Error('invite failed'))

    await inputs[1]!.setValue('@bob:example.com')
    await wrapper.findAll('button')[0]!.trigger('click')
    await flushPromises()
    await wrapper.findAll('button')[2]!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.invite.failed', 'error')
  })
})
