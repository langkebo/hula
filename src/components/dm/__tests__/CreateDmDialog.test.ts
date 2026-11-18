import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CreateDmDialog from '../CreateDmDialog.vue'

const { getUserProfileMock } = vi.hoisted(() => ({
  getUserProfileMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: vi.fn()
  })
}))

vi.mock('@/services/matrix/room/MatrixDirectMessageService', () => ({
  matrixDirectMessageService: {
    getOrCreateDmRoom: vi.fn()
  }
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => ({
    contactsList: [],
    getUserProfile: getUserProfileMock
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (value?: string) => value ?? ''
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
    NFlex: passthrough('NFlex'),
    NIcon: passthrough('NIcon'),
    NDivider: passthrough('NDivider'),
    NAvatar: passthrough('NAvatar'),
    NScrollbar: passthrough('NScrollbar'),
    NEmpty: defineComponent({
      name: 'NEmpty',
      props: {
        description: {
          type: String,
          default: ''
        }
      },
      setup(props) {
        return () => h('div', { class: 'n-empty' }, props.description)
      }
    }),
    NSpin: defineComponent({
      name: 'NSpin',
      props: {
        show: {
          type: Boolean,
          default: true
        }
      },
      setup(props, { slots }) {
        return () => h('div', { class: 'n-spin' }, props.show ? h('div', { class: 'n-spin-body' }) : slots.default?.())
      }
    }),
    NCheckbox: defineComponent({
      name: 'NCheckbox',
      props: {
        checked: {
          type: Boolean,
          default: false
        }
      },
      emits: ['update:checked'],
      setup(props, { emit, slots }) {
        return () =>
          h('label', [
            h('input', {
              type: 'checkbox',
              checked: props.checked,
              onChange: () => emit('update:checked', !props.checked)
            }),
            ...(slots.default?.() ?? [])
          ])
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
            ...(slots.prefix?.() ?? [])
          ])
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

const mountDialog = () =>
  mount(CreateDmDialog, {
    props: {
      show: true
    },
    global: {
      stubs: {
        BaseRightDrawer: { template: '<div><slot /><slot name="footer" /></div>' }
      }
    }
  })

describe('CreateDmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('检索失败时显示错误态而不是「未找到用户」', async () => {
    getUserProfileMock.mockRejectedValue(new Error('boom'))
    const wrapper = mountDialog()

    await wrapper.find('input').setValue('@ghost:example.com')
    await wrapper.find('input').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.find('[data-test="dm-search-error"]').exists()).toBe(true)
    expect(wrapper.find('.n-empty').exists()).toBe(false)
  })

  it('重试成功后恢复检索结果', async () => {
    getUserProfileMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ userId: '@alice:example.com', displayName: 'Alice' })
    const wrapper = mountDialog()

    await wrapper.find('input').setValue('@alice:example.com')
    await wrapper.find('input').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.find('[data-test="dm-search-error"]').exists()).toBe(true)

    await wrapper.find('[data-testid="error-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="dm-search-error"]').exists()).toBe(false)
    expect(wrapper.find('.search-result').exists()).toBe(true)
    expect(wrapper.text()).toContain('Alice')
  })
})
