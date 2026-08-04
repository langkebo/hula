import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AnnouncementPanel from '../AnnouncementPanel.vue'

const {
  emitToMock,
  showFeedbackMock,
  pushAnnouncementMock,
  editAnnouncementMock,
  getGroupAnnouncementListMock,
  loggerErrorMock
} = vi.hoisted(() => ({
  emitToMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  pushAnnouncementMock: vi.fn(),
  editAnnouncementMock: vi.fn(),
  getGroupAnnouncementListMock: vi.fn(),
  loggerErrorMock: vi.fn()
}))

vi.mock('@tauri-apps/api/event', () => ({
  emitTo: emitToMock
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

vi.mock('@/composables/common/useLinkSegments', () => ({
  extractLinkSegments: (content: string) => [{ text: content, isLink: false }],
  openExternalUrl: vi.fn()
}))

vi.mock('@/services/matrix/room/MatrixAnnouncementService', () => ({
  matrixAnnouncementService: {
    pushAnnouncement: pushAnnouncementMock,
    editAnnouncement: editAnnouncementMock,
    deleteAnnouncement: vi.fn()
  }
}))

vi.mock('@/stores/domains/chat/announcement', () => ({
  useAnnouncementStore: () => ({
    getGroupAnnouncementList: getGroupAnnouncementListMock
  })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    currentLordId: '@admin:example.com',
    adminUidList: [],
    getUserInfo: vi.fn(() => null)
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    userInfo: {
      uid: '@admin:example.com'
    }
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (value?: string) => value ?? ''
  }
}))

vi.mock('@/utils/ComputedTime.ts', () => ({
  formatChatTime: () => 'just now'
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
    NFlex: passthrough('NFlex'),
    NScrollbar: passthrough('NScrollbar'),
    NSpin: passthrough('NSpin'),
    NEmpty: passthrough('NEmpty'),
    NAvatar: passthrough('NAvatar'),
    NPopconfirm: passthrough('NPopconfirm'),
    NSwitch: defineComponent({
      name: 'NSwitch',
      props: {
        value: {
          type: Boolean,
          default: false
        }
      },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            type: 'checkbox',
            checked: props.value,
            onChange: () => emit('update:value', !props.value)
          })
      }
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: {
          type: String,
          default: ''
        },
        type: {
          type: String,
          default: 'text'
        }
      },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h(props.type === 'textarea' ? 'textarea' : 'input', {
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

const mountPanel = () =>
  mount(AnnouncementPanel, {
    props: {
      roomId: '!room:example.com'
    }
  })

const getButtonByText = (wrapper: ReturnType<typeof mountPanel>, text: string) => {
  const button = wrapper.findAll('button').find((item) => item.text().includes(text))
  if (!button) {
    throw new Error(`按钮不存在: ${text}`)
  }
  return button
}

describe('AnnouncementPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getGroupAnnouncementListMock.mockResolvedValue({ records: [] })
    pushAnnouncementMock.mockResolvedValue(undefined)
    editAnnouncementMock.mockResolvedValue(undefined)
  })

  it('uses action feedback for empty-content warning and publish success', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    await getButtonByText(wrapper, 'announcement.form.actions.new').trigger('click')
    await getButtonByText(wrapper, 'announcement.form.actions.publish').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('announcement.toast.contentRequired', 'warning')

    await wrapper.get('textarea').setValue('Hello announcement')
    await getButtonByText(wrapper, 'announcement.form.actions.publish').trigger('click')
    await flushPromises()

    expect(pushAnnouncementMock).toHaveBeenCalledWith('!room:example.com', {
      content: 'Hello announcement',
      isPinned: false
    })
    expect(showFeedbackMock).toHaveBeenCalledWith('announcement.toast.createSuccess', 'success')
    expect(emitToMock).toHaveBeenCalledWith('home', 'announcementUpdated', {
      hasAnnouncements: false,
      topAnnouncement: null
    })
  })

  it('uses action feedback for publish failure', async () => {
    pushAnnouncementMock.mockRejectedValueOnce(new Error('publish failed'))
    const wrapper = mountPanel()
    await flushPromises()

    await getButtonByText(wrapper, 'announcement.form.actions.new').trigger('click')
    await wrapper.get('textarea').setValue('Broken announcement')
    await getButtonByText(wrapper, 'announcement.form.actions.publish').trigger('click')
    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('announcement.toast.createFail', 'error')
  })
})
