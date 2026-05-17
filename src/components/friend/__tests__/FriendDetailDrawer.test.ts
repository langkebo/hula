import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { OnlineEnum } from '@/enums'
import FriendDetailDrawer from '../FriendDetailDrawer.vue'

const { contactStoreMock, announceMock, showFeedbackMock } = vi.hoisted(() => ({
  contactStoreMock: {
    getContactByUserId: vi.fn(),
    getUserProfile: vi.fn(),
    setFriendNote: vi.fn(),
    setFriendDisplayName: vi.fn(),
    startDirectRoom: vi.fn(),
    removeFromContacts: vi.fn()
  },
  announceMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/common/useAriaLive', () => ({
  useAriaLive: () => ({
    announce: announceMock
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => contactStoreMock
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light'
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (value?: string) => value ?? ''
  }
}))

vi.mock('naive-ui', () => {
  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  return {
    NDrawer: passthrough('NDrawer'),
    NDrawerContent: passthrough('NDrawerContent'),
    NSpin: passthrough('NSpin'),
    NFlex: passthrough('NFlex'),
    NAvatar: passthrough('NAvatar'),
    NDivider: passthrough('NDivider'),
    NTag: passthrough('NTag'),
    NEmpty: passthrough('NEmpty'),
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      setup(_, { emit, slots }) {
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
      setup(props, { emit }) {
        return () =>
          h('input', {
            value: props.value,
            onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
          })
      }
    })
  }
})

const baseContact = {
  userId: '@alice:example.com',
  displayName: 'Alice',
  avatarUrl: 'mxc://example/alice',
  uid: 'alice',
  name: 'Alice',
  account: 'alice',
  avatar: '',
  activeStatus: OnlineEnum.ONLINE,
  remark: 'Alice Remark',
  lastOptTime: Date.now(),
  hideMyPosts: false,
  hideTheirPosts: false,
  friendStatus: 'normal' as const,
  note: 'hello'
}

describe('FriendDetailDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    contactStoreMock.getContactByUserId.mockReturnValue(baseContact)
    contactStoreMock.getUserProfile.mockResolvedValue(baseContact)
    contactStoreMock.setFriendNote.mockResolvedValue(true)
    contactStoreMock.setFriendDisplayName.mockResolvedValue(true)
    contactStoreMock.startDirectRoom.mockResolvedValue(undefined)
    contactStoreMock.removeFromContacts.mockResolvedValue(true)
    ;(window as any).$dialog = {
      warning: vi.fn()
    }
  })

  it('announces note and display name save results through live region', async () => {
    const wrapper = mount(FriendDetailDrawer, {
      props: {
        show: true,
        userId: '@alice:example.com'
      }
    })

    await flushPromises()

    const buttons = () => wrapper.findAll('button')

    await buttons()
      .find((button) => button.text() === 'friend.detail.note_section')!
      .trigger('click')
    await flushPromises()

    await wrapper.find('input').setValue('new note')
    await flushPromises()

    await buttons()
      .find((button) => button.text() === 'common.confirm')!
      .trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.detail.note_saved', 'success', 'polite')

    contactStoreMock.setFriendDisplayName.mockRejectedValueOnce(new Error('display name failed'))

    await buttons()
      .find((button) => button.text() === 'friend.detail.edit_display_name')!
      .trigger('click')
    await flushPromises()

    await wrapper.find('input').setValue('new display name')
    await flushPromises()

    const confirmButtons = buttons().filter((button) => button.text() === 'common.confirm')
    await confirmButtons[0].trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.detail.display_name_error', 'error', 'assertive')
  })

  it('announces encrypted chat error and remove friend results through live region', async () => {
    contactStoreMock.startDirectRoom.mockRejectedValueOnce(new Error('chat failed'))

    const wrapper = mount(FriendDetailDrawer, {
      props: {
        show: true,
        userId: '@alice:example.com'
      }
    })

    await flushPromises()

    const buttons = () => wrapper.findAll('button')

    await buttons()
      .find((button) => button.text() === 'friend.detail.encrypted_chat')!
      .trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.detail.chat_error', 'error', 'assertive')

    await buttons()
      .find((button) => button.text() === 'friend.detail.remove_friend')!
      .trigger('click')
    expect(window.$dialog.warning).toHaveBeenCalled()

    const firstDialogCall = (window as any).$dialog.warning.mock.calls[0][0]
    await firstDialogCall.onPositiveClick()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.detail.remove_success', 'success', 'polite')

    contactStoreMock.removeFromContacts.mockResolvedValueOnce(false)

    await buttons()
      .find((button) => button.text() === 'friend.detail.remove_friend')!
      .trigger('click')
    const secondDialogCall = (window as any).$dialog.warning.mock.calls[1][0]
    await secondDialogCall.onPositiveClick()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.detail.remove_error', 'error', 'assertive')
  })
})
