import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomTypeEnum } from '@/enums'
import Details from '../Details.vue'

const openMsgSessionMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const startRtcCallMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const createWebviewWindowMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const showFeedbackMock = vi.hoisted(() => vi.fn())

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === 'home.chat_details.single.empty_signature') return '这个人很高冷，暂时没有留下什么'
      if (key === 'home.chat_details.single.unknown') return '未知'
      if (key === 'home.chat_details.single.region') return `地区：${params?.place ?? '未知'}`
      if (key === 'home.chat_details.actions.message') return '发信息'
      if (key === 'home.chat_details.single.footer.audio_call') return '打电话'
      if (key === 'home.chat_details.single.footer.video_call') return '打视频'
      if (key === 'home.chat_details.single.friend_info_missing') return '无法获取好友信息'
      return key
    }
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/composables/chat/openMsgSession', () => ({
  openMsgSession: openMsgSessionMock
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
            activeStatus: 0
          }
        : undefined
    )
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
      template: '<button @click="$emit(\'click\')"><slot /></button>'
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

  it('展示选中好友的头像、昵称、账号和三个操作按钮', async () => {
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
    expect(wrapper.findAll('.single-details__action')).toHaveLength(3)
  })

  it('点击操作按钮时会打开会话并尝试发起通话', async () => {
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
    await actions[0].trigger('click')
    await actions[1].trigger('click')
    await actions[2].trigger('click')

    expect(openMsgSessionMock).toHaveBeenCalledWith('@kevins:matrix.test', RoomTypeEnum.SINGLE)
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
})
