import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomTypeEnum } from '@/enums'
import SingleDetails from '../SingleDetails.vue'

// --- Mocks (hoisted) ---

const getFriendGroupsMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue([
    { group_id: 'g1', name: '同事', member_count: 3 },
    { group_id: 'g2', name: '家人', member_count: 2 }
  ])
)
const getFriendGroupsByUserMock = vi.hoisted(() => vi.fn().mockResolvedValue([{ group_id: 'g1', name: '同事' }]))
const addFriendToGroupMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const removeFriendFromGroupMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

const getUserDevicesMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue([
    {
      device_id: 'DEV1',
      display_name: 'MacBook Pro',
      last_seen_ts: 1700000000000,
      last_seen_ip: '127.0.0.1',
      verified: true
    },
    {
      device_id: 'DEV2',
      display_name: 'iPhone',
      last_seen_ts: 1700000000001,
      last_seen_ip: '127.0.0.2',
      verified: false
    }
  ])
)

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        'friend.detail.group_section': '分组分配',
        'friend.detail.group_placeholder': '选择分组',
        'friend.detail.group_unassigned': '未分组',
        'friend.detail.group_load_error': '加载分组失败',
        'friend.detail.group_assign_success': '已分配分组',
        'friend.detail.group_assign_error': '分配分组失败',
        'friend.detail.group_remove_success': '已移出分组',
        'friend.detail.group_remove_error': '移出分组失败',
        'friend.detail.devices_section': '设备列表',
        'friend.detail.devices_loading': '加载设备中...',
        'friend.detail.devices_empty': '暂无设备',
        'friend.detail.devices_load_error': '加载设备失败',
        'friend.detail.device_verified': '已验证',
        'friend.detail.device_unverified': '未验证',
        'friend.detail.device_last_seen': '最后活跃',
        'friend.detail.device_unknown': '未知设备',
        'friend.detail.federation_section': '联邦/服务器',
        'friend.detail.server_address': '服务器地址',
        'friend.detail.federated_user': '联邦用户',
        'friend.detail.local_user': '本地用户',
        'friend.detail.last_seen': '最后活跃',
        'friend.detail.just_now': '刚刚',
        'friend.detail.minutes_ago': '{count}分钟前',
        'friend.detail.hours_ago': '{count}小时前',
        'friend.detail.days_ago': '{count}天前',
        'friend.status.normal': '普通好友',
        'friend.status.favorite': '收藏好友',
        'friend.status.blocked': '已屏蔽',
        'friend.status.hidden': '已隐藏',
        'friend.detail.encrypted_chat': '加密聊天',
        'friend.detail.note': '备注',
        'friend.detail.note_section': '修改备注',
        'friend.detail.note_placeholder': '设置好友备注',
        'friend.detail.note_saved': '备注已保存',
        'friend.detail.note_error': '保存备注失败',
        'friend.detail.display_name': '显示名称',
        'friend.detail.edit_display_name': '修改显示名',
        'friend.detail.display_name_placeholder': '设置好友显示名称',
        'friend.detail.display_name_saved': '显示名已保存',
        'friend.detail.display_name_error': '保存显示名失败',
        'friend.detail.status_section': '设置状态',
        'friend.detail.remove_friend': '删除好友',
        'friend.detail.remove_confirm.title': '删除好友',
        'friend.detail.remove_confirm.content': '确定要删除该好友吗？',
        'friend.detail.remove_success': '已删除好友',
        'friend.detail.remove_error': '删除好友失败',
        'friend.detail.chat_error': '创建聊天失败',
        'friend.list.online': '在线',
        'home.chat_details.actions.message': '发信息',
        'home.chat_details.single.footer.audio_call': '打电话',
        'home.chat_details.single.footer.video_call': '打视频',
        'home.chat_details.single.empty_signature': '这个人很高冷，暂时没有留下什么',
        'home.chat_details.single.region': `地区：${params?.place ?? '未知'}`,
        'home.chat_details.single.unknown': '未知',
        'common.confirm': '确认',
        'common.cancel': '取消',
        'friend.context.set_favorite': '设为收藏',
        'friend.context.set_normal': '设为普通',
        'friend.context.set_blocked': '屏蔽好友',
        'chat.header.open_in_new_window': '在新窗口打开'
      }
      return map[key] ?? key
    }
  })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn()
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: vi.fn()
  })
}))

vi.mock('@/composables/chat/useDetailsActions', () => ({
  useDetailsActions: () => ({
    isMobile: false,
    handleSendMessage: vi.fn(),
    handleVoiceCall: vi.fn(),
    handleVideoCall: vi.fn(),
    handleOpenInNewWindow: vi.fn()
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
            friendStatus: 'normal',
            note: '',
            remark: ''
          }
        : undefined
    ),
    startDirectRoom: vi.fn().mockResolvedValue('!room:matrix.test'),
    setFriendNote: vi.fn().mockResolvedValue(true),
    setFriendDisplayName: vi.fn().mockResolvedValue(true),
    setFriendStatus: vi.fn().mockResolvedValue(true),
    removeFromContacts: vi.fn().mockResolvedValue(true)
  })
}))

vi.mock('@/services/matrix/friends/MatrixFriendService', () => ({
  matrixFriendService: {
    getFriendGroups: getFriendGroupsMock,
    getFriendGroupsByUser: getFriendGroupsByUserMock,
    addFriendToGroup: addFriendToGroupMock,
    removeFriendFromGroup: removeFriendFromGroupMock
  }
}))

vi.mock('@/services/matrix/user/MatrixDeviceService', () => ({
  matrixDeviceService: {
    getUserDevices: getUserDevicesMock
  }
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: {
    getClient: () => ({
      getDomain: () => 'matrix.test',
      getHomeserverUrl: () => 'https://matrix.test'
    }),
    getServerDomain: () => 'matrix.test'
  }
}))

describe('SingleDetails', () => {
  const globalStubs = {
    NAvatar: {
      props: ['src', 'size'],
      template: '<img class="avatar" :src="src" :data-size="size" />'
    },
    NButton: {
      emits: ['click'],
      props: ['type', 'size', 'loading', 'disabled', 'text', 'block'],
      template: '<button @click="$emit(\'click\')"><slot /></button>'
    },
    NTag: {
      props: ['type', 'size', 'round'],
      template: '<span class="tag"><slot /></span>'
    },
    NSelect: {
      props: ['value', 'options', 'multiple', 'placeholder', 'disabled', 'loading'],
      emits: ['update:value'],
      template:
        '<select class="n-select-stub" :multiple="multiple" :data-loading="loading" :data-placeholder="placeholder" @change="$emit(\'update:value\', $event.target.value)"><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  const mountComponent = (uid = '@kevins:matrix.test') =>
    mount(SingleDetails, {
      props: {
        content: { type: RoomTypeEnum.SINGLE, uid }
      },
      global: {
        stubs: globalStubs,
        plugins: [createPinia()]
      }
    })

  it('渲染分组分配区，并加载可用分组与当前用户分组', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('.single-details__group-section').exists()).toBe(true)
    expect(getFriendGroupsMock).toHaveBeenCalledWith()
    expect(getFriendGroupsByUserMock).toHaveBeenCalledWith('@kevins:matrix.test')
  })

  it('渲染设备列表区，并调用 getUserDevices 加载设备', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('.single-details__device-section').exists()).toBe(true)
    expect(getUserDevicesMock).toHaveBeenCalledWith('@kevins:matrix.test')
    const items = wrapper.findAll('.single-details__device-item')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('MacBook Pro')
    expect(wrapper.text()).toContain('iPhone')
  })

  it('设备列表显示已验证/未验证状态', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const badges = wrapper.findAll('.single-details__device-verified')
    expect(badges).toHaveLength(2)
    expect(badges[0].text()).toBe('已验证')
    expect(badges[1].text()).toBe('未验证')
  })

  it('渲染联邦/服务器信息区，并从 userId 解析 server name', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('.single-details__federation-section').exists()).toBe(true)
    expect(wrapper.text()).toContain('matrix.test')
    // @kevins:matrix.test 的 server 等于本地 domain，应判定为本地用户
    expect(wrapper.text()).toContain('本地用户')
  })

  it('联邦用户（server 与本地 domain 不同）显示联邦用户标识', async () => {
    const wrapper = mountComponent('@alice:remote.example')
    await flushPromises()

    expect(wrapper.text()).toContain('remote.example')
    expect(wrapper.text()).toContain('联邦用户')
  })

  it('getUserDevices 失败时显示错误提示', async () => {
    getUserDevicesMock.mockRejectedValueOnce(new Error('Network error'))
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('加载设备失败')
  })

  it('设备列表为空时显示空状态', async () => {
    getUserDevicesMock.mockResolvedValueOnce([])
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('暂无设备')
  })
})
