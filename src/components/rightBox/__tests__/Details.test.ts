import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomTypeEnum } from '@/enums'
import { createI18nMock } from '~/tests/i18n-messages'
import Details from '../Details.vue'

const openMsgSessionMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const openMsgSessionByRoomIdMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const startRtcCallMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const createWebviewWindowMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const showFeedbackMock = vi.hoisted(() => vi.fn())
const startDirectRoomMock = vi.hoisted(() => vi.fn().mockResolvedValue('!room:matrix.test'))
const setFriendNoteMock = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const setFriendDisplayNameMock = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const setFriendStatusMock = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const removeFromContactsMock = vi.hoisted(() => vi.fn().mockResolvedValue(true))

vi.mock('vue-i18n', () => createI18nMock())

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/composables/chat/openMsgSession', () => ({
  openMsgSession: openMsgSessionMock,
  openMsgSessionByRoomId: openMsgSessionByRoomIdMock
}))

vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({
    startRtcCall: startRtcCallMock,
    createWebviewWindow: createWebviewWindowMock
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (value: string) => value
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  })
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => ({
    getContactByUserId: vi.fn((uid: string) =>
      uid === '@kevins:matrix.test'
        ? {
            uid,
            userId: uid,
            name: 'kevins',
            displayName: 'kevins',
            account: 'kevins',
            avatar: 'mxc://avatar',
            avatarUrl: 'mxc://avatar',
            statusMessage: '',
            activeStatus: 0,
            friendStatus: 'accepted',
            note: '',
            remark: ''
          }
        : undefined
    ),
    startDirectRoom: startDirectRoomMock,
    setFriendNote: setFriendNoteMock,
    setFriendDisplayName: setFriendDisplayNameMock,
    setFriendStatus: setFriendStatusMock,
    removeFromContacts: removeFromContactsMock
  })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    loadGroupInfo: vi.fn(),
    userList: []
  })
}))

describe('Details', () => {
  const globalStubs = {
    NAvatar: {
      props: ['src', 'size'],
      template: '<img class="avatar" :src="src" :data-size="size" />'
    },
    NImage: {
      props: ['src'],
      template: '<img class="image" :src="src" />'
    },
    NButton: {
      emits: ['click'],
      props: ['type', 'size', 'loading', 'disabled', 'text', 'block'],
      template: '<button @click="$emit(\'click\')"><slot /></button>'
    },
    NInput: {
      props: ['value', 'placeholder', 'disabled', 'size'],
      emits: ['update:value'],
      template:
        '<input :value="value" :placeholder="placeholder" @input="$emit(\'update:value\', $event.target.value)" />'
    },
    NTag: {
      props: ['type', 'size', 'round'],
      template: '<span class="tag"><slot /></span>'
    },
    NFlex: {
      template: '<div><slot /></div>'
    },
    NGrid: {
      template: '<div><slot /></div>'
    },
    NGi: {
      template: '<div><slot /></div>'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('展示选中好友的头像、昵称、账号和四个操作按钮', async () => {
    const wrapper = mount(Details, {
      props: {
        content: {
          type: RoomTypeEnum.SINGLE,
          uid: '@kevins:matrix.test'
        }
      },
      global: {
        stubs: globalStubs,
        plugins: [createPinia()]
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain('kevins')
    expect(wrapper.text()).toContain('@kevins:matrix.test')
    expect(wrapper.text()).toContain('账号：kevins')
    expect(wrapper.findAll('.single-details__action')).toHaveLength(4)
  })

  it('点击发消息按钮会打开会话', async () => {
    const wrapper = mount(Details, {
      props: {
        content: {
          type: RoomTypeEnum.SINGLE,
          uid: '@kevins:matrix.test'
        }
      },
      global: {
        stubs: globalStubs,
        plugins: [createPinia()]
      }
    })

    await flushPromises()

    const actions = wrapper.findAll('.single-details__action')
    // [0] 发消息
    await actions[0].trigger('click')
    // [1] 加密聊天
    await actions[1].trigger('click')
    // [2] 语音通话
    await actions[2].trigger('click')
    // [3] 视频通话
    await actions[3].trigger('click')

    await flushPromises()

    expect(openMsgSessionMock).toHaveBeenCalledWith('@kevins:matrix.test', RoomTypeEnum.SINGLE)
    expect(startDirectRoomMock).toHaveBeenCalledWith('@kevins:matrix.test', true)
    expect(startRtcCallMock).toHaveBeenCalledTimes(2)
  })

  it('缺少好友信息时使用统一反馈提示', async () => {
    const wrapper = mount(Details, {
      props: {
        content: {
          type: RoomTypeEnum.SINGLE,
          uid: ''
        }
      },
      global: {
        stubs: globalStubs,
        plugins: [createPinia()]
      }
    })

    await flushPromises()
    await wrapper.find('.single-details__action').trigger('click')

    expect(showFeedbackMock).toHaveBeenCalledWith('无法获取好友信息', 'warning')
    expect(openMsgSessionMock).not.toHaveBeenCalled()
  })

  it('展示好友管理区域并支持设置备注', async () => {
    const wrapper = mount(Details, {
      props: {
        content: {
          type: RoomTypeEnum.SINGLE,
          uid: '@kevins:matrix.test'
        }
      },
      global: {
        stubs: globalStubs,
        plugins: [createPinia()]
      }
    })

    await flushPromises()

    // 管理区域存在
    expect(wrapper.find('.single-details__management').exists()).toBe(true)
    // 备注区域（使用 InlineEdit 组件）
    const noteSection = wrapper.findAll('.management-section')[0]
    expect(noteSection.exists()).toBe(true)
    // 点击编辑按钮进入编辑态
    await noteSection.find('.inline-edit__toggle').trigger('click')
    expect(wrapper.find('.inline-edit__input').exists()).toBe(true)
  })
})
