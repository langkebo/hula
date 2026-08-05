import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Override the global vue-i18n mock to use the real module so I18nT and
// createI18n are available. We provide our own i18n instance in mount().
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal()
  return actual
})

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
    template: '<div v-if="visible" class="mock-upgrade-dialog"></div>',
    props: ['visible', 'roomId', 'canUpgrade'],
    emits: ['update:visible']
  }
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: { getCurrent: () => ({ label: 'home' }) }
}))

vi.mock('@tauri-apps/plugin-log', () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))

vi.mock('@/router', () => ({ default: { currentRoute: { value: { name: '/message' } }, push: vi.fn() } }))

const i18n = createI18n({
  legacy: false,
  locale: 'en-US' as const,
  messages: {
    'en-US': {
      room_advanced: { room_upgrade: { title: 'Room Upgrade' } },
      mobile_chat_setting: {
        title: '{t}',
        type: { group: 'Group', single_chat: 'Chat' },
        group_members_title: 'Group Members',
        member_count: 'Members {count}',
        group_invite_member: 'Invite',
        manage_group_members: 'Manage Members',
        search_history: 'Search History',
        id_card: {
          qr_code_label: '{t} ID',
          type: { group: 'Group', single_chat: 'Chat' }
        },
        group_notice: { title: 'Group Notice' },
        group_name: 'Group Name',
        group_alias: 'Group Alias',
        remark: 'Remark',
        remar_kprivate_visible: 'private',
        setting_type: '{t} Settings',
        pintop: 'Pin to Top',
        silent: 'Silent',
        delete_chat_history: 'Delete Chat History',
        disband_group: 'Disband Group',
        leave_group: 'Leave Group',
        delete_friend: 'Delete Friend',
        input: {
          group_name: 'Enter group name',
          group_alias: 'Enter group alias',
          remark: 'Enter remark'
        }
      }
    }
  } as any
})

function mountOptions() {
  return {
    global: {
      plugins: [
        i18n,
        createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            global: {
              currentSessionRoomId: 'room-1'
            },
            session: {
              sessionList: [
                {
                  roomId: 'room-1',
                  name: 'Test Group',
                  type: 1, // RoomTypeEnum.GROUP
                  unreadCount: 0,
                  activeTime: 0
                }
              ]
            }
          }
        })
      ],
      stubs: {
        AutoFixHeightPage: {
          template: '<div><slot name="header" /><slot name="container" /></div>'
        },
        HeaderBar: true,
        MobileRoomUpgradeDialog: false,
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
  }
}

describe('ChatSetting - room upgrade entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the upgrade cell with Room Upgrade title and current version, dialog hidden initially', {
    timeout: 30000
  }, async () => {
    const ChatSetting = (await import('#/views/chat-room/ChatSetting.vue')).default
    const wrapper = mount(ChatSetting, mountOptions())
    expect(wrapper.html()).toBeTruthy()
    expect(wrapper.text()).toContain('Room Upgrade')
    expect(wrapper.text()).toContain('10')
    expect(wrapper.find('.mock-upgrade-dialog').exists()).toBe(false)
  })

  it('mounts without throwing and renders upgrade section with title, version, and hidden dialog', {
    timeout: 30000
  }, async () => {
    const ChatSetting = (await import('#/views/chat-room/ChatSetting.vue')).default
    const wrapper = mount(ChatSetting, mountOptions())
    expect(wrapper.text()).toContain('Room Upgrade')
    expect(wrapper.text()).toContain('10')
    expect(wrapper.find('.mock-upgrade-dialog').exists()).toBe(false)
  })
})
