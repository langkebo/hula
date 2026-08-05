import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

// 避免 matrix-js-sdk 重型转换（~6.7s）导致超时
vi.mock('@/services/matrix/MatrixEventService', () => ({
  default: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), convertEventToMessage: vi.fn() }
}))

// 截断所有 matrix-js-sdk 直接导入路径（ChatSetting 传递依赖）
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
    upgrade: vi.fn().mockResolvedValue(null),
    resolveTargetVersion: vi.fn().mockReturnValue(null)
  })
}))

vi.mock('@/composables/room/useRoomListManagement', () => ({
  useRoomListManagement: () => ({
    allowlist: { value: [] },
    denylist: { value: [] },
    loading: { value: false },
    adding: { value: false },
    removing: { value: {} },
    errorMessage: { value: null },
    canManage: { value: true },
    allowlistCount: { value: 3 },
    denylistCount: { value: 1 },
    loadAllowlist: vi.fn(),
    loadDenylist: vi.fn(),
    addToAllowlist: vi.fn(),
    removeFromAllowlist: vi.fn(),
    addToDenylist: vi.fn(),
    removeFromDenylist: vi.fn()
  })
}))

vi.mock('#/views/chat-room/MobileRoomUpgradeDialog.vue', () => ({
  default: {
    name: 'MobileRoomUpgradeDialog',
    template: '<div></div>',
    props: ['visible', 'roomId', 'canUpgrade'],
    emits: ['update:visible']
  }
}))
vi.mock('#/views/chat-room/MobileListManagementDialog.vue', () => ({
  default: {
    name: 'MobileListManagementDialog',
    template: '<div class="mock-list-dialog"></div>',
    props: ['visible', 'roomId', 'canManage', 'initialTab'],
    emits: ['update:visible']
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  messages: {
    en: {
      room_advanced: {
        room_upgrade: { title: 'Upgrade' },
        allowlist: { title: 'Allowlist' },
        denylist: { title: 'Denylist' }
      },
      mobile_chat_setting: { title: '{t}', type: { group: 'Group', single_chat: 'Chat' } }
    }
  } as any
})

describe('ChatSetting - list management entries', () => {
  it('renders without error', { timeout: 15000 }, async () => {
    const ChatSetting = (await import('#/views/chat-room/ChatSetting.vue')).default
    const wrapper = mount(ChatSetting, {
      global: {
        plugins: [i18n, createTestingPinia({ createSpy: vi.fn })],
        stubs: {
          AutoFixHeightPage: true,
          HeaderBar: true,
          MobileRoomUpgradeDialog: true,
          MobileListManagementDialog: true,
          'van-cell-group': true,
          'van-cell': true,
          'van-field': true,
          'van-switch': true,
          'van-button': true,
          'van-tag': true,
          'van-dialog': true,
          'van-loading': true,
          'van-dropdown-menu': true,
          'van-dropdown-item': true,
          'van-pull-refresh': true,
          'van-list': true,
          'van-action-sheet': true,
          'van-popup': true,
          'van-search': true,
          'van-icon': true,
          AvatarCropper: true
        }
      }
    })
    expect(wrapper.html()).toBeTruthy()
  })
})
