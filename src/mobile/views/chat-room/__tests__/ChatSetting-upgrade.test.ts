import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

vi.mock('@/composables/room/useRoomUpgradeFlow', () => ({
  useRoomUpgradeFlow: () => ({
    currentVersion: { value: '10' },
    availableVersions: { value: [{ version: '11', status: 'stable' }] },
    targetVersion: { value: null },
    loading: { value: false },
    upgrading: { value: false },
    errorMessage: { value: null },
    canUpgrade: { value: true },
    hasVersions: { value: true },
    newerVersions: { value: [{ version: '11', status: 'stable' }] },
    load: vi.fn(),
    upgrade: vi.fn().mockResolvedValue('new-room-id'),
    resolveTargetVersion: vi.fn().mockReturnValue('11')
  })
}))

vi.mock('#/views/chat-room/MobileRoomUpgradeDialog.vue', () => ({
  default: {
    name: 'MobileRoomUpgradeDialog',
    template: '<div class="mock-upgrade-dialog"></div>',
    props: ['visible', 'roomId', 'canUpgrade'],
    emits: ['update:visible']
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en-US' as const,
  messages: {
    'en-US': {
      room_advanced: { room_upgrade: { title: 'Room Upgrade' } },
      mobile_chat_setting: { title: '{t}', type: { group: 'Group', single_chat: 'Chat' } }
    }
  }
})

describe('ChatSetting - room upgrade entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the upgrade cell for group admin rooms', async () => {
    const ChatSetting = (await import('#/views/chat-room/ChatSetting.vue')).default
    const wrapper = mount(ChatSetting, {
      global: {
        plugins: [i18n, createTestingPinia({ createSpy: vi.fn })],
        stubs: {
          AutoFixHeightPage: true,
          HeaderBar: true,
          MobileRoomUpgradeDialog: true,
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
    expect(wrapper.find('.mock-upgrade-dialog').exists()).toBe(false)
  })

  it('does not throw when mounted', async () => {
    const ChatSetting = (await import('#/views/chat-room/ChatSetting.vue')).default
    expect(() =>
      mount(ChatSetting, {
        global: {
          plugins: [i18n, createTestingPinia({ createSpy: vi.fn })],
          stubs: {
            AutoFixHeightPage: true,
            HeaderBar: true,
            MobileRoomUpgradeDialog: true,
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
    ).not.toThrow()
  })
})
