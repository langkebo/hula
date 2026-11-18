import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { groupStoreMock, announcementStoreMock } = vi.hoisted(() => ({
  groupStoreMock: {
    isAdminOrLord: () => false,
    isCurrentLord: () => false,
    isAdmin: () => false,
    loadGroupInfo: vi.fn(),
    loadRoomMembers: vi.fn(),
    getUserListByRoomId: vi.fn(() => []),
    getUserInfo: vi.fn(),
    exitGroup: vi.fn()
  },
  announcementStoreMock: {
    announError: false,
    getGroupAnnouncementList: vi.fn()
  }
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => groupStoreMock
}))

vi.mock('@/stores/domains/chat/announcement', () => ({
  useAnnouncementStore: () => announcementStoreMock
}))

// 避免 matrix-js-sdk 重型转换导致超时
vi.mock('@/services/matrix/MatrixEventService', () => ({
  default: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), convertEventToMessage: vi.fn() }
}))

vi.mock('matrix-js-sdk', () => ({
  Direction: { Forward: 'f', Backward: 'b' },
  EventType: { Message: 'm.room.message' },
  PushRuleKind: {},
  Visibility: {},
  ClientEvent: {},
  RoomEvent: {},
  RoomStateEvent: {}
}))

vi.mock('@/composables/room/useRoomUpgradeFlow', () => ({
  useRoomUpgradeFlow: () => ({
    currentVersion: { value: '10' },
    availableVersions: { value: [] },
    targetVersion: { value: null },
    loading: { value: false },
    upgrading: { value: false },
    errorMessage: { value: null },
    canUpgrade: { value: false },
    hasVersions: { value: false },
    newerVersions: { value: [] },
    load: vi.fn(),
    upgrade: vi.fn(),
    resolveTargetVersion: vi.fn()
  })
}))

vi.mock('#/views/chat-room/MobileRoomUpgradeDialog.vue', () => ({
  default: { name: 'MobileRoomUpgradeDialog', template: '<div />', props: ['visible', 'roomId', 'canUpgrade'] }
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: { getCurrent: () => ({ label: 'home' }) }
}))

vi.mock('@tauri-apps/plugin-log', () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))

vi.mock('@/router', () => ({ default: { currentRoute: { value: { name: '/message' } }, push: vi.fn() } }))

import ChatSetting from '@/mobile/views/chat-room/ChatSetting.vue'

const mountOptions = () => ({
  global: {
    plugins: [
      createTestingPinia({
        createSpy: vi.fn,
        initialState: {
          global: { currentSessionRoomId: 'room-1' },
          session: {
            sessionList: [{ roomId: 'room-1', name: 'Test Group', type: 1, unreadCount: 0, activeTime: 0 }]
          }
        }
      })
    ],
    stubs: {
      AutoFixHeightPage: { template: '<div><slot name="header" /><slot name="container" /></div>' },
      HeaderBar: true,
      ChatSettingMemberSection: true,
      ChatSettingToggles: true,
      'van-cell-group': true,
      'van-cell': true,
      'van-field': true,
      'van-switch': true,
      'van-button': true,
      'van-tag': true,
      'van-dialog': true,
      'van-loading': true,
      'van-popup': true,
      AvatarCropper: true
    }
  }
})

describe('ChatSetting - 群资料与公告失败态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    groupStoreMock.loadGroupInfo.mockResolvedValue(undefined)
    groupStoreMock.loadRoomMembers.mockResolvedValue(undefined)
    announcementStoreMock.announError = false
    announcementStoreMock.getGroupAnnouncementList.mockResolvedValue({ records: [], total: 0 })
  })

  it('群资料读取为空时展示错误与重试入口，不渲染空群名', {
    timeout: 240000
  }, async () => {
    const wrapper = mount(ChatSetting, mountOptions())
    await flushPromises()

    expect(wrapper.find('[data-testid="group-info-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('common.load_failed')
  })

  it('公告读取失败时展示错误文案，不伪装成暂无公告', {
    timeout: 240000
  }, async () => {
    announcementStoreMock.announError = true
    const wrapper = mount(ChatSetting, mountOptions())
    await flushPromises()

    expect(wrapper.find('[data-testid="group-notice-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('mobile_chat.notice.fetch_failed')
  })

  it('点击群资料错误后重试，成功后错误态消失', {
    timeout: 240000
  }, async () => {
    const wrapper = mount(ChatSetting, mountOptions())
    await flushPromises()
    expect(wrapper.find('[data-testid="group-info-error"]').exists()).toBe(true)

    groupStoreMock.loadGroupInfo.mockResolvedValue({ name: 'Recovered Group', avatar: 'mxc://a' })
    await wrapper.find('[data-testid="group-info-error"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="group-info-error"]').exists()).toBe(false)
  })

  it('点击公告错误后重试，成功后渲染公告内容', {
    timeout: 240000
  }, async () => {
    announcementStoreMock.announError = true
    const wrapper = mount(ChatSetting, mountOptions())
    await flushPromises()
    expect(wrapper.find('[data-testid="group-notice-error"]').exists()).toBe(true)

    announcementStoreMock.announError = false
    announcementStoreMock.getGroupAnnouncementList.mockResolvedValue({
      records: [{ id: 'notice-1', content: '公告内容 A', top: false }],
      total: 1
    })
    await wrapper.find('[data-testid="group-notice-error"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="group-notice-error"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('公告内容 A')
  })
})
