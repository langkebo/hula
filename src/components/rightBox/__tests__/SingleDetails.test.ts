import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomTypeEnum } from '@/enums'
import { createI18nMock, resolveMessage } from '~/tests/i18n-messages'
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

/**
 * i18n 桩改为**真实语言表驱动**。
 *
 * 此前这里手写了一张 key → 中文文案映射表，而它是照着组件源码抄的：
 * 源码键名写错时桩抄的也是错键名，测试全绿、界面渲染裸 key（「自洽 stub」反模式）。
 * 本文件即实证：`FriendDetailsSections` 的联邦 chip 从 `friend.detail.federated_user`
 * 换到 `friend.federated_user` 后，手写桩仍是旧键 → 断言拿到裸 key，
 * 而真实语言表里两个键都健全（`friend.json` 的 `detail.federated_user` 与顶层 `federated_user`）。
 * `createI18nMock()` 直接解析 `locales/zh-CN/*.json`，未解析到的键原样返回，
 * 断言立刻暴露。故下面的文案断言一律用 `resolveMessage()` 取真实文案。
 */
vi.mock('vue-i18n', () => createI18nMock())

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
            remark: '',
            directRoomId: '!dm-kevins:matrix.test'
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
    expect(badges[0].text()).toBe(resolveMessage('friend.detail.device_verified'))
    expect(badges[1].text()).toBe(resolveMessage('friend.detail.device_unverified'))
  })

  it('渲染联邦/服务器信息区，并从 userId 解析 server name', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('.single-details__federation-section').exists()).toBe(true)
    expect(wrapper.text()).toContain('matrix.test')
    // @kevins:matrix.test 的 server 等于本地 domain，应判定为本地用户
    expect(wrapper.text()).toContain(resolveMessage('friend.local_user'))
  })

  it('联邦身份行经 UserIdentity 组合单元渲染，且联邦区不重复出现 chip', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const identity = wrapper.find('[data-testid="friend-identity"]')
    expect(identity.exists()).toBe(true)
    // 组合单元内部自带「主标识 + 联邦 chip + 完整 MXID」
    expect(identity.find('[data-testid="federation-badge"]').exists()).toBe(true)
    expect(identity.find('[data-testid="mxid-text"]').exists()).toBe(true)
    // 旧实现是「label 行 + badge 行」两处联邦语义，合并后整区只应有一个 chip
    expect(wrapper.findAll('.single-details__federation-section [data-testid="federation-badge"]')).toHaveLength(1)
  })

  it('联邦用户（server 与本地 domain 不同）显示联邦用户标识', async () => {
    const wrapper = mountComponent('@alice:remote.example')
    await flushPromises()

    expect(wrapper.text()).toContain('remote.example')
    expect(wrapper.text()).toContain(resolveMessage('friend.federated_user'))
    expect(wrapper.text()).not.toContain(resolveMessage('friend.local_user'))
  })

  it('getUserDevices 失败时显示错误提示', async () => {
    getUserDevicesMock.mockRejectedValueOnce(new Error('Network error'))
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain(resolveMessage('friend.detail.devices_load_error'))
  })

  it('设备列表为空时显示空状态', async () => {
    getUserDevicesMock.mockResolvedValueOnce([])
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain(resolveMessage('friend.detail.devices_empty'))
  })

  describe('阅后即焚设置区（RoomBurnSettings 接入）', () => {
    vi.mock('@/composables/useBurnAfterRead', () => ({
      useBurnAfterRead: () => ({
        refreshBurnSettings: vi.fn(async () => undefined),
        isRoomBurnEnabled: vi.fn(() => false),
        getRoomBurnDuration: vi.fn(() => 60000),
        getPendingBurns: vi.fn(async () => []),
        enableBurn: vi.fn(async () => true),
        disableBurn: vi.fn(async () => true)
      })
    }))

    it('好友有 directRoomId 时渲染阅后即焚设置区', async () => {
      const wrapper = mountComponent('@kevins:matrix.test')
      await flushPromises()

      expect(wrapper.find('[data-testid="room-burn-settings"]').exists()).toBe(true)
    })
  })
})
